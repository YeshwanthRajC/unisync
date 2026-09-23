import { z } from "zod";

/**
 * Input schemas for the appointments module. No `server-only`: the create/edit
 * form imports these to validate before submitting.
 */

export const APPOINTMENT_TYPES = [
  "CONSULTATION",
  "CLEANING",
  "FILLING",
  "EXTRACTION",
  "ROOT_CANAL",
  "CROWN_OR_BRIDGE",
  "ORTHODONTIC",
  "FOLLOW_UP",
  "EMERGENCY",
  "OTHER",
] as const;

export const appointmentFormSchema = z.object({
  patientId: z.uuid("Choose a patient."),
  // From <input type="datetime-local">: "YYYY-MM-DDTHH:mm", always interpreted
  // in the organization's timezone at the point it is parsed into a Date.
  scheduledAt: z
    .string()
    .min(1, "Choose a date and time.")
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time."),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(5, "At least 5 minutes.")
    .max(480, "At most 8 hours."),
  type: z.enum(APPOINTMENT_TYPES),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type AppointmentFormInput = z.infer<typeof appointmentFormSchema>;

export const appointmentIdSchema = z.object({ id: z.uuid() });

export const cancelAppointmentSchema = z.object({
  id: z.uuid(),
  cancellationReason: z
    .string()
    .trim()
    .min(3, "Say why this is being cancelled.")
    .max(500),
});

export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const closeAppointmentSchema = z.object({
  id: z.uuid(),
  outcomeNotes: z
    .string()
    .trim()
    .min(3, "Record what happened at the visit.")
    .max(2000),
});

export type CloseAppointmentInput = z.infer<typeof closeAppointmentSchema>;

export const appointmentDaySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
