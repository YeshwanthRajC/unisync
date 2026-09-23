import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { orgScope } from "@/lib/db/scope";
import { RuleViolationError } from "@/lib/server/errors";
import type { UnitOfWork } from "@/lib/server/unit";
import { getConsultationOrThrow } from "@/services/consultations";
import { getPatientOrThrow } from "@/services/patients";
import type { PrescriptionFormInput } from "@/services/prescriptions/schema";

/**
 * Prescriptions are create-only: once issued, items are never rewritten in
 * place (see the model comment in `prisma/schema.prisma`). A correction is a
 * new prescription, so history always reads as what was actually handed to
 * the patient at the time.
 */
export async function createPrescription(
  ctx: OrganizationContext,
  input: PrescriptionFormInput,
  unit: UnitOfWork,
) {
  await getPatientOrThrow(ctx, input.patientId, unit.db);

  if (input.consultationId) {
    const consultation = await getConsultationOrThrow(ctx, input.consultationId, unit.db);
    if (consultation.patientId !== input.patientId) {
      throw new RuleViolationError(
        "That consultation belongs to a different patient.",
      );
    }
  }

  const prescription = await unit.db.prescription.create({
    data: {
      patientId: input.patientId,
      consultationId: input.consultationId || null,
      instructions: input.instructions || null,
      ...orgScope(ctx),
      items: {
        create: input.items.map((item, index) => ({
          medicine: item.medicine,
          dosage: item.dosage || null,
          frequency: item.frequency || null,
          durationDays: item.durationDays ?? null,
          instructions: item.instructions || null,
          position: index,
        })),
      },
    },
    include: { items: { orderBy: { position: "asc" } } },
  });

  unit.target("Prescription", prescription.id);
  unit.note({ patientId: prescription.patientId, itemCount: prescription.items.length });

  return prescription;
}
