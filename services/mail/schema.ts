import { z } from "zod";

/**
 * Input schemas for the patient mail module.
 * No `server-only`: client components import these to validate before submitting.
 */

export const PATIENT_EMAIL_STATUSES = [
  "DRAFT",
  "QUEUED",
  "SENT",
  "FAILED",
  "PROVIDER_NOT_CONFIGURED",
] as const;

export type PatientEmailStatus = (typeof PATIENT_EMAIL_STATUSES)[number];

export const PATIENT_EMAIL_STATUS_LABELS: Record<PatientEmailStatus, string> = {
  DRAFT: "Draft",
  QUEUED: "Queued",
  SENT: "Sent",
  FAILED: "Failed",
  PROVIDER_NOT_CONFIGURED: "Provider Not Configured (Preview)",
};

export const emailDraftSchema = z.object({
  patientId: z.uuid("Select a patient."),
  recipient: z.string().trim().email("Enter a valid recipient email address."),
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  body: z.string().trim().min(1, "Email body cannot be empty.").max(10000),
  relatedAppointmentId: z.uuid().optional().or(z.literal("")),
  relatedBillId: z.uuid().optional().or(z.literal("")),
  relatedFollowUpId: z.uuid().optional().or(z.literal("")),
  generatedByAI: z.boolean().optional().default(false),
});

export type EmailDraftInput = z.input<typeof emailDraftSchema>;

export const updateDraftSchema = z.object({
  id: z.uuid(),
  recipient: z.string().trim().email("Enter a valid recipient email address."),
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  body: z.string().trim().min(1, "Email body cannot be empty.").max(10000),
});

export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;

export const sendEmailSchema = z.object({
  id: z.uuid(),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;

export const emailIdSchema = z.object({ id: z.uuid() });
export type EmailIdInput = z.infer<typeof emailIdSchema>;

export const AI_DRAFT_TOPICS = [
  "APPOINTMENT_REMINDER",
  "POST_TREATMENT_CARE",
  "FOLLOW_UP_RECALL",
  "OVERDUE_BILL_REMINDER",
  "GENERAL_ANNOUNCEMENT",
] as const;

export type AiDraftTopic = (typeof AI_DRAFT_TOPICS)[number];

export const AI_DRAFT_TOPIC_LABELS: Record<AiDraftTopic, string> = {
  APPOINTMENT_REMINDER: "Appointment Reminder",
  POST_TREATMENT_CARE: "Post-Treatment Care Instructions",
  FOLLOW_UP_RECALL: "Recall / Follow-up Invitation",
  OVERDUE_BILL_REMINDER: "Outstanding Balance Friendly Reminder",
  GENERAL_ANNOUNCEMENT: "General Clinic Note",
};

export const aiDraftPromptSchema = z.object({
  patientId: z.uuid("Choose a patient to draft an email for."),
  topic: z.enum(AI_DRAFT_TOPICS),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type AiDraftPromptInput = z.infer<typeof aiDraftPromptSchema>;

export const emailListParamsSchema = z.object({
  status: z
    .enum(["ALL", "DRAFT", "QUEUED", "SENT", "FAILED", "PROVIDER_NOT_CONFIGURED"])
    .optional()
    .default("ALL"),
  patientId: z.uuid().optional(),
});

export type EmailListParams = z.infer<typeof emailListParamsSchema>;
