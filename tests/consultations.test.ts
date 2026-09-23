import { afterEach, describe, expect, it } from "vitest";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError, RuleViolationError } from "@/lib/server/errors";
import { runCommand } from "@/lib/server/unit";
import { createAppointment } from "@/services/appointments/commands";
import { createConsultation } from "@/services/consultations/commands";
import {
  getConsultationOrThrow,
  listConsultationsForPatient,
} from "@/services/consultations/queries";
import { createPatient } from "@/services/patients";

const TEST_SLUG_PREFIX = "consultations-test-";
const TEST_PROFILE_ID = "dddddddd-0000-4000-8000-000000000001";

async function makeOrgContext(name: string): Promise<OrganizationContext> {
  await prisma.profile.upsert({
    where: { id: TEST_PROFILE_ID },
    create: { id: TEST_PROFILE_ID, email: "consultations-test@example.com" },
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

async function makeAppointment(ctx: OrganizationContext, patientId: string) {
  return runCommand(
    { ctx, action: "test.appointment.create", actor: { type: "USER" } },
    (unit) =>
      createAppointment(
        ctx,
        {
          patientId,
          scheduledAt: "2026-04-01T10:00",
          durationMinutes: 30,
          type: "CONSULTATION",
        },
        unit,
      ),
  );
}

afterEach(async () => {
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: TEST_SLUG_PREFIX } },
  });
  await prisma.profile.deleteMany({ where: { id: TEST_PROFILE_ID } });
});

describe("consultations: recording does not touch the appointment", () => {
  it("leaves the appointment status untouched after recording a consultation against it", async () => {
    const ctx = await makeOrgContext("Consult Status Org");
    const patient = await makePatient(ctx, "Status Patient");
    const appointment = await makeAppointment(ctx, patient.id);

    expect(appointment.status).toBe("SCHEDULED");

    await runCommand(
      { ctx, action: "consultation.create", actor: { type: "USER" } },
      (unit) =>
        createConsultation(
          ctx,
          { patientId: patient.id, appointmentId: appointment.id, diagnosis: "Cavity" },
          unit,
        ),
    );

    const reloaded = await prisma.appointment.findFirst({
      where: { id: appointment.id, organizationId: ctx.organizationId },
    });
    expect(reloaded?.status).toBe("SCHEDULED");
    expect(reloaded?.closedAt).toBeNull();
  });

  it("refuses to link a consultation to another patient's appointment", async () => {
    const ctx = await makeOrgContext("Consult Mismatch Org");
    const patientA = await makePatient(ctx, "Patient A");
    const patientB = await makePatient(ctx, "Patient B");
    const appointmentForA = await makeAppointment(ctx, patientA.id);

    await expect(
      runCommand(
        { ctx, action: "consultation.create", actor: { type: "USER" } },
        (unit) =>
          createConsultation(
            ctx,
            { patientId: patientB.id, appointmentId: appointmentForA.id },
            unit,
          ),
      ),
    ).rejects.toThrow(RuleViolationError);
  });

  it("refuses a second consultation against the same appointment", async () => {
    const ctx = await makeOrgContext("Consult Dup Org");
    const patient = await makePatient(ctx, "Dup Patient");
    const appointment = await makeAppointment(ctx, patient.id);

    await runCommand(
      { ctx, action: "consultation.create", actor: { type: "USER" } },
      (unit) =>
        createConsultation(ctx, { patientId: patient.id, appointmentId: appointment.id }, unit),
    );

    await expect(
      runCommand(
        { ctx, action: "consultation.create", actor: { type: "USER" } },
        (unit) =>
          createConsultation(ctx, { patientId: patient.id, appointmentId: appointment.id }, unit),
      ),
    ).rejects.toThrow(ConflictError);
  });
});

describe("consultations: tenant isolation", () => {
  it("never returns another organization's consultations", async () => {
    const orgA = await makeOrgContext("Consult Org A");
    const orgB = await makeOrgContext("Consult Org B");
    const patientA = await makePatient(orgA, "Patient A2");
    const patientB = await makePatient(orgB, "Patient B2");

    const consultationA = await runCommand(
      { ctx: orgA, action: "consultation.create", actor: { type: "USER" } },
      (unit) => createConsultation(orgA, { patientId: patientA.id }, unit),
    );
    await runCommand(
      { ctx: orgB, action: "consultation.create", actor: { type: "USER" } },
      (unit) => createConsultation(orgB, { patientId: patientB.id }, unit),
    );

    const listA = await listConsultationsForPatient(orgA, patientA.id);
    expect(listA).toHaveLength(1);
    expect(listA[0]?.id).toBe(consultationA.id);

    await expect(getConsultationOrThrow(orgB, consultationA.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});
