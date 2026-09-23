"use server";

import { redirect } from "next/navigation";

import { action } from "@/lib/server/action";
import {
  createPatient,
  patientFormSchema,
  patientIdSchema,
  setPatientActive,
  updatePatient,
} from "@/services/patients";

/** `<form action={fn}>` and `useActionState` both hand us a FormData; the
 * service schemas want a plain object. Every field in the patient form is a
 * text input or select, so `Object.fromEntries` is exact — nothing here reads
 * a file or a repeated field name. */
function fromForm(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(formData.entries());
}

const createPatientCommand = action({
  audit: "patient.create",
  permission: "patient.create",
  schema: patientFormSchema,
  entityType: "Patient",
  revalidate: () => ["/patients"],
  run: ({ input, ctx, unit }) => createPatient(ctx, input, unit),
});

export async function createPatientAction(_previous: unknown, formData: FormData) {
  const result = await createPatientCommand(fromForm(formData));
  if (result.ok) redirect(`/patients/${result.data.id}`);
  return result;
}

const updatePatientSchema = patientIdSchema.extend(patientFormSchema.shape);

const updatePatientCommand = action({
  audit: "patient.update",
  permission: "patient.update",
  schema: updatePatientSchema,
  entityType: "Patient",
  revalidate: (input) => ["/patients", `/patients/${input.id}`],
  run: ({ input, ctx, unit }) => {
    const { id, ...patch } = input;
    return updatePatient(ctx, id, patch, unit);
  },
});

export async function updatePatientAction(_previous: unknown, formData: FormData) {
  const result = await updatePatientCommand(fromForm(formData));
  if (result.ok) redirect(`/patients/${result.data.id}`);
  return result;
}

const deactivatePatientCommand = action({
  audit: "patient.deactivate",
  // Closest permission in the vocabulary to "remove from daily use" without a
  // separate deactivate permission the module would own alone.
  permission: "patient.delete",
  schema: patientIdSchema,
  entityType: "Patient",
  revalidate: (input) => ["/patients", `/patients/${input.id}`],
  run: ({ input, ctx, unit }) => setPatientActive(ctx, input.id, false, unit),
});

export async function deactivatePatientAction(formData: FormData) {
  await deactivatePatientCommand(fromForm(formData));
}

const reactivatePatientCommand = action({
  audit: "patient.reactivate",
  permission: "patient.update",
  schema: patientIdSchema,
  entityType: "Patient",
  revalidate: (input) => ["/patients", `/patients/${input.id}`],
  run: ({ input, ctx, unit }) => setPatientActive(ctx, input.id, true, unit),
});

export async function reactivatePatientAction(formData: FormData) {
  await reactivatePatientCommand(fromForm(formData));
}
