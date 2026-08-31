import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../middleware/errorHandler";
import { audit } from "../utils/audit";
import {
  convertLeadSchema,
  createLeadSchema,
  listLeadsSchema,
  suppressLeadSchema,
  updateLeadSchema,
} from "../validators/crm";
import { buildDedupeKey, normalizeDomain, normalizeEmail, normalizeInstagram, normalizePhoneBR } from "../prospecting/normalize";
import { scoreLead } from "../prospecting/score";

const router = Router();

router.use(requireAuth);

// Every query below filters on req.user.orgId. That is the tenant boundary —
// an organizationId is never read from the request body or query string.

const LEAD_LIST_SELECT = {
  id: true,
  companyName: true,
  contactName: true,
  email: true,
  phone: true,
  website: true,
  websiteDomain: true,
  instagram: true,
  city: true,
  state: true,
  category: true,
  source: true,
  score: true,
  status: true,
  createdAt: true,
  owner: { select: { id: true, name: true } },
} satisfies Prisma.LeadSelect;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const params = listLeadsSchema.parse(req.query);

    const where: Prisma.LeadWhereInput = { organizationId: orgId };

    if (params.status) where.status = params.status;
    if (params.city) where.city = params.city;
    if (params.source) where.source = params.source;
    if (params.jobId) where.jobId = params.jobId;
    if (params.minScore != null) where.score = { gte: params.minScore };

    if (params.assignment === "mine") where.ownerId = req.user!.sub;
    else if (params.assignment === "unassigned") where.ownerId = null;
    else if (params.ownerId) where.ownerId = params.ownerId;

    if (params.q) {
      // SQLite's LIKE is already case-insensitive for ASCII, which is what
      // Prisma's `contains` compiles to here. (Prisma's `mode: "insensitive"`
      // is a Postgres-only option and would throw on this provider.)
      where.OR = [
        { companyName: { contains: params.q } },
        { contactName: { contains: params.q } },
        { email: { contains: params.q } },
        { phone: { contains: params.q } },
        { websiteDomain: { contains: params.q } },
      ];
    }

    const orderBy: Prisma.LeadOrderByWithRelationInput[] =
      params.sort === "recent"
        ? [{ createdAt: "desc" }]
        : params.sort === "name"
          ? [{ companyName: "asc" }]
          : [{ score: "desc" }, { createdAt: "desc" }];

    const [total, leads, statusCounts] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        select: LEAD_LIST_SELECT,
        orderBy,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.lead.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: true }),
    ]);

    res.json({
      leads,
      total,
      page: params.page,
      pageSize: params.pageSize,
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
    });
  })
);

