import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../middleware/errorHandler";
import { audit } from "../utils/audit";
import { closeDealSchema, createDealSchema, updateDealSchema } from "../validators/crm";

const router = Router();

router.use(requireAuth);

const DEAL_INCLUDE = {
  owner: { select: { id: true, name: true } },
  lead: { select: { id: true, companyName: true, phone: true, email: true, city: true, score: true } },
  stage: { select: { id: true, name: true, kind: true, position: true } },
};

/** Resolve which pipeline to use when the caller did not name one. */
async function resolveDefaultPipeline(orgId: string) {
  const pipeline = await prisma.pipeline.findFirst({
    where: { organizationId: orgId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { stages: { orderBy: { position: "asc" } } },
  });
  if (!pipeline) throw new ApiError(400, "Nenhum funil configurado. Crie um funil antes de abrir negócios.");
  return pipeline;
}

/** The kanban board: every stage of one pipeline with the deals sitting in it. */
router.get(
  "/board",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const pipelineId = typeof req.query.pipelineId === "string" ? req.query.pipelineId : undefined;

    const pipeline = pipelineId
      ? await prisma.pipeline.findFirst({
          where: { id: pipelineId, organizationId: orgId },
          include: { stages: { orderBy: { position: "asc" } } },
        })
      : await resolveDefaultPipeline(orgId);

    if (!pipeline) throw new ApiError(404, "Funil não encontrado");

    const deals = await prisma.deal.findMany({
      where: { organizationId: orgId, pipelineId: pipeline.id },
      include: DEAL_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });

    const columns = pipeline.stages.map((stage) => {
      const stageDeals = deals.filter((d) => d.stageId === stage.id);
      return {
        stage,
        deals: stageDeals,
        totalValue: stageDeals.reduce((sum, d) => sum + d.value, 0),
      };
    });

    res.json({ pipeline: { id: pipeline.id, name: pipeline.name }, columns });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const deal = await prisma.deal.findFirst({
      where: { id: req.params.id, organizationId: req.user!.orgId },
      include: {
        ...DEAL_INCLUDE,
        activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true } } } },
      },
    });
    if (!deal) throw new ApiError(404, "Negócio não encontrado");
    res.json({ deal });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const data = createDealSchema.parse(req.body);

    const pipeline = data.pipelineId
      ? await prisma.pipeline.findFirst({
          where: { id: data.pipelineId, organizationId: orgId },
          include: { stages: { orderBy: { position: "asc" } } },
        })
      : await resolveDefaultPipeline(orgId);
    if (!pipeline) throw new ApiError(404, "Funil não encontrado");

    const stage = data.stageId
      ? pipeline.stages.find((s) => s.id === data.stageId)
      : pipeline.stages.find((s) => s.kind === "open");
    if (!stage) throw new ApiError(400, "Etapa inválida para esse funil");

    if (data.leadId) {
      const lead = await prisma.lead.findFirst({ where: { id: data.leadId, organizationId: orgId }, select: { id: true } });
      if (!lead) throw new ApiError(400, "Lead inválido");
    }
    if (data.ownerId) {
      const owner = await prisma.user.findFirst({
        where: { id: data.ownerId, organizationId: orgId, isActive: true },
        select: { id: true },
      });
      if (!owner) throw new ApiError(400, "Responsável inválido");
    }

    const deal = await prisma.deal.create({
      data: {
        organizationId: orgId,
        title: data.title,
        leadId: data.leadId ?? null,
        pipelineId: pipeline.id,
        stageId: stage.id,
        value: data.value,
        probability: stage.probability,
        expectedCloseAt: data.expectedCloseAt ?? null,
        ownerId: data.ownerId ?? req.user!.sub,
      },
      include: DEAL_INCLUDE,
    });

    // Opening a deal is the moment a lead stops being a name on a list.
    if (data.leadId) {
      await prisma.$transaction([
        prisma.lead.updateMany({
          where: { id: data.leadId, organizationId: orgId, status: "new" },
          data: { status: "qualified" },
        }),
        prisma.activity.create({
          data: {
            organizationId: orgId,
            leadId: data.leadId,
            type: "system",
            content: `Negócio "${deal.title}" aberto no funil ${pipeline.name}.`,
            userId: req.user!.sub,
          },
        }),
      ]);
    }

    res.status(201).json({ deal });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const data = updateDealSchema.parse(req.body);

    const deal = await prisma.deal.findFirst({
      where: { id: req.params.id, organizationId: orgId },
      include: { stage: true },
    });
    if (!deal) throw new ApiError(404, "Negócio não encontrado");
    if (deal.status !== "open" && data.stageId) {
      throw new ApiError(400, "Negócio já fechado — reabra antes de mover de etapa");
    }

    const update: Record<string, unknown> = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.value !== undefined) update.value = data.value;
    if (data.expectedCloseAt !== undefined) update.expectedCloseAt = data.expectedCloseAt;

    if (data.ownerId !== undefined) {
      if (data.ownerId) {
        const owner = await prisma.user.findFirst({
          where: { id: data.ownerId, organizationId: orgId, isActive: true },
          select: { id: true },
        });
        if (!owner) throw new ApiError(400, "Responsável inválido");
      }
      update.ownerId = data.ownerId;
    }

    let movedTo: { name: string; kind: string } | null = null;
    if (data.stageId && data.stageId !== deal.stageId) {
      const stage = await prisma.pipelineStage.findFirst({
        where: { id: data.stageId, pipelineId: deal.pipelineId },
      });
      if (!stage) throw new ApiError(400, "Etapa não pertence ao funil desse negócio");

      update.stageId = stage.id;
      // A stage carries a default probability, but an explicit value in the
      // same request wins — the human looking at the deal knows more than the
      // column does.
      update.probability = data.probability ?? stage.probability;
      movedTo = { name: stage.name, kind: stage.kind };

      // Dropping a card into a terminal column closes the deal; that is what
      // dragging it there means on the board.
      if (stage.kind === "won" || stage.kind === "lost") {
        update.status = stage.kind;
        update.closedAt = new Date();
      } else if (deal.status !== "open") {
        update.status = "open";
        update.closedAt = null;
        update.lostReason = null;
      }
    } else if (data.probability !== undefined) {
      update.probability = data.probability;
    }

    const updated = await prisma.deal.update({ where: { id: deal.id }, data: update, include: DEAL_INCLUDE });

    if (movedTo && deal.leadId) {
      await prisma.activity.create({
        data: {
          organizationId: orgId,
          leadId: deal.leadId,
          dealId: deal.id,
          type: "system",
          content: `Negócio movido de "${deal.stage.name}" para "${movedTo.name}".`,
          userId: req.user!.sub,
        },
      });
    }

    res.json({ deal: updated });
  })
);

