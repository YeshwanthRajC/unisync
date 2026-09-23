import { z } from "zod";

/**
 * Input schemas for the patients module.
 *
 * No `server-only` guard: the create/edit form imports these directly so the
 * same rules run client-side before a round trip to the server.
 */

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const patientFormSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the patient's name.").max(120),
  phone: optionalText(32),
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  dateOfBirth: optionalText(10), // yyyy-mm-dd from <input type="date">
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"]),
  addressLine: optionalText(200),
  city: optionalText(80),
  state: optionalText(80),
  postalCode: optionalText(16),
  emergencyContactName: optionalText(120),
  emergencyContactPhone: optionalText(32),
  notes: optionalText(2000),
});

export type PatientFormInput = z.infer<typeof patientFormSchema>;

export const patientFilterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ACTIVE"),
});

export type PatientFilter = z.infer<typeof patientFilterSchema>;

export const patientIdSchema = z.object({
  id: z.uuid(),
});
