import { Router } from "express";
import { prisma } from "../config/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { createUserSchema, updateUserSchema } from "../validators/auth";
import { hashPassword, isPasswordStrongEnough } from "../utils/password";
import { ApiError } from "../middleware/errorHandler";
import { audit } from "../utils/audit";

const router = Router();

router.use(requireAuth);

// All queries are scoped to req.user.orgId — this is the multi-tenant
// isolation boundary. Never accept an organizationId from the client.

router.get(
  "/",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.orgId },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json({ users });
  })
);

router.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createUserSchema.parse(req.body);

    if (!isPasswordStrongEnough(data.password)) {
      throw new ApiError(400, "Password must be at least 10 characters and include upper, lower case and a number");
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ApiError(409, "A user with this email already exists");
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        organizationId: req.user!.orgId,
        name: data.name,
        email: data.email,
        role: data.role,
        passwordHash,
      },
    });

    await audit({ action: "user.create", req, userId: req.user!.sub, organizationId: req.user!.orgId, details: { createdUserId: user.id, role: user.role } });

    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive } });
  })
);

router.patch(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = updateUserSchema.parse(req.body);

    const target = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: req.user!.orgId } });
    if (!target) {
      throw new ApiError(404, "User not found");
    }

    if (target.id === req.user!.sub && data.role && data.role !== "ADMIN") {
      throw new ApiError(400, "You cannot demote your own account");
    }

    const updated = await prisma.user.update({ where: { id: target.id }, data });

    await audit({ action: "user.update", req, userId: req.user!.sub, organizationId: req.user!.orgId, details: { targetUserId: target.id, changes: data } });

    res.json({ user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, isActive: updated.isActive } });
  })
);

router.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findFirst({ where: { id: req.params.id, organizationId: req.user!.orgId } });
    if (!target) {
      throw new ApiError(404, "User not found");
    }
    if (target.id === req.user!.sub) {
      throw new ApiError(400, "You cannot deactivate your own account");
    }

    // Soft-delete: deactivate rather than hard-delete, preserving audit/history integrity.
    await prisma.user.update({ where: { id: target.id }, data: { isActive: false } });
    await prisma.refreshToken.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });

    await audit({ action: "user.deactivate", req, userId: req.user!.sub, organizationId: req.user!.orgId, details: { targetUserId: target.id } });

    res.json({ ok: true });
  })
);

export default router;
