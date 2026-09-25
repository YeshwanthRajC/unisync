import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Db } from "@/lib/db/types";
import { orgWhere } from "@/lib/db/scope";
import { NotFoundError } from "@/lib/server/errors";
import type { PatientEmailStatus } from "@/services/mail/schema";

export const EMAIL_INCLUDE = {
  patient: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
  },
  sentBy: {
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
  bill: {
    select: {
      id: true,
      number: true,
      total: true,
    },
  },
  followUp: {
    select: {
      id: true,
      dueDate: true,
      reason: true,
    },
  },
} as const;

export async function listPatientEmails(
  ctx: OrganizationContext,
  filters: { status?: PatientEmailStatus | "ALL"; patientId?: string } = {},
  db: Db = prisma,
) {
  const where: Record<string, unknown> = {};

  if (filters.status && filters.status !== "ALL") {
    if (filters.status === "SENT") {
      where.status = { in: ["SENT", "PROVIDER_NOT_CONFIGURED"] };
    } else {
      where.status = filters.status;
    }
  }

  if (filters.patientId) {
    where.patientId = filters.patientId;
  }

  return db.patientEmail.findMany({
    where: orgWhere(ctx, where),
    orderBy: { createdAt: "desc" },
    include: EMAIL_INCLUDE,
  });
}

export async function getPatientEmailOrThrow(
  ctx: OrganizationContext,
  id: string,
  db: Db = prisma,
) {
  const email = await db.patientEmail.findFirst({
    where: orgWhere(ctx, { id }),
    include: EMAIL_INCLUDE,
  });

  if (!email) {
    throw new NotFoundError("Email not found.");
  }

  return email;
}

export async function listEmailsForPatient(
  ctx: OrganizationContext,
  patientId: string,
  db: Db = prisma,
) {
  return db.patientEmail.findMany({
    where: orgWhere(ctx, { patientId }),
    orderBy: { createdAt: "desc" },
    include: EMAIL_INCLUDE,
  });
}

export async function countDraftEmails(
  ctx: OrganizationContext,
  db: Db = prisma,
): Promise<number> {
  return db.patientEmail.count({
    where: orgWhere(ctx, { status: "DRAFT" as PatientEmailStatus }),
  });
}
