import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../middleware/errorHandler";
import { createActivitySchema, listActivitiesSchema, updateActivitySchema } from "../validators/crm";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const params = listActivitiesSchema.parse(req.query);

    const where: Prisma.ActivityWhereInput = { organizationId: orgId };
    if (params.leadId) where.leadId = params.leadId;
    if (params.dealId) where.dealId = params.dealId;
    if (params.pending) {
      where.dueAt = { not: null };
      where.doneAt = null;
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        lead: { select: { id: true, companyName: true } },
      },
      // A to-do list is ordered by what is due next; a timeline by what
      // happened last.
      orderBy: params.pending ? { dueAt: "asc" } : { createdAt: "desc" },
      take: params.limit,
    });

    res.json({ activities });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const data = createActivitySchema.parse(req.body);

    // Both parents are checked against the caller's organization before the
    // write, so an id guessed from another tenant cannot attach an activity.
    if (data.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: data.leadId, organizationId: orgId }, select: { id: true } });
      if (!lead) throw new ApiError(404, "Lead não encontrado");
    }
    if (data.dealId) {
      const deal = await prisma.deal.findFirst({ where: { id: data.dealId, organizationId: orgId }, select: { id: true } });
      if (!deal) throw new ApiError(404, "Negócio não encontrado");
    }

    const activity = await prisma.activity.create({
      data: {
        organizationId: orgId,
        leadId: data.leadId ?? null,
        dealId: data.dealId ?? null,
        type: data.type,
        content: data.content,
        dueAt: data.dueAt ?? null,
        userId: req.user!.sub,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    res.status(201).json({ activity });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const data = updateActivitySchema.parse(req.body);

    const activity = await prisma.activity.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!activity) throw new ApiError(404, "Atividade não encontrada");
    if (activity.type === "system") {
      throw new ApiError(400, "Eventos do sistema não podem ser editados");
    }

    const update: Prisma.ActivityUpdateInput = {};
    if (data.content !== undefined) update.content = data.content;
    if (data.dueAt !== undefined) update.dueAt = data.dueAt;
    if (data.done !== undefined) update.doneAt = data.done ? new Date() : null;

    const updated = await prisma.activity.update({
      where: { id: activity.id },
      data: update,
      include: { user: { select: { id: true, name: true } } },
    });

    res.json({ activity: updated });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const activity = await prisma.activity.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!activity) throw new ApiError(404, "Atividade não encontrada");
    if (activity.type === "system") {
      throw new ApiError(400, "Eventos do sistema fazem parte do histórico e não podem ser excluídos");
    }

    await prisma.activity.delete({ where: { id: activity.id } });
    res.json({ ok: true });
  })
);

export default router;
