import { z } from "zod";

/**
 * Input schema for the consultations module. No `server-only`: the
 * create/edit form imports this directly.
 *
 * No `rules.ts` in this module — unlike patients (age calculation) or
 * appointments (the status state machine, timezone conversions), a
 * consultation has no pure business logic worth extracting yet. The five-file
 * shape is a convention for when a module needs it, not a template to fill in
 * regardless.
 */

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const consultationFormSchema = z.object({
  patientId: z.uuid("Choose a patient."),
  // Set once, at creation, from the appointment being recorded against (if
  // any) — never edited afterward, so "which visit was this?" can't drift.
  appointmentId: z.uuid().optional().or(z.literal("")),
  chiefComplaint: optionalText(500),
  diagnosis: optionalText(1000),
  treatment: optionalText(1000),
  notes: optionalText(2000),
  followUpNeeded: z.coerce.boolean().optional(),
});

export type ConsultationFormInput = z.infer<typeof consultationFormSchema>;

/** `patientId` and `appointmentId` are set once at creation and never edited
 * afterward, so "which visit was this?" can't drift after the fact. */
export const consultationEditableSchema = consultationFormSchema.omit({
  patientId: true,
  appointmentId: true,
});

export type ConsultationUpdateInput = z.infer<typeof consultationEditableSchema>;

export const consultationIdSchema = z.object({ id: z.uuid() });
