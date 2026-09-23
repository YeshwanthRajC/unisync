import { afterEach, describe, expect, it } from "vitest";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/server/errors";
import { runCommand } from "@/lib/server/unit";
import {
  calculateAge,
  createPatient,
  getPatientOrThrow,
  initialsFor,
  listPatients,
  setPatientActive,
  updatePatient,
} from "@/services/patients";

/**
 * The patients module is the reference implementation every later module
 * copies, so its tests double as the template: pure rules with no database,
 * then the service functions run through the real `runCommand` transaction
 * against two real organizations, asserting one never sees the other's rows.
 */

const TEST_SLUG_PREFIX = "patients-test-";
const TEST_PROFILE_ID = "bbbbbbbb-0000-4000-8000-000000000001";

async function makeOrgContext(name: string): Promise<OrganizationContext> {
  // The audit row `runCommand` writes carries a real FK to profiles, so the
  // actor has to exist, not just be a plausible-looking uuid.
  await prisma.profile.upsert({
    where: { id: TEST_PROFILE_ID },
    create: { id: TEST_PROFILE_ID, email: "patients-test@example.com" },
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

afterEach(async () => {
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: TEST_SLUG_PREFIX } },
  });
  await prisma.profile.deleteMany({ where: { id: TEST_PROFILE_ID } });
});

describe("patient rules", () => {
  it("calculates age from a date of birth, accounting for the birthday not having happened yet this year", () => {
    const now = new Date();
    const notYetBirthday = new Date(now.getFullYear() - 30, now.getMonth() + 1, 1);
    // A birthday next month means the 30th year hasn't completed yet.
    expect(calculateAge(notYetBirthday)).toBe(29);
  });

  it("returns null for an unknown date of birth", () => {
    expect(calculateAge(null)).toBeNull();
  });

  it("builds initials from first and last name", () => {
    expect(initialsFor("Priya Sharma")).toBe("PS");
    expect(initialsFor("Cher")).toBe("CH");
    expect(initialsFor("")).toBe("?");
  });
});

describe("patients: tenant isolation", () => {
  it("never returns another organization's patients from listPatients", async () => {
    const orgA = await makeOrgContext("Patients Org A");
    const orgB = await makeOrgContext("Patients Org B");

    await runCommand(
      { ctx: orgA, action: "test.patient.create", actor: { type: "USER" } },
      (unit) =>
        createPatient(
          orgA,
          { fullName: "Alice A", gender: "UNDISCLOSED" },
          unit,
        ),
    );
    await runCommand(
      { ctx: orgB, action: "test.patient.create", actor: { type: "USER" } },
      (unit) =>
        createPatient(
          orgB,
          { fullName: "Bob B", gender: "UNDISCLOSED" },
          unit,
        ),
    );

    const patientsA = await listPatients(orgA, { status: "ACTIVE" });
    expect(patientsA).toHaveLength(1);
    expect(patientsA[0]?.fullName).toBe("Alice A");

    const patientsB = await listPatients(orgB, { status: "ACTIVE" });
    expect(patientsB).toHaveLength(1);
    expect(patientsB[0]?.fullName).toBe("Bob B");
  });

  it("treats another organization's patient id as not found", async () => {
    const orgA = await makeOrgContext("Patients Org C");
    const orgB = await makeOrgContext("Patients Org D");

    const patient = await runCommand(
      { ctx: orgA, action: "test.patient.create", actor: { type: "USER" } },
      (unit) =>
        createPatient(
          orgA,
          { fullName: "Carol C", gender: "UNDISCLOSED" },
          unit,
        ),
    );

    await expect(getPatientOrThrow(orgB, patient.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("patients: commands", () => {
  it("creates, updates and writes one audit row per command", async () => {
    const ctx = await makeOrgContext("Patients Commands Org");

    const created = await runCommand(
      { ctx, action: "patient.create", actor: { type: "USER" } },
      (unit) =>
        createPatient(
          ctx,
          {
            fullName: "Dev Patel",
            phone: "9876543210",
            gender: "MALE",
          },
          unit,
        ),
    );
    expect(created.fullName).toBe("Dev Patel");
    expect(created.isActive).toBe(true);

    const updated = await runCommand(
      { ctx, action: "patient.update", actor: { type: "USER" } },
      (unit) =>
        updatePatient(
          ctx,
          created.id,
          { fullName: "Dev R. Patel", gender: "MALE" },
          unit,
        ),
    );
    expect(updated.fullName).toBe("Dev R. Patel");

    const deactivated = await runCommand(
      { ctx, action: "patient.deactivate", actor: { type: "USER" } },
      (unit) => setPatientActive(ctx, created.id, false, unit),
    );
    expect(deactivated.isActive).toBe(false);

    const auditActions = await prisma.auditLog.findMany({
      where: { organizationId: ctx.organizationId, entityId: created.id },
      orderBy: { createdAt: "asc" },
    });
    expect(auditActions.map((a) => a.action)).toEqual([
      "patient.create",
      "patient.update",
      "patient.deactivate",
    ]);
  });
});
