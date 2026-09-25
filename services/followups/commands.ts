import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { orgScope, orgWhere } from "@/lib/db/scope";
import { RuleViolationError } from "@/lib/server/errors";
import type { UnitOfWork } from "@/lib/server/unit";
import type { Db } from "@/lib/db/types";
import { prisma } from "@/lib/db/prisma";
import { getPatientOrThrow } from "@/services/patients";
import { getAppointmentOrThrow } from "@/services/appointments/queries";
import { getFollowUpOrThrow } from "@/services/followups/queries";
import type {
  FollowUpFormInput,
  FollowUpUpdateInput,
  CompleteFollowUpInput,
  CancelFollowUpInput,
  FollowUpStatus,
} from "@/services/followups/schema";

function parseDueDateUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function getTodayStringInTimezone(timezone = "Asia/Kolkata"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function createFollowUp(
  ctx: OrganizationContext,
  input: FollowUpFormInput,
  unit: UnitOfWork,
) {
  await getPatientOrThrow(ctx, input.patientId, unit.db);

  if (input.appointmentId) {
    const appt = await getAppointmentOrThrow(ctx, input.appointmentId, unit.db);
    if (appt.patientId !== input.patientId) {
      throw new RuleViolationError("That appointment belongs to a different patient.");
    }
  }

  // Determine initial status based on due date
  const todayStr = getTodayStringInTimezone();
  let status: FollowUpStatus = "PENDING";
  if (input.dueDate < todayStr) {
    status = "OVERDUE";
  } else if (input.dueDate === todayStr) {
    status = "DUE";
  }

  const followUp = await unit.db.followUp.create({
    data: {
      patientId: input.patientId,
      appointmentId: input.appointmentId || null,
      consultationId: input.consultationId || null,
      dueDate: parseDueDateUtc(input.dueDate),
      status,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
      assignedToProfileId: input.assignedToProfileId || null,
      ...orgScope(ctx),
    },
  });

  unit.target("FollowUp", followUp.id);
  unit.note({
    patientId: input.patientId,
    dueDate: input.dueDate,
    status,
    reason: input.reason,
  });

  return followUp;
}

export async function updateFollowUp(
  ctx: OrganizationContext,
  input: FollowUpUpdateInput,
  unit: UnitOfWork,
) {
  const existing = await getFollowUpOrThrow(ctx, input.id, unit.db);

  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    throw new RuleViolationError(
      `Cannot update a follow-up that is already ${existing.status.toLowerCase()}.`,
    );
  }

  // Re-evaluate open status based on updated due date
  const todayStr = getTodayStringInTimezone();
  let status: FollowUpStatus = existing.status;
  if (input.dueDate < todayStr) {
    status = "OVERDUE";
  } else if (input.dueDate === todayStr) {
    status = "DUE";
  } else {
    status = "PENDING";
  }

  const followUp = await unit.db.followUp.update({
    where: orgWhere(ctx, { id: input.id }),
    data: {
      dueDate: parseDueDateUtc(input.dueDate),
      status,
      reason: input.reason.trim(),
      notes: input.notes?.trim() || null,
      assignedToProfileId: input.assignedToProfileId || null,
    },
  });

  unit.target("FollowUp", followUp.id);
  unit.note({ id: followUp.id, dueDate: input.dueDate, status });

  return followUp;
}

export async function completeFollowUp(
  ctx: OrganizationContext,
  input: CompleteFollowUpInput,
  unit: UnitOfWork,
) {
  const existing = await getFollowUpOrThrow(ctx, input.id, unit.db);

  if (existing.status === "COMPLETED") {
    throw new RuleViolationError("This follow-up has already been completed.");
  }

  if (existing.status === "CANCELLED") {
    throw new RuleViolationError("Cannot complete a cancelled follow-up.");
  }

  const updatedNotes = input.notes?.trim()
    ? existing.notes
      ? `${existing.notes}\nCompletion note: ${input.notes.trim()}`
      : input.notes.trim()
    : existing.notes;

  const followUp = await unit.db.followUp.update({
    where: orgWhere(ctx, { id: input.id }),
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedByProfileId: ctx.profileId,
      notes: updatedNotes,
    },
  });

  unit.target("FollowUp", followUp.id);
  unit.note({ id: followUp.id, completedBy: ctx.profileId });

  return followUp;
}

export async function cancelFollowUp(
  ctx: OrganizationContext,
  input: CancelFollowUpInput,
  unit: UnitOfWork,
) {
  const existing = await getFollowUpOrThrow(ctx, input.id, unit.db);

  if (existing.status === "COMPLETED") {
    throw new RuleViolationError("Cannot cancel an already-completed follow-up.");
  }

  const updatedNotes = input.notes?.trim()
    ? existing.notes
      ? `${existing.notes}\nCancellation note: ${input.notes.trim()}`
      : input.notes.trim()
    : existing.notes;

  const followUp = await unit.db.followUp.update({
    where: orgWhere(ctx, { id: input.id }),
    data: {
      status: "CANCELLED",
      notes: updatedNotes,
    },
  });

  unit.target("FollowUp", followUp.id);
  unit.note({ id: followUp.id, status: "CANCELLED" });

  return followUp;
}

/**
 * Materialise PENDING -> DUE -> OVERDUE status transitions according to the clock.
 *
 * Runs across organizations, respecting each organization's timezone and
 * satisfying the tenant-guard tripwire by scoping every write to its organizationId.
 * Only touches open follow-ups (PENDING, DUE); never touches COMPLETED or CANCELLED.
 */
export async function materializeDueStatuses(db: Db = prisma) {
  const organizations = await db.organization.findMany({
    select: { id: true, timezone: true },
  });

  let totalOverdue = 0;
  let totalDue = 0;

  for (const org of organizations) {
    const todayStr = getTodayStringInTimezone(org.timezone);
    const todayDate = parseDueDateUtc(todayStr);

    // 1. Mark as OVERDUE any open follow-up with a dueDate in the past
    const overdueResult = await db.followUp.updateMany({
      where: {
        organizationId: org.id,
        status: { in: ["PENDING", "DUE"] },
        dueDate: { lt: todayDate },
      },
      data: { status: "OVERDUE" },
    });
    totalOverdue += overdueResult.count;

    // 2. Mark as DUE any PENDING follow-up with dueDate equal to today
    const dueResult = await db.followUp.updateMany({
      where: {
        organizationId: org.id,
        status: "PENDING",
        dueDate: { equals: todayDate },
      },
      data: { status: "DUE" },
    });
    totalDue += dueResult.count;
  }

  return { totalOverdue, totalDue };
}
