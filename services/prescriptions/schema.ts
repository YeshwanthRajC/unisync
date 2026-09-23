import { z } from "zod";

/**
 * Input schema for the prescriptions module. No `server-only`.
 *
 * No `rules.ts`: nothing here is pure business logic beyond validation, which
 * Zod already expresses.
 */

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const prescriptionItemSchema = z.object({
  medicine: z.string().trim().min(1, "Enter a medicine.").max(200),
  dosage: optionalText(100),
  frequency: optionalText(100),
  durationDays: z.coerce.number().int().min(1).max(365).optional(),
  instructions: optionalText(500),
});

export type PrescriptionItemInput = z.infer<typeof prescriptionItemSchema>;

export const prescriptionFormSchema = z.object({
  patientId: z.uuid("Choose a patient."),
  consultationId: z.uuid().optional().or(z.literal("")),
  instructions: optionalText(1000),
  items: z.array(prescriptionItemSchema).min(1, "Add at least one medicine."),
});

export type PrescriptionFormInput = z.infer<typeof prescriptionFormSchema>;

export const prescriptionIdSchema = z.object({ id: z.uuid() });
