"use server";

import { redirect } from "next/navigation";

import { action } from "@/lib/server/action";
import {
  appointmentFormSchema,
  appointmentIdSchema,
  cancelAppointment,
  cancelAppointmentSchema,
  closeAppointment,
  closeAppointmentSchema,
  confirmAppointment,
  createAppointment,
  markNoShow,
  startAppointment,
  updateAppointment,
} from "@/services/appointments";

function fromForm(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(formData.entries());
}

const createAppointmentCommand = action({
  audit: "appointment.create",
  permission: "appointment.create",
  schema: appointmentFormSchema,
  entityType: "Appointment",
  revalidate: () => ["/appointments", "/home"],
  run: ({ input, ctx, unit }) => createAppointment(ctx, input, unit),
});

export async function createAppointmentAction(_previous: unknown, formData: FormData) {
  const result = await createAppointmentCommand(fromForm(formData));
  if (result.ok) redirect(`/appointments/${result.data.id}`);
  return result;
}

const updateAppointmentSchema = appointmentIdSchema.extend(appointmentFormSchema.shape);

const updateAppointmentCommand = action({
  audit: "appointment.update",
  permission: "appointment.update",
  schema: updateAppointmentSchema,
  entityType: "Appointment",
  revalidate: (input) => ["/appointments", `/appointments/${input.id}`],
  run: ({ input, ctx, unit }) => {
    const { id, ...patch } = input;
    return updateAppointment(ctx, id, patch, unit);
  },
});

export async function updateAppointmentAction(_previous: unknown, formData: FormData) {
  const result = await updateAppointmentCommand(fromForm(formData));
  if (result.ok) redirect(`/appointments/${result.data.id}`);
  return result;
}

const confirmAppointmentCommand = action({
  audit: "appointment.confirm",
  permission: "appointment.update",
  schema: appointmentIdSchema,
  entityType: "Appointment",
  revalidate: (input) => ["/appointments", `/appointments/${input.id}`],
  run: ({ input, ctx, unit }) => confirmAppointment(ctx, input.id, unit),
});

export async function confirmAppointmentAction(formData: FormData) {
  await confirmAppointmentCommand(fromForm(formData));
}

const startAppointmentCommand = action({
  audit: "appointment.start",
  permission: "appointment.update",
  schema: appointmentIdSchema,
  entityType: "Appointment",
  revalidate: (input) => ["/appointments", `/appointments/${input.id}`],
  run: ({ input, ctx, unit }) => startAppointment(ctx, input.id, unit),
});

export async function startAppointmentAction(formData: FormData) {
  await startAppointmentCommand(fromForm(formData));
}

const markNoShowCommand = action({
  audit: "appointment.no_show",
  permission: "appointment.update",
  schema: appointmentIdSchema,
  entityType: "Appointment",
  revalidate: (input) => ["/appointments", `/appointments/${input.id}`],
  run: ({ input, ctx, unit }) => markNoShow(ctx, input.id, unit),
});

export async function markNoShowAction(formData: FormData) {
  await markNoShowCommand(fromForm(formData));
}

const cancelAppointmentCommand = action({
  audit: "appointment.cancel",
  permission: "appointment.cancel",
  schema: cancelAppointmentSchema,
  entityType: "Appointment",
  revalidate: (input) => ["/appointments", `/appointments/${input.id}`],
  run: ({ input, ctx, unit }) => cancelAppointment(ctx, input, unit),
});

export async function cancelAppointmentAction(_previous: unknown, formData: FormData) {
  return cancelAppointmentCommand(fromForm(formData));
}

const closeAppointmentCommand = action({
  audit: "appointment.close",
  permission: "appointment.close",
  schema: closeAppointmentSchema,
  entityType: "Appointment",
  revalidate: (input) => ["/appointments", `/appointments/${input.id}`],
  run: ({ input, ctx, unit, intent }) => closeAppointment(ctx, input, intent, unit),
});

export async function closeAppointmentAction(_previous: unknown, formData: FormData) {
  return closeAppointmentCommand(fromForm(formData));
}
