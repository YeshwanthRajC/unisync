import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import type { AppointmentStatus } from "@/lib/db/generated/enums";
import { prisma } from "@/lib/db/prisma";
import type { Db } from "@/lib/db/types";
import { orgWhere } from "@/lib/db/scope";
import { NotFoundError } from "@/lib/server/errors";
import { dayBoundsInZone } from "@/services/appointments/rules";

const OPEN_STATUSES: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"];

const PATIENT_SUMMARY = { select: { id: true, fullName: true, phone: true } } as const;

export async function listAppointmentsForDay(
  ctx: OrganizationContext,
  dateKey: string,
  timeZone: string,
  db: Db = prisma,
) {
  const { start, end } = dayBoundsInZone(dateKey, timeZone);

  return db.appointment.findMany({
    where: orgWhere(ctx, { scheduledAt: { gte: start, lt: end } }),
    orderBy: { scheduledAt: "asc" },
    include: { patient: PATIENT_SUMMARY },
  });
}

export async function getAppointmentOrThrow(
  ctx: OrganizationContext,
  id: string,
  db: Db = prisma,
) {
  const appointment = await db.appointment.findFirst({
    where: orgWhere(ctx, { id }),
    include: { patient: PATIENT_SUMMARY },
  });

  if (!appointment) throw new NotFoundError("appointment");
  return appointment;
}

export async function listAppointmentsForPatient(
  ctx: OrganizationContext,
  patientId: string,
  db: Db = prisma,
) {
  return db.appointment.findMany({
    where: orgWhere(ctx, { patientId }),
    orderBy: { scheduledAt: "desc" },
  });
}

/** For Organization Pulse: appointments still ahead of now today. */
export async function countUpcomingToday(
  ctx: OrganizationContext,
  timeZone: string,
  db: Db = prisma,
): Promise<number> {
  const now = new Date();
  const { end } = dayBoundsInZone(
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(now),
    timeZone,
  );

  return db.appointment.count({
    where: orgWhere(ctx, {
      scheduledAt: { gte: now, lt: end },
      status: { in: OPEN_STATUSES },
    }),
  });
}
