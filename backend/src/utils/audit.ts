import { Request } from "express";
import { prisma } from "../config/prisma";

interface AuditParams {
  action: string;
  req?: Request;
  organizationId?: string | null;
  userId?: string | null;
  details?: Record<string, unknown>;
}

// Fire-and-forget audit logging: never let a logging failure break the request.
export async function audit({ action, req, organizationId, userId, details }: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        organizationId: organizationId ?? null,
        userId: userId ?? null,
        ipAddress: req?.ip,
        userAgent: req?.headers["user-agent"],
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log", err);
  }
}
