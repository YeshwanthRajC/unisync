import { afterEach, describe, expect, it } from "vitest";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, RuleViolationError } from "@/lib/server/errors";
import { runCommand } from "@/lib/server/unit";
import { createConsultation } from "@/services/consultations/commands";
import { createPatient } from "@/services/patients";
import { createPrescription } from "@/services/prescriptions/commands";
import { getPrescriptionOrThrow } from "@/services/prescriptions/queries";

const TEST_SLUG_PREFIX = "prescriptions-test-";
const TEST_PROFILE_ID = "eeeeeeee-0000-4000-8000-000000000001";

async function makeOrgContext(name: string): Promise<OrganizationContext> {
  await prisma.profile.upsert({
    where: { id: TEST_PROFILE_ID },
    create: { id: TEST_PROFILE_ID, email: "prescriptions-test@example.com" },
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

describe("prescriptions: creation", () => {
  it("creates a prescription with ordered items in one transaction", async () => {
    const ctx = await makeOrgContext("Prescription Org");
    const patient = await makePatient(ctx, "Prescription Patient");

    const prescription = await runCommand(
      { ctx, action: "prescription.create", actor: { type: "USER" } },
      (unit) =>
        createPrescription(
          ctx,
          {
            patientId: patient.id,
            items: [
              { medicine: "Amoxicillin" },
              { medicine: "Ibuprofen", dosage: "400mg", frequency: "Twice daily" },
            ],
          },
          unit,
        ),
    );

    expect(prescription.items).toHaveLength(2);
    expect(prescription.items[0]?.medicine).toBe("Amoxicillin");
    expect(prescription.items[0]?.position).toBe(0);
    expect(prescription.items[1]?.position).toBe(1);

    const audit = await prisma.auditLog.findFirst({
      where: { organizationId: ctx.organizationId, action: "prescription.create" },
    });
    expect(audit).not.toBeNull();
  });

  it("refuses to link a prescription to another patient's consultation", async () => {
    const ctx = await makeOrgContext("Prescription Mismatch Org");
    const patientA = await makePatient(ctx, "Patient A3");
    const patientB = await makePatient(ctx, "Patient B3");

    const consultationForA = await runCommand(
      { ctx, action: "consultation.create", actor: { type: "USER" } },
      (unit) => createConsultation(ctx, { patientId: patientA.id }, unit),
    );

    await expect(
      runCommand(
        { ctx, action: "prescription.create", actor: { type: "USER" } },
        (unit) =>
          createPrescription(
            ctx,
            {
              patientId: patientB.id,
              consultationId: consultationForA.id,
              items: [{ medicine: "Paracetamol" }],
            },
            unit,
          ),
      ),
    ).rejects.toThrow(RuleViolationError);
  });
});

describe("prescriptions: tenant isolation", () => {
  it("treats another organization's prescription id as not found", async () => {
    const orgA = await makeOrgContext("Prescription Org A");
    const orgB = await makeOrgContext("Prescription Org B");
    const patientA = await makePatient(orgA, "Patient A4");

    const prescription = await runCommand(
      { ctx: orgA, action: "prescription.create", actor: { type: "USER" } },
      (unit) =>
        createPrescription(
          orgA,
          { patientId: patientA.id, items: [{ medicine: "Amoxicillin" }] },
          unit,
        ),
    );

    await expect(getPrescriptionOrThrow(orgB, prescription.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});
