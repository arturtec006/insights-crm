import { Router } from "express";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { verifyPassword } from "../utils/password";
import { issueTokens, rotateRefreshToken, revokeRefreshToken } from "../services/authService";
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from "../utils/cookies";
import { loginSchema } from "../validators/auth";
import { Role } from "../types/roles";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";
import { audit } from "../utils/audit";

const router = Router();

router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Constant-shaped response whether the user exists or not, to avoid
    // leaking which emails are registered via response differences.
    const genericError = () => res.status(401).json({ error: "Invalid email or password" });

    if (!user || !user.isActive) {
      await audit({ action: "auth.login.failed", req, details: { email, reason: "no_such_user_or_inactive" } });
      return genericError();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await audit({ action: "auth.login.blocked_locked", req, userId: user.id, organizationId: user.organizationId });
      res.status(423).json({ error: "Account temporarily locked due to repeated failed attempts. Try again later." });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const failedLoginCount = user.failedLoginCount + 1;
      const shouldLock = failedLoginCount >= env.maxFailedLoginAttempts;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount,
          lockedUntil: shouldLock ? new Date(Date.now() + env.lockoutMinutes * 60 * 1000) : null,
        },
      });
      await audit({ action: "auth.login.failed", req, userId: user.id, organizationId: user.organizationId, details: { shouldLock } });
      return genericError();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const { accessToken, refreshToken } = await issueTokens({
      userId: user.id,
      orgId: user.organizationId,
      role: user.role as Role,
      req,
    });
    setAuthCookies(res, accessToken, refreshToken);

    await audit({ action: "auth.login.success", req, userId: user.id, organizationId: user.organizationId });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId },
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const presented = req.cookies?.[REFRESH_COOKIE];
    if (!presented) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const result = await rotateRefreshToken(presented, req);
    if ("error" in result) {
      clearAuthCookies(res);
      if (result.error === "reuse_detected") {
        await audit({ action: "auth.refresh.reuse_detected", req });
      }
      res.status(401).json({ error: "Session expired, please log in again" });
      return;
    }

    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        organizationId: result.user.organizationId,
      },
    });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const presented = req.cookies?.[REFRESH_COOKIE];
    if (presented) {
      await revokeRefreshToken(presented);
    }
    clearAuthCookies(res);
    res.json({ ok: true });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId },
    });
  })
);

export default router;
