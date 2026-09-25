import { z } from "zod";

/**
 * Input schemas for the follow-ups module.
 * No `server-only`: client components import these to validate before submitting.
 */

export const FOLLOWUP_STATUSES = [
  "PENDING",
  "DUE",
  "OVERDUE",
  "COMPLETED",
  "CANCELLED",
] as const;

export type FollowUpStatus = (typeof FOLLOWUP_STATUSES)[number];

export const FOLLOWUP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  PENDING: "Pending",
  DUE: "Due Today",
  OVERDUE: "Overdue",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const followUpFormSchema = z.object({
  patientId: z.uuid("Choose a patient."),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format."),
  reason: z.string().trim().min(2, "Reason is required.").max(500),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  appointmentId: z.uuid().optional().or(z.literal("")),
  consultationId: z.uuid().optional().or(z.literal("")),
  assignedToProfileId: z.uuid().optional().or(z.literal("")),
});

export type FollowUpFormInput = z.infer<typeof followUpFormSchema>;

export const followUpUpdateSchema = z.object({
  id: z.uuid(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format."),
  reason: z.string().trim().min(2, "Reason is required.").max(500),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  assignedToProfileId: z.uuid().optional().or(z.literal("")),
});

export type FollowUpUpdateInput = z.infer<typeof followUpUpdateSchema>;

export const completeFollowUpSchema = z.object({
  id: z.uuid(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>;

export const cancelFollowUpSchema = z.object({
  id: z.uuid(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CancelFollowUpInput = z.infer<typeof cancelFollowUpSchema>;

export const followUpIdSchema = z.object({ id: z.uuid() });

export const followUpListParamsSchema = z.object({
  status: z
    .enum(["ALL", "PENDING", "DUE", "OVERDUE", "COMPLETED", "CANCELLED"])
    .optional()
    .default("ALL"),
  patientId: z.uuid().optional(),
});

export type FollowUpListParams = z.infer<typeof followUpListParamsSchema>;
