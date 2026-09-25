import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Db } from "@/lib/db/types";
import { orgWhere } from "@/lib/db/scope";
import { NotFoundError } from "@/lib/server/errors";
import type { FollowUpStatus } from "@/services/followups/schema";

export const FOLLOWUP_INCLUDE = {
  patient: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  completedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  appointment: {
    select: {
      id: true,
      scheduledAt: true,
      type: true,
    },
  },
} as const;

export async function listFollowUps(
  ctx: OrganizationContext,
  filters: { status?: FollowUpStatus | "ALL"; patientId?: string } = {},
  db: Db = prisma,
) {
  const where: Record<string, unknown> = {};

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  if (filters.patientId) {
    where.patientId = filters.patientId;
  }

  return db.followUp.findMany({
    where: orgWhere(ctx, where),
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    include: FOLLOWUP_INCLUDE,
  });
}

export async function getFollowUpOrThrow(
  ctx: OrganizationContext,
  id: string,
  db: Db = prisma,
) {
  const followUp = await db.followUp.findFirst({
    where: orgWhere(ctx, { id }),
    include: FOLLOWUP_INCLUDE,
  });

  if (!followUp) {
    throw new NotFoundError("Follow-up not found.");
  }

  return followUp;
}

export async function listFollowUpsForPatient(
  ctx: OrganizationContext,
  patientId: string,
  db: Db = prisma,
) {
  return db.followUp.findMany({
    where: orgWhere(ctx, { patientId }),
    orderBy: { dueDate: "asc" },
    include: FOLLOWUP_INCLUDE,
  });
}

export async function countOpenFollowUps(
  ctx: OrganizationContext,
  db: Db = prisma,
): Promise<number> {
  const openStatuses: FollowUpStatus[] = ["PENDING", "DUE", "OVERDUE"];
  return db.followUp.count({
    where: orgWhere(ctx, {
      status: { in: openStatuses },
    }),
  });
}

export async function countOverdueFollowUps(
  ctx: OrganizationContext,
  db: Db = prisma,
): Promise<number> {
  return db.followUp.count({
    where: orgWhere(ctx, {
      status: "OVERDUE" as FollowUpStatus,
    }),
  });
}