router.post(
  "/:id/close",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const { outcome, lostReason } = closeDealSchema.parse(req.body);

    const deal = await prisma.deal.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!deal) throw new ApiError(404, "Negócio não encontrado");
    if (deal.status !== "open") throw new ApiError(400, "Esse negócio já está fechado");

    const terminalStage = await prisma.pipelineStage.findFirst({
      where: { pipelineId: deal.pipelineId, kind: outcome },
      orderBy: { position: "asc" },
    });

    const updated = await prisma.deal.update({
      where: { id: deal.id },
      data: {
        status: outcome,
        closedAt: new Date(),
        lostReason: outcome === "lost" ? (lostReason ?? null) : null,
        probability: outcome === "won" ? 100 : 0,
        // Keep the board honest: a closed deal belongs in its terminal column.
        stageId: terminalStage?.id ?? deal.stageId,
      },
      include: DEAL_INCLUDE,
    });

    if (deal.leadId) {
      await prisma.activity.create({
        data: {
          organizationId: orgId,
          leadId: deal.leadId,
          dealId: deal.id,
          type: "system",
          content: outcome === "won" ? "Negócio ganho." : `Negócio perdido${lostReason ? `: ${lostReason}` : "."}`,
          userId: req.user!.sub,
        },
      });
    }

    await audit({
      action: `deal.${outcome}`,
      req,
      userId: req.user!.sub,
      organizationId: orgId,
      details: { dealId: deal.id, value: deal.value },
    });

    res.json({ deal: updated });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const deal = await prisma.deal.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!deal) throw new ApiError(404, "Negócio não encontrado");

    await prisma.deal.delete({ where: { id: deal.id } });
    res.json({ ok: true });
  })
);

export default router;
