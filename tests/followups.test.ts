import { afterEach, describe, expect, it } from "vitest";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, RuleViolationError } from "@/lib/server/errors";
import { runCommand } from "@/lib/server/unit";
import {
  createFollowUp,
  updateFollowUp,
  completeFollowUp,
  cancelFollowUp,
  getFollowUpOrThrow,
  listFollowUps,
  materializeDueStatuses,
} from "@/services/followups";
import { createPatient } from "@/services/patients";

const TEST_SLUG_PREFIX = "followup-test-";
const TEST_PROFILE_ID = "eeeeeeee-0000-4000-8000-000000000005";

async function makeOrgContext(name: string): Promise<OrganizationContext> {
  await prisma.profile.upsert({
    where: { id: TEST_PROFILE_ID },
    create: { id: TEST_PROFILE_ID, email: "followup-test@example.com" },
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

describe("follow-ups: lifecycle and status", () => {
  it("creates a follow-up with PENDING status for future due dates", async () => {
    const ctx = await makeOrgContext("FollowUp Org 1");
    const patient = await makePatient(ctx, "FollowUp Patient 1");

    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const followUp = await runCommand(
      { ctx, action: "test.followup.create", actor: { type: "USER" } },
      (unit) =>
        createFollowUp(
          ctx,
          {
            patientId: patient.id,
            dueDate: futureDate,
            reason: "Post-extraction healing review",
            notes: "Check suture site",
          },
          unit,
        ),
    );

    expect(followUp.status).toBe("PENDING");
    expect(followUp.reason).toBe("Post-extraction healing review");
    expect(followUp.patientId).toBe(patient.id);
  });

  it("creates a follow-up with OVERDUE status for past due dates", async () => {
    const ctx = await makeOrgContext("FollowUp Org 2");
    const patient = await makePatient(ctx, "FollowUp Patient 2");

    const pastDate = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);

    const followUp = await runCommand(
      { ctx, action: "test.followup.create", actor: { type: "USER" } },
      (unit) =>
        createFollowUp(
          ctx,
          {
            patientId: patient.id,
            dueDate: pastDate,
            reason: "Missed appointment follow-up",
          },
          unit,
        ),
    );

    expect(followUp.status).toBe("OVERDUE");
  });

  it("completes an open follow-up with timestamp and profile ID", async () => {
    const ctx = await makeOrgContext("FollowUp Org 3");
    const patient = await makePatient(ctx, "FollowUp Patient 3");

    const futureDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    const followUp = await runCommand(
      { ctx, action: "test.followup.create", actor: { type: "USER" } },
      (unit) =>
        createFollowUp(
          ctx,
          {
            patientId: patient.id,
            dueDate: futureDate,
            reason: "Teeth cleaning recall",
          },
          unit,
        ),
    );

    const completed = await runCommand(
      { ctx, action: "test.followup.complete", actor: { type: "USER" } },
      (unit) =>
        completeFollowUp(
          ctx,
          { id: followUp.id, notes: "Patient called and confirmed appointment" },
          unit,
        ),
    );

    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).not.toBeNull();
    expect(completed.completedByProfileId).toBe(ctx.profileId);

    // Refuses completing an already completed follow-up
    await expect(
      runCommand(
        { ctx, action: "test.followup.complete", actor: { type: "USER" } },
        (unit) => completeFollowUp(ctx, { id: followUp.id }, unit),
      ),
    ).rejects.toThrow(RuleViolationError);
  });

  it("cancels an open follow-up and prevents later edits", async () => {
    const ctx = await makeOrgContext("FollowUp Org 4");
    const patient = await makePatient(ctx, "FollowUp Patient 4");

    const futureDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

    const followUp = await runCommand(
      { ctx, action: "test.followup.create", actor: { type: "USER" } },
      (unit) =>
        createFollowUp(
          ctx,
          {
            patientId: patient.id,
            dueDate: futureDate,
            reason: "Cavity check",
          },
          unit,
        ),
    );

    const cancelled = await runCommand(
      { ctx, action: "test.followup.cancel", actor: { type: "USER" } },
      (unit) => cancelFollowUp(ctx, { id: followUp.id, notes: "Patient relocated" }, unit),
    );

    expect(cancelled.status).toBe("CANCELLED");

    // Updating a cancelled follow-up is refused
    await expect(
      runCommand(
        { ctx, action: "test.followup.update", actor: { type: "USER" } },
        (unit) =>
          updateFollowUp(
            ctx,
            { id: followUp.id, dueDate: futureDate, reason: "New reason" },
            unit,
          ),
      ),
    ).rejects.toThrow(RuleViolationError);
  });
});

describe("follow-ups: tenant isolation", () => {
  it("never returns another organization's follow-ups", async () => {
    const orgA = await makeOrgContext("FollowUp Tenant A");
    const orgB = await makeOrgContext("FollowUp Tenant B");

    const patientA = await makePatient(orgA, "Patient Org A");
    const patientB = await makePatient(orgB, "Patient Org B");

    const futureDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

    await runCommand(
      { ctx: orgA, action: "test.followup.create", actor: { type: "USER" } },
      (unit) =>
        createFollowUp(
          orgA,
          { patientId: patientA.id, dueDate: futureDate, reason: "Org A follow-up" },
          unit,
        ),
    );

    const itemB = await runCommand(
      { ctx: orgB, action: "test.followup.create", actor: { type: "USER" } },
      (unit) =>
        createFollowUp(
          orgB,
          { patientId: patientB.id, dueDate: futureDate, reason: "Org B follow-up" },
          unit,
        ),
    );

    const listA = await listFollowUps(orgA);
    expect(listA.some((f) => f.reason === "Org A follow-up")).toBe(true);
    expect(listA.some((f) => f.reason === "Org B follow-up")).toBe(false);

    await expect(getFollowUpOrThrow(orgA, itemB.id)).rejects.toThrow(NotFoundError);
  });
});

describe("follow-ups: cron materialization", () => {
  it("materializes PENDING into OVERDUE when due date is in the past", async () => {
    const ctx = await makeOrgContext("FollowUp Cron Org");
    const patient = await makePatient(ctx, "Cron Patient");

    const pastDate = new Date(Date.now() - 3 * 86400000);

    // Directly insert a PENDING row with a past date to simulate time elapsed
    const rawFollowUp = await prisma.followUp.create({
      data: {
        organizationId: ctx.organizationId,
        patientId: patient.id,
        dueDate: pastDate,
        status: "PENDING",
        reason: "Simulated time elapsed",
      },
    });

    expect(rawFollowUp.status).toBe("PENDING");

    // Run cron engine
    await materializeDueStatuses(prisma);

    const reloaded = await getFollowUpOrThrow(ctx, rawFollowUp.id);
    expect(reloaded.status).toBe("OVERDUE");
  });
});
