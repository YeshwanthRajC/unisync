import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { orgScope, orgWhere } from "@/lib/db/scope";
import type { UnitOfWork } from "@/lib/server/unit";
import { getPatientOrThrow } from "@/services/patients/queries";
import type { PatientFormInput } from "@/services/patients/schema";

/** `""` from an optional form field becomes `null`, never a stored empty string. */
function orNull(value: string | undefined): string | null {
  return value ? value : null;
}

function parseDateOfBirth(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function patientData(input: PatientFormInput) {
  return {
    fullName: input.fullName,
    phone: orNull(input.phone),
    email: orNull(input.email),
    dateOfBirth: parseDateOfBirth(input.dateOfBirth),
    gender: input.gender,
    addressLine: orNull(input.addressLine),
    city: orNull(input.city),
    state: orNull(input.state),
    postalCode: orNull(input.postalCode),
    emergencyContactName: orNull(input.emergencyContactName),
    emergencyContactPhone: orNull(input.emergencyContactPhone),
    notes: orNull(input.notes),
  };
}

export async function createPatient(
  ctx: OrganizationContext,
  input: PatientFormInput,
  unit: UnitOfWork,
) {
  const patient = await unit.db.patient.create({
    data: { ...patientData(input), ...orgScope(ctx) },
  });

  unit.target("Patient", patient.id);
  unit.note({ fullName: patient.fullName });

  return patient;
}

export async function updatePatient(
  ctx: OrganizationContext,
  id: string,
  input: PatientFormInput,
  unit: UnitOfWork,
) {
  // Confirms the row exists and belongs to this tenant before the write, so a
  // guessed id from another organization gets "not found", never a silent
  // cross-tenant no-op or, via the tripwire, a 500.
  await getPatientOrThrow(ctx, id, unit.db);

  const patient = await unit.db.patient.update({
    where: orgWhere(ctx, { id }),
    data: patientData(input),
  });

  unit.target("Patient", patient.id);
  unit.note({ fullName: patient.fullName });

  return patient;
}

/**
 * Soft-deactivate or reactivate. Clinical records are never hard-deleted.
 *
 * Deactivating is gated behind `patient.delete` — the closest permission in the
 * vocabulary to "remove this patient from daily use" — while reactivating only
 * needs `patient.update`, since restoring visibility is not itself destructive.
 * The action layer, not this function, decides which permission a given caller
 * needed to reach it.
 */
export async function setPatientActive(
  ctx: OrganizationContext,
  id: string,
  isActive: boolean,
  unit: UnitOfWork,
) {
  await getPatientOrThrow(ctx, id, unit.db);

  const patient = await unit.db.patient.update({
    where: orgWhere(ctx, { id }),
    data: { isActive },
  });

  unit.target("Patient", patient.id);
  unit.note({ isActive });

  return patient;
}