/** Distinct values present in this org's leads, for populating filter dropdowns. */
router.get(
  "/facets",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const [cities, sources, owners] = await Promise.all([
      prisma.lead.findMany({
        where: { organizationId: orgId, city: { not: null } },
        distinct: ["city"],
        select: { city: true },
        orderBy: { city: "asc" },
        take: 200,
      }),
      prisma.lead.findMany({
        where: { organizationId: orgId },
        distinct: ["source"],
        select: { source: true },
      }),
      prisma.user.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    res.json({
      cities: cities.map((c) => c.city).filter(Boolean),
      sources: sources.map((s) => s.source),
      owners,
    });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, organizationId: req.user!.orgId },
      include: {
        owner: { select: { id: true, name: true } },
        job: { select: { id: true, query: true, city: true, provider: true, createdAt: true } },
        activities: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        },
        deals: {
          include: { stage: { select: { id: true, name: true, kind: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!lead) throw new ApiError(404, "Lead não encontrado");

    // `signals` is stored as JSON text (SQLite has no JSON column type).
    const signals = lead.signals ? (JSON.parse(lead.signals) as { label: string; points: number }[]) : [];
    res.json({ lead: { ...lead, signals, rawData: undefined } });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const data = createLeadSchema.parse(req.body);

    const phone = normalizePhoneBR(data.phone);
    const websiteDomain = normalizeDomain(data.website);
    const email = normalizeEmail(data.email);
    const instagram = normalizeInstagram(data.instagram);

    const dedupeKey = buildDedupeKey({ phone, websiteDomain, companyName: data.companyName, city: data.city });

    const clash = await prisma.lead.findUnique({
      where: { organizationId_dedupeKey: { organizationId: orgId, dedupeKey } },
      select: { id: true, companyName: true },
    });
    if (clash) {
      throw new ApiError(409, `Esse lead já existe: "${clash.companyName}"`);
    }

    const { score, signals } = scoreLead({
      phone,
      email,
      websiteDomain,
      instagram,
      addressLine: data.addressLine,
      category: data.category,
    });

    const lead = await prisma.lead.create({
      data: {
        organizationId: orgId,
        companyName: data.companyName,
        contactName: data.contactName ?? null,
        email,
        phone,
        phoneRaw: data.phone ?? null,
        website: data.website ?? null,
        websiteDomain,
        instagram,
        addressLine: data.addressLine ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        category: data.category ?? null,
        source: "manual",
        dedupeKey,
        score,
        signals: JSON.stringify(signals),
        ownerId: req.user!.sub,
      },
    });

    await prisma.activity.create({
      data: {
        organizationId: orgId,
        leadId: lead.id,
        type: "system",
        content: "Lead cadastrado manualmente.",
        userId: req.user!.sub,
      },
    });

    res.status(201).json({ lead });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const data = updateLeadSchema.parse(req.body);

    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!lead) throw new ApiError(404, "Lead não encontrado");
    if (lead.status === "converted" && data.status && data.status !== "converted") {
      throw new ApiError(400, "Um lead já convertido não pode voltar de status");
    }

    // Reassigning to a user from another organization would silently leak the
    // lead across the tenant boundary, so the owner is validated, not trusted.
    if (data.ownerId) {
      const owner = await prisma.user.findFirst({
        where: { id: data.ownerId, organizationId: orgId, isActive: true },
        select: { id: true },
      });
      if (!owner) throw new ApiError(400, "Responsável inválido");
    }

    const update: Prisma.LeadUpdateInput = {};
    if (data.companyName !== undefined) update.companyName = data.companyName;
    if (data.contactName !== undefined) update.contactName = data.contactName ?? null;
    if (data.addressLine !== undefined) update.addressLine = data.addressLine ?? null;
    if (data.city !== undefined) update.city = data.city ?? null;
    if (data.state !== undefined) update.state = data.state ?? null;
    if (data.category !== undefined) update.category = data.category ?? null;
    if (data.status !== undefined) update.status = data.status;
    if (data.disqualifyReason !== undefined) update.disqualifyReason = data.disqualifyReason ?? null;
    if (data.ownerId !== undefined) {
      update.owner = data.ownerId ? { connect: { id: data.ownerId } } : { disconnect: true };
    }

    // Contact fields are re-normalized on write so a hand-typed phone number
    // ends up in the same shape the prospecting worker produces.
    if (data.email !== undefined) update.email = data.email ? normalizeEmail(data.email) : null;
    if (data.phone !== undefined) {
      update.phone = normalizePhoneBR(data.phone);
      update.phoneRaw = data.phone ?? null;
    }
    if (data.website !== undefined) {
      update.website = data.website ?? null;
      update.websiteDomain = normalizeDomain(data.website);
    }
    if (data.instagram !== undefined) update.instagram = normalizeInstagram(data.instagram);

    const updated = await prisma.lead.update({ where: { id: lead.id }, data: update });

    if (data.status && data.status !== lead.status) {
      await prisma.activity.create({
        data: {
          organizationId: orgId,
          leadId: lead.id,
          type: "system",
          content: `Status alterado de "${lead.status}" para "${data.status}".`,
          userId: req.user!.sub,
        },
      });
    }

    res.json({ lead: updated });
  })
);

/**
 * Promote a lead to a Customer. The analytics side of the app needs a segment
 * and an acquisition date that a raw lead does not carry, so both are supplied
 * here rather than invented silently.
 */
router.post(
  "/:id/convert",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const data = convertLeadSchema.parse(req.body);

    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!lead) throw new ApiError(404, "Lead não encontrado");
    if (lead.status === "converted") throw new ApiError(409, "Esse lead já foi convertido");

    const now = new Date();
    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          organizationId: orgId,
          name: lead.companyName,
          email: lead.email,
          segment: data.segment,
          status: "active",
          acquiredAt: now,
          region: data.region ?? lead.state ?? null,
        },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: { status: "converted", convertedCustomerId: created.id, convertedAt: now },
      });

      await tx.activity.create({
        data: {
          organizationId: orgId,
          leadId: lead.id,
          type: "system",
          content: `Lead convertido em cliente "${created.name}".`,
          userId: req.user!.sub,
        },
      });

      return created;
    });

    await audit({
      action: "lead.convert",
      req,
      userId: req.user!.sub,
      organizationId: orgId,
      details: { leadId: lead.id, customerId: customer.id },
    });

    res.status(201).json({ customer });
  })
);

/**
 * Honour a "do not contact me" request (LGPD). The lead is disqualified and its
 * identifying values are written to the suppression list, so a future
 * prospecting run rediscovering the same business will skip it.
 */
router.post(
  "/:id/suppress",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const { reason } = suppressLeadSchema.parse(req.body);

    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!lead) throw new ApiError(404, "Lead não encontrado");

    const entries: { kind: string; value: string }[] = [];
    if (lead.phone) entries.push({ kind: "phone", value: lead.phone });
    if (lead.websiteDomain) entries.push({ kind: "domain", value: lead.websiteDomain });
    if (lead.email) entries.push({ kind: "email", value: lead.email });

    if (!entries.length) {
      throw new ApiError(400, "Esse lead não tem telefone, e-mail nem domínio para adicionar à lista de supressão");
    }

    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        await tx.suppressionEntry.upsert({
          where: { organizationId_kind_value: { organizationId: orgId, kind: entry.kind, value: entry.value } },
          create: { organizationId: orgId, kind: entry.kind, value: entry.value, reason: reason ?? null },
          update: { reason: reason ?? null },
        });
      }

      await tx.lead.update({
        where: { id: lead.id },
        data: { status: "disqualified", disqualifyReason: reason ?? "Pediu para não ser contatado" },
      });

      await tx.activity.create({
        data: {
          organizationId: orgId,
          leadId: lead.id,
          type: "system",
          content: `Adicionado à lista de não-contactar${reason ? `: ${reason}` : "."}`,
          userId: req.user!.sub,
        },
      });
    });

    await audit({
      action: "lead.suppress",
      req,
      userId: req.user!.sub,
      organizationId: orgId,
      details: { leadId: lead.id, entries: entries.length },
    });

    res.json({ ok: true, suppressed: entries.length });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const lead = await prisma.lead.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!lead) throw new ApiError(404, "Lead não encontrado");
    if (lead.status === "converted") {
      throw new ApiError(400, "Esse lead virou cliente; exclua o cliente se for o caso.");
    }

    // Unlike a user, a scraped lead carries no history worth preserving — and
    // keeping bad imports around would poison the dedupe index forever.
    await prisma.lead.delete({ where: { id: lead.id } });

    await audit({
      action: "lead.delete",
      req,
      userId: req.user!.sub,
      organizationId: orgId,
      details: { leadId: lead.id, companyName: lead.companyName },
    });

    res.json({ ok: true });
  })
);

export default router;
