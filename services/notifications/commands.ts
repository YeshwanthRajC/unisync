import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { orgScope, orgWhere } from "@/lib/db/scope";
import type { UnitOfWork } from "@/lib/server/unit";
import type { CreateNotificationInput } from "@/services/notifications/schema";

export async function createNotification(
  ctx: OrganizationContext,
  input: CreateNotificationInput,
  unit: UnitOfWork,
) {
  const notification = await unit.db.notification.create({
    data: {
      title: input.title,
      body: input.body || null,
      severity: input.severity,
      href: input.href || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      ...orgScope(ctx),
    },
  });

  unit.target("Notification", notification.id);
  unit.note({ severity: notification.severity, title: notification.title });
  return notification;
}

export async function markNotificationRead(
  ctx: OrganizationContext,
  id: string,
  unit: UnitOfWork,
) {
  const updated = await unit.db.notification.updateMany({
    where: orgWhere(ctx, { id }),
    data: { readAt: new Date() },
  });

  unit.target("Notification", id);
  return updated;
}

export async function markAllNotificationsRead(
  ctx: OrganizationContext,
  unit: UnitOfWork,
) {
  const updated = await unit.db.notification.updateMany({
    where: orgWhere(ctx, { readAt: null }),
    data: { readAt: new Date() },
  });

  unit.note({ count: updated.count });
  return updated;
}
