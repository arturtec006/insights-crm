import { prisma } from "../config/prisma";
import { getProvider } from "./registry";
import { enrichFromWebsite } from "./enrich";
import { isScoringProfile, scoreLead, ScoringProfile } from "./score";
import { buildDedupeKey, normalizeDomain, normalizeEmail, normalizeInstagram, normalizePhoneBR } from "./normalize";
import { RawBusiness } from "./types";
import { env } from "../config/env";

// The prospecting worker, written to be *resumable*.
//
// A run is never held in process memory: the provider's result set, the cursor
// into it and the counters all live on the ProspectJob row. Advancing a job
// means calling `runSlice`, which does as much work as fits in a time budget
// and then returns. Who calls it differs by host:
//
//   - Serverless (Vercel): the browser polls POST /jobs/:id/tick, and each
//     invocation runs one slice well inside the platform's duration limit.
//   - Always-on (Railway, a VPS): `startInlineLoop` ticks in the background
//     until the job finishes, so nobody has to keep a tab open.
//
// Both paths run the identical slice logic, which is why moving between hosts
// is a configuration change rather than a rewrite.

export interface SliceResult {
  status: string;
  done: boolean;
  foundCount: number;
  createdCount: number;
  duplicateCount: number;
  /** How far through the candidate list this job is. */
  cursor: number;
  error: string | null;
}

/** Extra grace on top of the work budget before another caller may steal the lock. */
const LOCK_GRACE_MS = 30_000;

interface NormalizedLead {
  companyName: string;
  phone: string | null;
  phoneRaw: string | null;
  websiteDomain: string | null;
  website: string | null;
  email: string | null;
  instagram: string | null;
  dedupeKey: string;
}

function normalizeBusiness(raw: RawBusiness): NormalizedLead {
  const phone = normalizePhoneBR(raw.phone);
  const websiteDomain = normalizeDomain(raw.website);
  return {
    companyName: raw.name,
    phone,
    phoneRaw: raw.phone ?? null,
    websiteDomain,
    website: raw.website ?? null,
    email: normalizeEmail(raw.email),
    instagram: normalizeInstagram(raw.instagram),
    dedupeKey: buildDedupeKey({ phone, websiteDomain, companyName: raw.name, city: raw.city }),
  };
}

function summarize(job: {
  status: string;
  foundCount: number;
  createdCount: number;
  duplicateCount: number;
  cursor: number;
  error: string | null;
}): SliceResult {
  return {
    status: job.status,
    done: job.status !== "queued" && job.status !== "running",
    foundCount: job.foundCount,
    createdCount: job.createdCount,
    duplicateCount: job.duplicateCount,
    cursor: job.cursor,
    error: job.error,
  };
}

/**
 * Claim a job for this invocation.
 *
 * The conditional updateMany is the whole concurrency story: only one caller
 * can flip a job whose lock is absent or expired, so a second browser tab (or
 * a retried request) finds count === 0 and backs off rather than importing the
 * same businesses twice.
 */
async function acquireLock(jobId: string, holdMs: number): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.prospectJob.updateMany({
    where: {
      id: jobId,
      status: { in: ["queued", "running"] },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
    data: { lockedUntil: new Date(now.getTime() + holdMs + LOCK_GRACE_MS) },
  });
  return count > 0;
}

async function releaseLock(jobId: string): Promise<void> {
  await prisma.prospectJob.updateMany({ where: { id: jobId }, data: { lockedUntil: null } }).catch(() => undefined);
}

/**
 * Fetch the provider's results once and park them on the job row.
 *
 * Doing this on the first slice only is deliberate: Overpass is a shared public
 * endpoint, and re-running the same query on every slice would be abusive as
 * well as slow.
 */
