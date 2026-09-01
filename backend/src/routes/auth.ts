import { Router } from "express";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { verifyPassword, hashPassword, isPasswordStrongEnough } from "../utils/password";
import { issueTokens, rotateRefreshToken, revokeRefreshToken } from "../services/authService";
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from "../utils/cookies";
import {
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth";
import { Role } from "../types/roles";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";
import { audit } from "../utils/audit";
import { ApiError } from "../middleware/errorHandler";
import { generateRefreshToken, hashToken } from "../utils/tokens";
import { sendEmail, passwordResetEmail, emailIsConfigured } from "../services/email";

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

/**
 * Change your own password, proving you know the current one.
 *
 * Requiring the current password is what stops a hijacked session from locking
 * the real owner out. On success every *other* session is revoked and this one
 * is re-issued, so the person doing the change stays logged in while anyone who
 * had stolen a token does not.
 */
router.post(
  "/change-password",
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      await audit({ action: "auth.password.change.failed", req, userId: user.id, organizationId: user.organizationId });
      throw new ApiError(400, "Senha atual incorreta");
    }

    if (!isPasswordStrongEnough(newPassword)) {
      throw new ApiError(400, "A nova senha precisa ter ao menos 10 caracteres, com maiúscula, minúscula e número");
    }
    if (await verifyPassword(newPassword, user.passwordHash)) {
      throw new ApiError(400, "A nova senha precisa ser diferente da atual");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const issued = await issueTokens({ userId: user.id, orgId: user.organizationId, role: user.role as Role, req });
    setAuthCookies(res, issued.accessToken, issued.refreshToken);

    await audit({ action: "auth.password.change", req, userId: user.id, organizationId: user.organizationId });

    res.json({ ok: true });
  })
);

/**
 * Start a password reset.
 *
 * Always answers the same way, whether or not the address exists. Telling the
 * caller "no such user" would turn this into a free account-enumeration oracle,
 * which is worse than the small confusion of a silent no-op.
 */
router.post(
  "/forgot-password",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      // Any earlier link becomes useless the moment a new one is requested.
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const { token, tokenHash } = generateRefreshToken();
      const expiresAt = new Date(Date.now() + env.passwordResetTtlMinutes * 60_000);

      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt, ipAddress: req.ip, userAgent: req.headers["user-agent"] },
      });

      const link = `${env.appUrl.replace(/\/$/, "")}/redefinir-senha?token=${token}`;
      const message = passwordResetEmail(user.name, link, env.passwordResetTtlMinutes);
      const result = await sendEmail({ ...message, to: user.email });

      await audit({
        action: result.delivered ? "auth.password.reset.requested" : "auth.password.reset.undelivered",
        req,
        userId: user.id,
        organizationId: user.organizationId,
        details: { provider: result.provider, error: result.error },
      });
    }

    res.json({
      ok: true,
      // Surfacing this is a deployment aid, not a leak: it says nothing about
      // whether the address exists, only whether this server can send mail.
      emailConfigured: emailIsConfigured(),
    });
  })
);

/** Finish a reset: spend the token, set the new password, drop every session. */
router.post(
  "/reset-password",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    // One message for every failure mode — expired, already spent, never
    // existed — so a probe cannot tell them apart.
    const invalid = !record || record.usedAt !== null || record.expiresAt < new Date() || !record.user.isActive;
    if (invalid) {
      throw new ApiError(400, "Esse link expirou ou já foi usado. Peça um novo.");
    }

    if (!isPasswordStrongEnough(newPassword)) {
      throw new ApiError(400, "A nova senha precisa ter ao menos 10 caracteres, com maiúscula, minúscula e número");
    }

    await prisma.$transaction([
      prisma.passwordResetToken.update({ where: { id: record!.id }, data: { usedAt: new Date() } }),
      prisma.user.update({
        where: { id: record!.userId },
        // Clearing the lockout matters: being locked out is a common reason for
        // resetting in the first place.
        data: { passwordHash: await hashPassword(newPassword), failedLoginCount: 0, lockedUntil: null },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: record!.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await audit({
      action: "auth.password.reset.completed",
      req,
      userId: record!.userId,
      organizationId: record!.user.organizationId,
    });

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
