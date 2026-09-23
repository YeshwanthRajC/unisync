import "server-only";

import type { HumanIntent } from "@/lib/auth/human-intent";
import type { OrganizationContext } from "@/lib/auth/session";
import { orgScope, orgWhere } from "@/lib/db/scope";
import { RuleViolationError } from "@/lib/server/errors";
import type { UnitOfWork } from "@/lib/server/unit";
import { getCurrentOrganization } from "@/services/organizations";
import { getPatientOrThrow } from "@/services/patients";
import { getAppointmentOrThrow } from "@/services/appointments/queries";
import {
  canTransition,
  isEditable,
  zonedTimeToUtc,
} from "@/services/appointments/rules";
import type {
  AppointmentFormInput,
  CancelAppointmentInput,
  CloseAppointmentInput,
} from "@/services/appointments/schema";
import type { AppointmentStatus } from "@/lib/db/generated/enums";

export async function createAppointment(
  ctx: OrganizationContext,
  input: AppointmentFormInput,
  unit: UnitOfWork,
) {
  // Confirms the patient exists and belongs to this tenant, so a stale or
  // guessed id fails as "patient not found" rather than a tenant-scope throw.
  await getPatientOrThrow(ctx, input.patientId, unit.db);
  const organization = await getCurrentOrganization(ctx, unit.db);

  const appointment = await unit.db.appointment.create({
    data: {
      patientId: input.patientId,
      scheduledAt: zonedTimeToUtc(input.scheduledAt, organization.timezone),
      durationMinutes: input.durationMinutes,
      type: input.type,
      notes: input.notes || null,
      createdByProfileId: ctx.profileId,
      ...orgScope(ctx),
    },
  });

  unit.target("Appointment", appointment.id);
  unit.note({ patientId: appointment.patientId, scheduledAt: appointment.scheduledAt });

  return appointment;
}

export async function updateAppointment(
  ctx: OrganizationContext,
  id: string,
  input: AppointmentFormInput,
  unit: UnitOfWork,
) {
  const existing = await getAppointmentOrThrow(ctx, id, unit.db);
  if (!isEditable(existing.status)) {
    throw new RuleViolationError(
      "This appointment has already started, closed or been cancelled and can no longer be rescheduled.",
    );
  }
  if (existing.patientId !== input.patientId) {
    await getPatientOrThrow(ctx, input.patientId, unit.db);
  }
  const organization = await getCurrentOrganization(ctx, unit.db);

  const appointment = await unit.db.appointment.update({
    where: orgWhere(ctx, { id }),
    data: {
      patientId: input.patientId,
      scheduledAt: zonedTimeToUtc(input.scheduledAt, organization.timezone),
      durationMinutes: input.durationMinutes,
      type: input.type,
      notes: input.notes || null,
    },
  });

  unit.target("Appointment", appointment.id);
  return appointment;
}

/** Shared by every plain status bump (confirm, start, no-show): validates the
 * transition against the state machine and nothing else. */
async function transitionAppointment(
  ctx: OrganizationContext,
  id: string,
  to: AppointmentStatus,
  unit: UnitOfWork,
) {
  const existing = await getAppointmentOrThrow(ctx, id, unit.db);
  if (!canTransition(existing.status, to)) {
    throw new RuleViolationError(
      `An appointment that is ${existing.status.toLowerCase().replace("_", " ")} cannot move to ${to.toLowerCase().replace("_", " ")}.`,
    );
  }

  const appointment = await unit.db.appointment.update({
    where: orgWhere(ctx, { id }),
    data: { status: to },
  });

  unit.target("Appointment", appointment.id);
  return appointment;
}

export function confirmAppointment(
  ctx: OrganizationContext,
  id: string,
  unit: UnitOfWork,
) {
  return transitionAppointment(ctx, id, "CONFIRMED", unit);
}

export function startAppointment(
  ctx: OrganizationContext,
  id: string,
  unit: UnitOfWork,
) {
  return transitionAppointment(ctx, id, "IN_PROGRESS", unit);
}

export function markNoShow(
  ctx: OrganizationContext,
  id: string,
  unit: UnitOfWork,
) {
  return transitionAppointment(ctx, id, "NO_SHOW", unit);
}

export async function cancelAppointment(
  ctx: OrganizationContext,
  input: CancelAppointmentInput,
  unit: UnitOfWork,
) {
  const existing = await getAppointmentOrThrow(ctx, input.id, unit.db);
  if (!canTransition(existing.status, "CANCELLED")) {
    throw new RuleViolationError(
      `An appointment that is ${existing.status.toLowerCase().replace("_", " ")} cannot be cancelled.`,
    );
  }

  const appointment = await unit.db.appointment.update({
    where: orgWhere(ctx, { id: input.id }),
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: input.cancellationReason,
    },
  });

  unit.target("Appointment", appointment.id);
  unit.note({ cancellationReason: input.cancellationReason });
  return appointment;
}

/**
 * The manual gate. `intent` is a `HumanIntent` — a type branded with a unique
 * symbol, mintable only inside `lib/server/action.ts` from a real cookie-
 * authenticated request. `lib/ai/**` is ESLint-forbidden from importing the
 * module that mints it, so an AI tool cannot call this function: not because a
 * runtime check rejects it, but because the code does not compile. The
 * database's CHECK constraint on `appointments` is the second, independent
 * layer of the same guarantee.
 */
export async function closeAppointment(
  ctx: OrganizationContext,
  input: CloseAppointmentInput,
  intent: HumanIntent,
  unit: UnitOfWork,
) {
  const existing = await getAppointmentOrThrow(ctx, input.id, unit.db);
  if (!canTransition(existing.status, "COMPLETED")) {
    throw new RuleViolationError(
      `An appointment that is ${existing.status.toLowerCase().replace("_", " ")} cannot be closed.`,
    );
  }

  const appointment = await unit.db.appointment.update({
    where: orgWhere(ctx, { id: input.id }),
    data: {
      status: "COMPLETED",
      closedAt: intent.at,
      closedByProfileId: intent.profileId,
      outcomeNotes: input.outcomeNotes,
    },
  });

  unit.target("Appointment", appointment.id);
  unit.note({ outcomeNotes: input.outcomeNotes });
  return appointment;
}
