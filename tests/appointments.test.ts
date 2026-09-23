import { afterEach, describe, expect, it } from "vitest";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, RuleViolationError } from "@/lib/server/errors";
import { runCommand } from "@/lib/server/unit";
import {
  cancelAppointment,
  closeAppointment,
  confirmAppointment,
  createAppointment,
} from "@/services/appointments/commands";
import {
  getAppointmentOrThrow,
  listAppointmentsForDay,
} from "@/services/appointments/queries";
import {
  canTransition,
  dayBoundsInZone,
  isEditable,
  zonedTimeToUtc,
} from "@/services/appointments/rules";
import { createPatient } from "@/services/patients";

/**
 * Appointments carry the product's central manual gate: `closeAppointment`
 * requires a `HumanIntent`, which is unforgeable at the type level (see
 * lib/auth/human-intent.ts). That guarantee cannot be exercised from a test
 * that never has a HumanIntent to withhold — what a test CAN check is the
 * second, independent layer: the database's CHECK constraint refuses a
 * COMPLETED row with no closer, even bypassing the application entirely.
 */

const TEST_SLUG_PREFIX = "appointments-test-";
const TEST_PROFILE_ID = "cccccccc-0000-4000-8000-000000000001";

async function makeOrgContext(name: string): Promise<OrganizationContext> {
  await prisma.profile.upsert({
    where: { id: TEST_PROFILE_ID },
    create: { id: TEST_PROFILE_ID, email: "appointments-test@example.com" },
    update: {},
  });

  const organization = await prisma.organization.create({
    data: {
      name,
      slug: `${TEST_SLUG_PREFIX}${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timezone: "Asia/Kolkata",
    },
  });

  return {
    user: { id: TEST_PROFILE_ID } as OrganizationContext["user"],
    profileId: TEST_PROFILE_ID,
    organizationId: organization.id,
    organizationName: organization.name,
    role: "OWNER",
  };
}

async function makePatient(ctx: OrganizationContext, fullName: string) {
  return runCommand(
    { ctx, action: "test.patient.create", actor: { type: "USER" } },
    (unit) => createPatient(ctx, { fullName, gender: "UNDISCLOSED" }, unit),
  );
}

afterEach(async () => {
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: TEST_SLUG_PREFIX } },
  });
  await prisma.profile.deleteMany({ where: { id: TEST_PROFILE_ID } });
});

describe("appointment rules", () => {
  it("only allows the documented status transitions", () => {
    expect(canTransition("SCHEDULED", "CONFIRMED")).toBe(true);
    expect(canTransition("SCHEDULED", "COMPLETED")).toBe(true);
    expect(canTransition("COMPLETED", "SCHEDULED")).toBe(false);
    expect(canTransition("CANCELLED", "COMPLETED")).toBe(false);
    expect(canTransition("NO_SHOW", "CONFIRMED")).toBe(false);
  });

  it("treats only SCHEDULED and CONFIRMED as editable", () => {
    expect(isEditable("SCHEDULED")).toBe(true);
    expect(isEditable("CONFIRMED")).toBe(true);
    expect(isEditable("IN_PROGRESS")).toBe(false);
    expect(isEditable("COMPLETED")).toBe(false);
  });

  it("round-trips a local wall-clock time through zonedTimeToUtc for a fixed-offset zone", () => {
    // Asia/Kolkata is UTC+5:30 with no DST, so this is exact and stable.
    const utc = zonedTimeToUtc("2026-03-15T14:30", "Asia/Kolkata");
    expect(utc.toISOString()).toBe("2026-03-15T09:00:00.000Z");
  });

  it("computes day bounds that bracket exactly one local calendar day", () => {
    const { start, end } = dayBoundsInZone("2026-03-15", "Asia/Kolkata");
    expect(start.toISOString()).toBe("2026-03-14T18:30:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(24 * 3_600_000);
  });
});

describe("appointments: tenant isolation", () => {
  it("never returns another organization's appointments for the same day", async () => {
    const orgA = await makeOrgContext("Appt Org A");
    const orgB = await makeOrgContext("Appt Org B");
    const patientA = await makePatient(orgA, "Patient A");
    const patientB = await makePatient(orgB, "Patient B");

    await runCommand(
      { ctx: orgA, action: "test.appointment.create", actor: { type: "USER" } },
      (unit) =>
        createAppointment(
          orgA,
          {
            patientId: patientA.id,
            scheduledAt: "2026-03-15T10:00",
            durationMinutes: 30,
            type: "CONSULTATION",
          },
          unit,
        ),
    );
    await runCommand(
      { ctx: orgB, action: "test.appointment.create", actor: { type: "USER" } },
      (unit) =>
        createAppointment(
          orgB,
          {
            patientId: patientB.id,
            scheduledAt: "2026-03-15T11:00",
            durationMinutes: 30,
            type: "CONSULTATION",
          },
          unit,
        ),
    );

    const dayA = await listAppointmentsForDay(orgA, "2026-03-15", "Asia/Kolkata");
    expect(dayA).toHaveLength(1);
    expect(dayA[0]?.patientId).toBe(patientA.id);

    const dayB = await listAppointmentsForDay(orgB, "2026-03-15", "Asia/Kolkata");
    expect(dayB).toHaveLength(1);
    expect(dayB[0]?.patientId).toBe(patientB.id);
  });

  it("treats another organization's appointment id as not found", async () => {
    const orgA = await makeOrgContext("Appt Org C");
    const orgB = await makeOrgContext("Appt Org D");
    const patientA = await makePatient(orgA, "Patient C");

    const appointment = await runCommand(
      { ctx: orgA, action: "test.appointment.create", actor: { type: "USER" } },
      (unit) =>
        createAppointment(
          orgA,
          {
            patientId: patientA.id,
            scheduledAt: "2026-03-15T10:00",
            durationMinutes: 30,
            type: "CONSULTATION",
          },
          unit,
        ),
    );

    await expect(getAppointmentOrThrow(orgB, appointment.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("appointments: the manual close gate", () => {
  it("refuses a COMPLETED row with no closer, even via a raw insert bypassing the application", async () => {
    const ctx = await makeOrgContext("Appt Check Org");
    const patient = await makePatient(ctx, "Check Patient");

    await expect(
      prisma.$executeRaw`
        INSERT INTO appointments (id, "organizationId", "patientId", "scheduledAt", status, "updatedAt")
        VALUES (gen_random_uuid(), ${ctx.organizationId}::uuid, ${patient.id}::uuid, now(), 'COMPLETED', now())
      `,
    ).rejects.toThrow(/appointment_completed_requires_human/);
  });

  it("closeAppointment writes closedAt/closedByProfileId from the intent, and the outcome", async () => {
    const ctx = await makeOrgContext("Appt Close Org");
    const patient = await makePatient(ctx, "Close Patient");

    const appointment = await runCommand(
      { ctx, action: "test.appointment.create", actor: { type: "USER" } },
      (unit) =>
        createAppointment(
          ctx,
          {
            patientId: patient.id,
            scheduledAt: "2026-03-15T10:00",
            durationMinutes: 30,
            type: "CONSULTATION",
          },
          unit,
        ),
    );

    const intent = { profileId: ctx.profileId, at: new Date() } as Parameters<
      typeof closeAppointment
    >[2];

    const closed = await runCommand(
      { ctx, action: "appointment.close", actor: { type: "USER" } },
      (unit) =>
        closeAppointment(
          ctx,
          { id: appointment.id, outcomeNotes: "Cleaning completed, no issues." },
          intent,
          unit,
        ),
    );

    expect(closed.status).toBe("COMPLETED");
    expect(closed.closedByProfileId).toBe(ctx.profileId);
    expect(closed.closedAt).not.toBeNull();
    expect(closed.outcomeNotes).toBe("Cleaning completed, no issues.");
  });

  it("refuses to close an already-cancelled appointment", async () => {
    const ctx = await makeOrgContext("Appt Rule Org");
    const patient = await makePatient(ctx, "Rule Patient");

    const appointment = await runCommand(
      { ctx, action: "test.appointment.create", actor: { type: "USER" } },
      (unit) =>
        createAppointment(
          ctx,
          {
            patientId: patient.id,
            scheduledAt: "2026-03-15T10:00",
            durationMinutes: 30,
            type: "CONSULTATION",
          },
          unit,
        ),
    );

    await runCommand(
      { ctx, action: "appointment.cancel", actor: { type: "USER" } },
      (unit) =>
        cancelAppointment(ctx, { id: appointment.id, cancellationReason: "Patient rescheduled" }, unit),
    );

    const intent = { profileId: ctx.profileId, at: new Date() } as Parameters<
      typeof closeAppointment
    >[2];

    await expect(
      runCommand(
        { ctx, action: "appointment.close", actor: { type: "USER" } },
        (unit) =>
          closeAppointment(
            ctx,
            { id: appointment.id, outcomeNotes: "Too late" },
            intent,
            unit,
          ),
      ),
    ).rejects.toThrow(RuleViolationError);
  });

  it("confirming an appointment does not touch closedAt/closedByProfileId", async () => {
    const ctx = await makeOrgContext("Appt Confirm Org");
    const patient = await makePatient(ctx, "Confirm Patient");

    const appointment = await runCommand(
      { ctx, action: "test.appointment.create", actor: { type: "USER" } },
      (unit) =>
        createAppointment(
          ctx,
          {
            patientId: patient.id,
            scheduledAt: "2026-03-15T10:00",
            durationMinutes: 30,
            type: "CONSULTATION",
          },
          unit,
        ),
    );

    const confirmed = await runCommand(
      { ctx, action: "appointment.confirm", actor: { type: "USER" } },
      (unit) => confirmAppointment(ctx, appointment.id, unit),
    );

    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.closedAt).toBeNull();
    expect(confirmed.closedByProfileId).toBeNull();
  });
});
