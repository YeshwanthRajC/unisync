import "server-only";

import { z } from "zod";

import { defineTool } from "@/lib/ai/tools/define";
import {
  completeFollowUp,
  createFollowUp,
  listFollowUps,
} from "@/services/followups";

export const listFollowUpsTool = defineTool({
  name: "list_followups",
  description: "List patient follow-up reminders and clinical recall tasks with status and patient filtering.",
  permission: "followup.read",
  audit: "followup.read",
  mode: "read",
  input: z.object({
    status: z
      .enum(["ALL", "PENDING", "DUE", "OVERDUE", "COMPLETED", "CANCELLED"])
      .optional()
      .describe("Filter follow-ups by their status."),
    patientId: z.string().optional().describe("Filter follow-ups by patient UUID."),
  }),
  confirmation: { required: false },
  execute: async ({ input, ctx, db }) => {
    const list = await listFollowUps(
      ctx,
      { status: input.status, patientId: input.patientId },
      db,
    );
    return list.slice(0, 15).map((f) => ({
      id: f.id,
      patientId: f.patientId,
      patientName: f.patient.fullName,
      dueDate: f.dueDate.toISOString().slice(0, 10),
      reason: f.reason,
      status: f.status,
      notes: f.notes,
    }));
  },
});

export const scheduleFollowUpTool = defineTool({
  name: "schedule_followup",
  description: "Schedule a future follow-up check, clinical recall, or medication review for a patient.",
  permission: "followup.create",
  audit: "followup.create",
  mode: "write",
  confirmation: {
    required: true,
    describe: (input) =>
      `Schedule follow-up for patient ${input.patientId} due on ${input.dueDate}: ${input.reason}`,
  },
  input: z.object({
    patientId: z.string().describe("UUID of the patient."),
    dueDate: z.string().describe("Target due date in YYYY-MM-DD format."),
    reason: z.string().min(1).describe("Clinical purpose of the follow-up."),
    notes: z.string().optional().describe("Additional guidance or instructions."),
  }),
  execute: async ({ input, ctx, unit }) => {
    const item = await createFollowUp(
      ctx,
      {
        patientId: input.patientId,
        dueDate: input.dueDate,
        reason: input.reason,
        notes: input.notes,
      },
      unit,
    );
    return { id: item.id, dueDate: item.dueDate.toISOString().slice(0, 10), status: item.status };
  },
});

export const completeFollowUpTool = defineTool({
  name: "complete_followup",
  description: "Mark an open follow-up task as completed with outcome notes documenting the interaction.",
  permission: "followup.complete",
  audit: "followup.complete",
  mode: "write",
  confirmation: {
    required: true,
    describe: (input) =>
      `Complete follow-up task ID ${input.id} with notes: "${input.notes}"`,
  },
  input: z.object({
    id: z.string().describe("UUID of the follow-up task to complete."),
    notes: z.string().min(1).describe("Outcome notes summarizing what was completed with the patient."),
  }),
  execute: async ({ input, ctx, unit }) => {
    const item = await completeFollowUp(ctx, input, unit);
    return { id: item.id, status: item.status, completedAt: item.completedAt?.toISOString() };
  },
});