async function loadCandidates(jobId: string): Promise<RawBusiness[]> {
  const job = await prisma.prospectJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Busca não encontrada");

  if (job.candidates) {
    return JSON.parse(job.candidates) as RawBusiness[];
  }

  const provider = getProvider(job.provider);
  if (!provider) throw new Error(`Fonte desconhecida: ${job.provider}`);

  const businesses = await provider.search({
    query: job.query,
    city: job.city,
    state: job.state ?? undefined,
    radiusMeters: job.radiusMeters,
    limit: job.limit,
  });

  await prisma.prospectJob.update({
    where: { id: jobId },
    data: {
      candidates: JSON.stringify(businesses),
      foundCount: businesses.length,
      cursor: 0,
      status: "running",
      startedAt: job.startedAt ?? new Date(),
      error: null,
    },
  });

  return businesses;
}

/**
 * Import one candidate. Returns what happened so the caller can keep counters.
 */
async function importCandidate(
  business: RawBusiness,
  job: { id: string; organizationId: string; city: string; state: string | null; query: string },
  providerId: string,
  profile: ScoringProfile,
  suppressed: Set<string>
): Promise<"created" | "duplicate" | "suppressed"> {
  const norm = normalizeBusiness(business);

  if (
    (norm.phone && suppressed.has(`phone:${norm.phone}`)) ||
    (norm.websiteDomain && suppressed.has(`domain:${norm.websiteDomain}`)) ||
    (norm.email && suppressed.has(`email:${norm.email}`))
  ) {
    return "suppressed";
  }

  const existing = await prisma.lead.findUnique({
    where: { organizationId_dedupeKey: { organizationId: job.organizationId, dedupeKey: norm.dedupeKey } },
    select: { id: true },
  });
  if (existing) return "duplicate";

  // Only worth a network round-trip when there is a site to read, and only for
  // the fields the source did not already provide.
  let enriched: { email?: string; instagram?: string; whatsapp?: string; visited: string[] } = { visited: [] };
  if (norm.website && norm.websiteDomain && (!norm.email || !norm.instagram)) {
    enriched = await enrichFromWebsite(norm.website, norm.websiteDomain);
  }

  const email = norm.email ?? enriched.email ?? null;
  const instagram = norm.instagram ?? enriched.instagram ?? null;
  const phone = norm.phone ?? enriched.whatsapp ?? null;

  const { score, signals } = scoreLead(
    {
      phone,
      email,
      websiteDomain: norm.websiteDomain,
      instagram,
      addressLine: business.addressLine,
      category: business.category,
      latitude: business.latitude,
      longitude: business.longitude,
    },
    profile
  );

  try {
    const lead = await prisma.lead.create({
      data: {
        organizationId: job.organizationId,
        jobId: job.id,
        companyName: norm.companyName,
        phone,
        phoneRaw: norm.phoneRaw,
        email,
        website: norm.website,
        websiteDomain: norm.websiteDomain,
        instagram,
        addressLine: business.addressLine ?? null,
        city: business.city ?? job.city,
        state: business.state ?? job.state,
        latitude: business.latitude ?? null,
        longitude: business.longitude ?? null,
        category: business.category ?? null,
        source: providerId,
        sourceRef: business.sourceRef,
        dedupeKey: norm.dedupeKey,
        score,
        signals: JSON.stringify(signals),
        rawData: JSON.stringify(business.raw),
      },
    });

    // A lead's timeline should open with where it came from, so nobody has to
    // guess later why an unfamiliar company showed up in the pipeline.
    const origin = `Lead captado automaticamente via ${providerId} (busca: "${job.query}" em ${job.city})`;
    const visited = enriched.visited.length ? `. Enriquecido a partir de ${enriched.visited.join(", ")}` : "";

    await prisma.activity.create({
      data: { organizationId: job.organizationId, leadId: lead.id, type: "system", content: origin + visited },
    });

    return "created";
  } catch {
    // Another slice may have inserted the same business between the check above
    // and this write; the unique constraint is the real guarantee.
    return "duplicate";
  }
}

/**
 * Advance a job by as much work as fits in `budgetMs`, then return.
 *
 * Always leaves the job in a consistent state: either finished, or parked at a
 * cursor that the next call picks up from.
 */
