"use server";

import { redirect } from "next/navigation";

import { action } from "@/lib/server/action";
import {
  consultationEditableSchema,
  consultationFormSchema,
  consultationIdSchema,
  createConsultation,
  updateConsultation,
} from "@/services/consultations";

function fromForm(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(formData.entries());
}

const createConsultationCommand = action({
  audit: "consultation.create",
  permission: "consultation.create",
  schema: consultationFormSchema,
  entityType: "Consultation",
  revalidate: (input) => ["/patients", `/patients/${input.patientId}`],
  run: ({ input, ctx, unit }) => createConsultation(ctx, input, unit),
});

export async function createConsultationAction(_previous: unknown, formData: FormData) {
  const result = await createConsultationCommand(fromForm(formData));
  if (result.ok) redirect(`/consultations/${result.data.id}`);
  return result;
}

const updateConsultationSchema = consultationIdSchema.extend(consultationEditableSchema.shape);

const updateConsultationCommand = action({
  audit: "consultation.update",
  permission: "consultation.update",
  schema: updateConsultationSchema,
  entityType: "Consultation",
  revalidate: (input) => [`/consultations/${input.id}`],
  run: ({ input, ctx, unit }) => {
    const { id, ...patch } = input;
    return updateConsultation(ctx, id, patch, unit);
  },
});

export async function updateConsultationAction(_previous: unknown, formData: FormData) {
  const result = await updateConsultationCommand(fromForm(formData));
  if (result.ok) redirect(`/consultations/${result.data.id}`);
  return result;
}
