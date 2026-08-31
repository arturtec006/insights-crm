import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../middleware/errorHandler";
import { audit } from "../utils/audit";

// The do-not-contact list, exposed so someone can see and audit it. Entries are
// created from a lead (POST /api/leads/:id/suppress); removing one is a
// deliberate act and is therefore logged.

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const entries = await prisma.suppressionEntry.findMany({
      where: { organizationId: req.user!.orgId },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json({ entries });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const orgId = req.user!.orgId;
    const entry = await prisma.suppressionEntry.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!entry) throw new ApiError(404, "Registro não encontrado");

    await prisma.suppressionEntry.delete({ where: { id: entry.id } });

    await audit({
      action: "suppression.delete",
      req,
      userId: req.user!.sub,
      organizationId: orgId,
      details: { kind: entry.kind, value: entry.value },
    });

    res.json({ ok: true });
  })
);

export default router;
