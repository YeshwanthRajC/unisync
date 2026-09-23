import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Db } from "@/lib/db/types";
import { orgWhere } from "@/lib/db/scope";
import { NotFoundError } from "@/lib/server/errors";

export async function listConsultationsForPatient(
  ctx: OrganizationContext,
  patientId: string,
  db: Db = prisma,
) {
  return db.consultation.findMany({
    where: orgWhere(ctx, { patientId }),
    orderBy: { consultedAt: "desc" },
  });
}

export async function getConsultationOrThrow(
  ctx: OrganizationContext,
  id: string,
  db: Db = prisma,
) {
  const consultation = await db.consultation.findFirst({
    where: orgWhere(ctx, { id }),
  });

  if (!consultation) throw new NotFoundError("consultation");
  return consultation;
}

/** Is there already a consultation recorded against this appointment? The
 * relation is one-to-one, so the "Record consultation" shortcut needs this to
 * decide whether to offer "Record" or "View". */
export async function getConsultationForAppointment(
  ctx: OrganizationContext,
  appointmentId: string,
  db: Db = prisma,
) {
  return db.consultation.findFirst({
    where: orgWhere(ctx, { appointmentId }),
  });
}
