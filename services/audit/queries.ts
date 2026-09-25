import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Db } from "@/lib/db/types";
import { orgWhere } from "@/lib/db/scope";

export type AuditLogFilters = {
  actorType?: "USER" | "AI_AGENT" | "SYSTEM" | "ALL";
  entityType?: string;
  limit?: number;
  offset?: number;
};

export async function listAuditLogs(
  ctx: OrganizationContext,
  filters: AuditLogFilters = {},
  db: Db = prisma,
) {
  const where: Record<string, unknown> = {};

  if (filters.actorType && filters.actorType !== "ALL") {
    where.actorType = filters.actorType;
  }

  if (filters.entityType && filters.entityType !== "ALL") {
    where.entityType = filters.entityType;
  }

  return db.auditLog.findMany({
    where: orgWhere(ctx, where),
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 50,
    skip: filters.offset ?? 0,
    include: {
      actorProfile: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });
}

export async function countAuditLogs(
  ctx: OrganizationContext,
  filters: AuditLogFilters = {},
  db: Db = prisma,
): Promise<number> {
  const where: Record<string, unknown> = {};

  if (filters.actorType && filters.actorType !== "ALL") {
    where.actorType = filters.actorType;
  }

  if (filters.entityType && filters.entityType !== "ALL") {
    where.entityType = filters.entityType;
  }

  return db.auditLog.count({
    where: orgWhere(ctx, where),
  });
}