export async function runSlice(jobId: string, budgetMs = env.prospectingSliceMs): Promise<SliceResult> {
  const initial = await prisma.prospectJob.findUnique({ where: { id: jobId } });
  if (!initial) throw new Error("Busca não encontrada");
  if (initial.status !== "queued" && initial.status !== "running") {
    return summarize(initial);
  }

  if (!(await acquireLock(jobId, budgetMs))) {
    // Someone else is mid-slice. Report current state; the caller polls again.
    const current = await prisma.prospectJob.findUnique({ where: { id: jobId } });
    return summarize(current ?? initial);
  }

  const deadline = Date.now() + budgetMs;

  try {
    const candidates = await loadCandidates(jobId);

    const job = await prisma.prospectJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Busca não encontrada");
    if (job.status === "cancelled") return summarize(job);

    const provider = getProvider(job.provider);
    if (!provider) throw new Error(`Fonte desconhecida: ${job.provider}`);

    const suppressions = await prisma.suppressionEntry.findMany({
      where: { organizationId: job.organizationId },
      select: { kind: true, value: true },
    });
    const suppressed = new Set(suppressions.map((s) => `${s.kind}:${s.value}`));

    const profile: ScoringProfile = isScoringProfile(job.scoringProfile) ? job.scoringProfile : "completeness";

    let cursor = job.cursor;
    let created = job.createdCount;
    let duplicates = job.duplicateCount;

    while (cursor < candidates.length && Date.now() < deadline) {
      const outcome = await importCandidate(candidates[cursor], job, provider.id, profile, suppressed);
      cursor += 1;
      if (outcome === "created") created += 1;
      else if (outcome === "duplicate") duplicates += 1;

      await prisma.prospectJob.update({
        where: { id: jobId },
        data: { cursor, createdCount: created, duplicateCount: duplicates },
      });

      // A cancellation between candidates should take effect immediately rather
      // than after the whole slice.
      const check = await prisma.prospectJob.findUnique({ where: { id: jobId }, select: { status: true } });
      if (check?.status === "cancelled") {
        await releaseLock(jobId);
        const cancelled = await prisma.prospectJob.findUnique({ where: { id: jobId } });
        return summarize(cancelled!);
      }
    }

    const finished = cursor >= candidates.length;
    const updated = await prisma.prospectJob.update({
      where: { id: jobId },
      data: {
        cursor,
        createdCount: created,
        duplicateCount: duplicates,
        status: finished ? "done" : "running",
        finishedAt: finished ? new Date() : null,
        // Dropping the candidate payload once the run is over keeps finished
        // jobs from carrying a few hundred KB of provider JSON forever.
        candidates: finished ? null : undefined,
        lockedUntil: null,
      },
    });

    return summarize(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = await prisma.prospectJob.update({
      where: { id: jobId },
      data: { status: "failed", error: message, finishedAt: new Date(), lockedUntil: null },
    });
    return summarize(failed);
  }
}

/**
 * Drive a job to completion in the background.
 *
 * Only used on hosts that keep a process alive between requests; on serverless
 * the browser drives the same slices over HTTP instead.
 */
export function startInlineLoop(jobId: string): void {
  if (!env.prospectingInline) return;

  void (async () => {
    try {
      for (;;) {
        const result = await runSlice(jobId);
        if (result.done) return;
        // A short pause keeps a stuck job from spinning the event loop hot.
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error(`Inline prospecting loop for job ${jobId} stopped`, err);
    }
  })();
}

/**
 * Clear locks left behind by invocations that died mid-slice.
 *
 * Note what this deliberately does *not* do any more: it no longer fails
 * interrupted jobs. Now that all state lives in the database, a job cut short
 * by a restart or a closed browser tab is simply unfinished — the next tick
 * resumes it from its cursor, keeping every lead already imported.
 */
export async function releaseStaleLocks(): Promise<void> {
  const { count } = await prisma.prospectJob.updateMany({
    where: { status: { in: ["queued", "running"] }, lockedUntil: { lt: new Date() } },
    data: { lockedUntil: null },
  });
  if (count > 0) {
    console.log(`Released ${count} stale prospecting lock(s)`);
  }
}
