import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Db } from "@/lib/db/types";
import { orgWhere } from "@/lib/db/scope";

export async function listNotifications(
  ctx: OrganizationContext,
  filters: { unreadOnly?: boolean; limit?: number } = {},
  db: Db = prisma,
) {
  const where: Record<string, unknown> = {};

  if (filters.unreadOnly) {
    where.readAt = null;
  }

  return db.notification.findMany({
    where: orgWhere(ctx, where),
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 50,
  });
}

export async function countUnreadNotifications(
  ctx: OrganizationContext,
  db: Db = prisma,
): Promise<number> {
  return db.notification.count({
    where: orgWhere(ctx, { readAt: null }),
  });
}
