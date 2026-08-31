import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { signAccessToken, generateRefreshToken, hashToken } from "../utils/tokens";
import { Role } from "../types/roles";
import { Request } from "express";

interface IssueTokensParams {
  userId: string;
  orgId: string;
  role: Role;
  req?: Request;
}

export async function issueTokens({ userId, orgId, role, req }: IssueTokensParams) {
  const accessToken = signAccessToken({ sub: userId, orgId, role });
  const { token: refreshToken, tokenHash } = generateRefreshToken();

  const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: req?.ip,
      userAgent: req?.headers["user-agent"],
    },
  });

  return { accessToken, refreshToken };
}

// Rotates a refresh token: validates it, revokes it, and issues a new pair.
// If a token is presented that was already revoked, this is a strong signal
// of token theft (someone replayed a stolen token) — revoke the whole family.
export async function rotateRefreshToken(presentedToken: string, req?: Request) {
  const tokenHash = hashToken(presentedToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) return { error: "invalid" as const };

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { error: "reuse_detected" as const };
  }

  if (stored.expiresAt < new Date()) {
    return { error: "expired" as const };
  }

  if (!stored.user.isActive) {
    return { error: "invalid" as const };
  }

  const { accessToken, refreshToken } = await issueTokens({
    userId: stored.user.id,
    orgId: stored.user.organizationId,
    role: stored.user.role as Role,
    req,
  });

  const newHash = hashToken(refreshToken);
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedBy: newHash },
  });

  return { accessToken, refreshToken, user: stored.user };
}

export async function revokeRefreshToken(presentedToken: string): Promise<void> {
  const tokenHash = hashToken(presentedToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
