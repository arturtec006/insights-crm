import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../middleware/errorHandler";
import { createPipelineSchema, createStageSchema, reorderStagesSchema, updateStageSchema } from "../validators/crm";

const router = Router();

router.use(requireAuth);

/** The columns a new pipeline starts with — a plain B2B outbound funnel. */
export const DEFAULT_STAGES: { name: string; probability: number; kind: "open" | "won" | "lost" }[] = [
  { name: "Contato inicial", probability: 10, kind: "open" },
  { name: "Conversa marcada", probability: 30, kind: "open" },
  { name: "Proposta enviada", probability: 60, kind: "open" },
  { name: "Negociação", probability: 80, kind: "open" },
  { name: "Ganho", probability: 100, kind: "won" },
  { name: "Perdido", probability: 0, kind: "lost" },
];

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const pipelines = await prisma.pipeline.findMany({
      where: { organizationId: req.user!.orgId },
      include: { stages: { orderBy: { position: "asc" } } },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    res.json({ pipelines });
  })
);

router.post(
  "/",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const { name } = createPipelineSchema.parse(req.body);

    const existingCount = await prisma.pipeline.count({ where: { organizationId: orgId } });

    const pipeline = await prisma.pipeline.create({
      data: {
        organizationId: orgId,
        name,
        isDefault: existingCount === 0,
        stages: {
          create: DEFAULT_STAGES.map((stage, index) => ({ ...stage, position: index })),
        },
      },
      include: { stages: { orderBy: { position: "asc" } } },
    });

    res.status(201).json({ pipeline });
  })
);

/** Load a stage only if it belongs to a pipeline in the caller's organization. */
async function findStageInOrg(stageId: string, orgId: string) {
  return prisma.pipelineStage.findFirst({
    where: { id: stageId, pipeline: { organizationId: orgId } },
    include: { pipeline: { select: { id: true, organizationId: true } } },
  });
}

router.post(
  "/:pipelineId/stages",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const data = createStageSchema.parse(req.body);

    const pipeline = await prisma.pipeline.findFirst({
      where: { id: req.params.pipelineId, organizationId: orgId },
      include: { stages: { orderBy: { position: "desc" }, take: 1 } },
    });
    if (!pipeline) throw new ApiError(404, "Funil não encontrado");

    const nextPosition = (pipeline.stages[0]?.position ?? -1) + 1;

    const stage = await prisma.pipelineStage.create({
      data: { pipelineId: pipeline.id, name: data.name, probability: data.probability, kind: data.kind, position: nextPosition },
    });

    res.status(201).json({ stage });
  })
);

router.patch(
  "/stages/:stageId",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const data = updateStageSchema.parse(req.body);
    const stage = await findStageInOrg(req.params.stageId, req.user!.orgId);
    if (!stage) throw new ApiError(404, "Etapa não encontrada");

    const updated = await prisma.pipelineStage.update({ where: { id: stage.id }, data });
    res.json({ stage: updated });
  })
);

router.post(
  "/:pipelineId/stages/reorder",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const { stageIds } = reorderStagesSchema.parse(req.body);

    const pipeline = await prisma.pipeline.findFirst({
      where: { id: req.params.pipelineId, organizationId: orgId },
      include: { stages: { select: { id: true } } },
    });
    if (!pipeline) throw new ApiError(404, "Funil não encontrado");

    const owned = new Set(pipeline.stages.map((s) => s.id));
    if (stageIds.length !== owned.size || stageIds.some((id) => !owned.has(id))) {
      throw new ApiError(400, "A reordenação precisa listar exatamente as etapas desse funil");
    }

    // (pipelineId, position) is unique, so positions are first parked in a
    // range that cannot collide with the final one, then written for real.
    await prisma.$transaction(async (tx) => {
      for (const [index, id] of stageIds.entries()) {
        await tx.pipelineStage.update({ where: { id }, data: { position: 1000 + index } });
      }
      for (const [index, id] of stageIds.entries()) {
        await tx.pipelineStage.update({ where: { id }, data: { position: index } });
      }
    });

    const stages = await prisma.pipelineStage.findMany({ where: { pipelineId: pipeline.id }, orderBy: { position: "asc" } });
    res.json({ stages });
  })
);

router.delete(
  "/stages/:stageId",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const stage = await findStageInOrg(req.params.stageId, req.user!.orgId);
    if (!stage) throw new ApiError(404, "Etapa não encontrada");

    // Deleting a stage cascades to its deals, so refuse while any still sit in
    // it — losing negotiations to a column tidy-up would be indefensible.
    const dealCount = await prisma.deal.count({ where: { stageId: stage.id } });
    if (dealCount > 0) {
      throw new ApiError(400, `Mova os ${dealCount} negócio(s) dessa etapa antes de excluí-la`);
    }

    await prisma.pipelineStage.delete({ where: { id: stage.id } });
    res.json({ ok: true });
  })
);

export default router;
