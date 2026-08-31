import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../middleware/errorHandler";
import { audit } from "../utils/audit";
import { createJobSchema, listJobsSchema } from "../validators/crm";
import { availableProviders, getProvider } from "../prospecting/registry";
import { NICHES } from "../prospecting/niches";
import { SCORING_PROFILES } from "../prospecting/score";
import { runSlice, startInlineLoop } from "../prospecting/runner";

const router = Router();

router.use(requireAuth);

/** Everything the "nova busca" form needs to render itself. */
router.get(
  "/options",
  asyncHandler(async (_req, res) => {
    res.json({
      providers: availableProviders(),
      niches: NICHES.map((n) => ({ id: n.id, label: n.label })),
      scoringProfiles: SCORING_PROFILES,
    });
  })
);

router.get(
  "/jobs",
  asyncHandler(async (req, res) => {
    const { limit } = listJobsSchema.parse(req.query);
    const jobs = await prisma.prospectJob.findMany({
      where: { organizationId: req.user!.orgId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { createdBy: { select: { id: true, name: true } } },
    });
    res.json({ jobs });
  })
);

router.get(
  "/jobs/:id",
  asyncHandler(async (req, res) => {
    const job = await prisma.prospectJob.findFirst({
      where: { id: req.params.id, organizationId: req.user!.orgId },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!job) throw new ApiError(404, "Busca não encontrada");
    res.json({ job });
  })
);

/**
 * Start a prospecting run.
 *
 * Restricted to MANAGER/ADMIN: each run spends a real external quota (and, with
 * Google Places configured, real money), so it is not something every seat
 * should be able to trigger.
 */
router.post(
  "/jobs",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const data = createJobSchema.parse(req.body);

    const provider = getProvider(data.provider);
    if (!provider) throw new ApiError(400, "Fonte desconhecida");
    if (!provider.isAvailable()) {
      throw new ApiError(400, `A fonte "${data.provider}" não está configurada neste ambiente.`);
    }

    // One run at a time per organization: the sources are rate-limited, and two
    // concurrent runs would mostly race each other for the same dedupe keys.
    const inFlight = await prisma.prospectJob.findFirst({
      where: { organizationId: orgId, status: { in: ["queued", "running"] } },
      select: { id: true },
    });
    if (inFlight) {
      throw new ApiError(409, "Já existe uma busca em andamento. Espere ela terminar ou cancele antes de iniciar outra.");
    }

    const job = await prisma.prospectJob.create({
      data: {
        organizationId: orgId,
        provider: data.provider,
        query: data.query,
        city: data.city,
        state: data.state ?? null,
        radiusMeters: data.radiusMeters,
        limit: data.limit,
        scoringProfile: data.scoringProfile,
        createdById: req.user!.sub,
      },
    });

    // On an always-on host this drives the job to completion by itself; on
    // serverless it is a no-op and the browser ticks the job instead.
    startInlineLoop(job.id);

    await audit({
      action: "prospect.job.create",
      req,
      userId: req.user!.sub,
      organizationId: orgId,
      details: { jobId: job.id, provider: data.provider, query: data.query, city: data.city },
    });

    res.status(202).json({ job });
  })
);

/**
 * Advance a queued or running job by one slice.
 *
 * This is what makes the worker host-agnostic. On a serverless platform the
 * browser calls it repeatedly while the Garimpo screen is open, each call doing
 * as much as fits inside the platform's request limit; the response says
 * whether more work remains. On an always-on host the same slices are driven by
 * a background loop and this endpoint is simply never needed.
 *
 * It is safe to call concurrently: the job row carries a lock, so a second
 * caller returns the current state instead of importing anything twice.
 */
router.post(
  "/jobs/:id/tick",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const job = await prisma.prospectJob.findFirst({
      where: { id: req.params.id, organizationId: req.user!.orgId },
      select: { id: true },
    });
    if (!job) throw new ApiError(404, "Busca não encontrada");

    const result = await runSlice(job.id);
    res.json(result);
  })
);

router.post(
  "/jobs/:id/cancel",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const job = await prisma.prospectJob.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!job) throw new ApiError(404, "Busca não encontrada");
    if (job.status !== "queued" && job.status !== "running") {
      throw new ApiError(400, "Essa busca já terminou");
    }

    // The worker checks this flag between candidates, so cancelling stops the
    // run at the next boundary and keeps whatever it already imported.
    const updated = await prisma.prospectJob.update({
      where: { id: job.id },
      data: { status: "cancelled", finishedAt: new Date() },
    });

    res.json({ job: updated });
  })
);

export default router;
