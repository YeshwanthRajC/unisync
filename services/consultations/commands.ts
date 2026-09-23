import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { orgScope, orgWhere } from "@/lib/db/scope";
import { ConflictError, RuleViolationError } from "@/lib/server/errors";
import type { UnitOfWork } from "@/lib/server/unit";
import { getAppointmentOrThrow } from "@/services/appointments/queries";
import { getPatientOrThrow } from "@/services/patients";
import {
  getConsultationForAppointment,
  getConsultationOrThrow,
} from "@/services/consultations/queries";
import type {
  ConsultationFormInput,
  ConsultationUpdateInput,
} from "@/services/consultations/schema";

/**
 * Recording a consultation deliberately does NOT change the appointment's
 * status — that stays a separate, explicit human act via `closeAppointment`.
 * This function never writes to the `appointments` table.
 */
export async function createConsultation(
  ctx: OrganizationContext,
  input: ConsultationFormInput,
  unit: UnitOfWork,
) {
  await getPatientOrThrow(ctx, input.patientId, unit.db);

  if (input.appointmentId) {
    const appointment = await getAppointmentOrThrow(ctx, input.appointmentId, unit.db);
    if (appointment.patientId !== input.patientId) {
      throw new RuleViolationError(
        "That appointment belongs to a different patient.",
      );
    }
    const existing = await getConsultationForAppointment(ctx, input.appointmentId, unit.db);
    if (existing) {
      throw new ConflictError("This appointment already has a consultation recorded.");
    }
  }

  const consultation = await unit.db.consultation.create({
    data: {
      patientId: input.patientId,
      appointmentId: input.appointmentId || null,
      chiefComplaint: input.chiefComplaint || null,
      diagnosis: input.diagnosis || null,
      treatment: input.treatment || null,
      notes: input.notes || null,
      followUpNeeded: input.followUpNeeded ?? false,
      recordedByProfileId: ctx.profileId,
      ...orgScope(ctx),
    },
  });

  unit.target("Consultation", consultation.id);
  unit.note({ patientId: consultation.patientId });

  return consultation;
}

export async function updateConsultation(
  ctx: OrganizationContext,
  id: string,
  input: ConsultationUpdateInput,
  unit: UnitOfWork,
) {
  await getConsultationOrThrow(ctx, id, unit.db);

  const consultation = await unit.db.consultation.update({
    where: orgWhere(ctx, { id }),
    data: {
      chiefComplaint: input.chiefComplaint || null,
      diagnosis: input.diagnosis || null,
      treatment: input.treatment || null,
      notes: input.notes || null,
      followUpNeeded: input.followUpNeeded ?? false,
    },
  });

  unit.target("Consultation", consultation.id);
  return consultation;
}
