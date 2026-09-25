import "server-only";

import { z } from "zod";

import { defineTool } from "@/lib/ai/tools/define";
import {
  APPOINTMENT_TYPES,
  cancelAppointment,
  confirmAppointment,
  createAppointment,
  listAppointmentsForDay,
  listAppointmentsForPatient,
  updateAppointment,
} from "@/services/appointments";
import { getCurrentOrganization } from "@/services/organizations";

export const listAppointmentsTool = defineTool({
  name: "list_appointments",
  description: "List scheduled appointments for a specific calendar day (YYYY-MM-DD) or for a specific patient.",
  permission: "appointment.read",
  audit: "appointment.read",
  mode: "read",
  input: z.object({
    dateKey: z
      .string()
      .optional()
      .describe("Calendar date in YYYY-MM-DD format to view the day's schedule."),
    patientId: z
      .string()
      .optional()
      .describe("UUID of a patient to retrieve their appointments."),
  }),
  confirmation: { required: false },
  execute: async ({ input, ctx, db }) => {
    if (input.patientId) {
      const appointments = await listAppointmentsForPatient(ctx, input.patientId, db);
      return appointments.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        scheduledAt: a.scheduledAt.toISOString(),
        durationMinutes: a.durationMinutes,
        status: a.status,
        type: a.type,
        notes: a.notes,
      }));
    }

    const org = await getCurrentOrganization(ctx, db);
    const dateKey = input.dateKey ?? new Date().toISOString().slice(0, 10);
    const dayAppointments = await listAppointmentsForDay(ctx, dateKey, org.timezone, db);
    return dayAppointments.map((a) => ({
      id: a.id,
      patientId: a.patientId,
      patientName: a.patient.fullName,
      scheduledAt: a.scheduledAt.toISOString(),
      durationMinutes: a.durationMinutes,
      status: a.status,
      type: a.type,
      notes: a.notes,
    }));
  },
});

export const scheduleAppointmentTool = defineTool({
  name: "schedule_appointment",
  description:
    "Book a new clinical appointment for a patient at a specific local date and time. IMPORTANT: Never invent appointment details. You MUST ask the user for the specific date, time, duration (minutes), appointment type, and visit notes before scheduling.",
  permission: "appointment.create",
  audit: "appointment.create",
  mode: "write",
  confirmation: {
    required: true,
    describe: (input) =>
      `Schedule ${input.type} appointment for patient ${input.patientId} at ${input.scheduledAt} (${input.durationMinutes} mins)`,
  },
  input: z.object({
    patientId: z.string().describe("UUID of the registered patient."),
    scheduledAt: z
      .string()
      .describe("Date and time in clinic local time (e.g. 2026-09-25T14:30)."),
    durationMinutes: z
      .number()
      .int()
      .min(5)
      .max(480)
      .describe("Duration of the appointment in minutes."),
    type: z.enum(APPOINTMENT_TYPES).describe("Clinical appointment category."),
    notes: z.string().optional().describe("Appointment booking notes or symptoms."),
  }),
  execute: async ({ input, ctx, unit }) => {
    const appointment = await createAppointment(
      ctx,
      {
        patientId: input.patientId,
        scheduledAt: input.scheduledAt.slice(0, 16),
        durationMinutes: input.durationMinutes,
        type: input.type,
        notes: input.notes || "",
      },
      unit,
    );
    return {
      id: appointment.id,
      scheduledAt: appointment.scheduledAt.toISOString(),
      status: appointment.status,
    };
  },
});

export const updateAppointmentTool = defineTool({
  name: "update_appointment",
  description:
    "Update or reschedule an existing appointment (date/time, duration, type, or notes). Only modifies the fields provided and preserves other existing appointment details.",
  permission: "appointment.update",
  audit: "appointment.update",
  mode: "write",
  confirmation: {
    required: true,
    describe: (input) =>
      `Update appointment ID ${input.appointmentId}${input.scheduledAt ? ` to ${input.scheduledAt}` : ""}`,
  },
  input: z.object({
    appointmentId: z.string().describe("UUID of the appointment to update or reschedule."),
    scheduledAt: z
      .string()
      .optional()
      .describe("Updated date and time in clinic local time (e.g. 2026-09-25T14:30)."),
    durationMinutes: z
      .number()
      .int()
      .min(5)
      .max(480)
      .optional()
      .describe("Updated duration in minutes."),
    type: z.enum(APPOINTMENT_TYPES).optional().describe("Updated appointment type."),
    notes: z.string().optional().describe("Updated clinical notes or visit reason."),
  }),
  execute: async ({ input, ctx, unit }) => {
    const updated = await updateAppointment(
      ctx,
      input.appointmentId,
      {
        scheduledAt: input.scheduledAt ? input.scheduledAt.slice(0, 16) : undefined,
        durationMinutes: input.durationMinutes,
        type: input.type,
        notes: input.notes,
      },
      unit,
    );
    return {
      id: updated.id,
      scheduledAt: updated.scheduledAt.toISOString(),
      durationMinutes: updated.durationMinutes,
      type: updated.type,
      status: updated.status,
      notes: updated.notes,
      message: "Appointment successfully updated/rescheduled.",
    };
  },
});

export const cancelAppointmentTool = defineTool({
  name: "cancel_appointment",
  description: "Cancel a scheduled or confirmed appointment with an optional cancellation reason.",
  permission: "appointment.cancel",
  audit: "appointment.cancel",
  mode: "write",
  confirmation: {
    required: true,
    describe: (input) =>
      `Cancel appointment ID ${input.appointmentId}${input.cancellationReason ? ` with reason: "${input.cancellationReason}"` : ""}`,
  },
  input: z.object({
    appointmentId: z.string().describe("UUID of the appointment to cancel."),
    cancellationReason: z.string().optional().describe("Reason why the appointment is being cancelled."),
  }),
  execute: async ({ input, ctx, unit }) => {
    const appointment = await cancelAppointment(
      ctx,
      {
        id: input.appointmentId,
        cancellationReason: input.cancellationReason || "",
      },
      unit,
    );
    return { id: appointment.id, status: appointment.status };
  },
});

export const confirmAppointmentTool = defineTool({
  name: "confirm_appointment",
  description: "Confirm an existing appointment that was scheduled after receiving patient confirmation.",
  permission: "appointment.update",
  audit: "appointment.update",
  mode: "write",
  confirmation: {
    required: true,
    describe: (input) => `Confirm appointment ID ${input.appointmentId}`,
  },
  input: z.object({
    appointmentId: z.string().describe("UUID of the appointment to confirm."),
  }),
  execute: async ({ input, ctx, unit }) => {
    const appointment = await confirmAppointment(ctx, input.appointmentId, unit);
    return { id: appointment.id, status: appointment.status };
  },
});
