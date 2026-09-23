"use server";

import { redirect } from "next/navigation";

import { action } from "@/lib/server/action";
import { createPrescription, prescriptionFormSchema } from "@/services/prescriptions";

const createPrescriptionCommand = action({
  audit: "prescription.create",
  permission: "prescription.create",
  schema: prescriptionFormSchema,
  entityType: "Prescription",
  revalidate: (input) => ["/patients", `/patients/${input.patientId}`],
  run: ({ input, ctx, unit }) => createPrescription(ctx, input, unit),
});

export async function createPrescriptionAction(_previous: unknown, formData: FormData) {
  // `items` is the one field that isn't flat — the client form keeps it in
  // sync as a JSON string in a hidden input, since FormData has no native way
  // to carry an array of objects.
  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  const itemsRaw = formData.get("items");
  try {
    raw.items = typeof itemsRaw === "string" ? JSON.parse(itemsRaw) : [];
  } catch {
    raw.items = [];
  }

  const result = await createPrescriptionCommand(raw);
  if (result.ok) redirect(`/patients/${result.data.patientId}`);
  return result;
}
