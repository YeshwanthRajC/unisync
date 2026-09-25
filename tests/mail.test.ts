import { afterEach, describe, expect, it, vi } from "vitest";

import * as brevo from "@/services/mail/brevo";
import * as envModule from "@/lib/env";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/server/errors";
import { runCommand } from "@/lib/server/unit";
import {
  createEmailDraft,
  updateEmailDraft,
  deleteEmailDraft,
  sendPatientEmail,
  getPatientEmailOrThrow,
  listPatientEmails,
  generateAiDraft,
} from "@/services/mail";
import { createPatient } from "@/services/patients";
import type { HumanIntent } from "@/lib/auth/human-intent";

const TEST_SLUG_PREFIX = "mail-test-";
const TEST_PROFILE_ID = "ffffffff-0000-4000-8000-000000000006";

async function makeOrgContext(name: string): Promise<OrganizationContext> {
  await prisma.profile.upsert({
    where: { id: TEST_PROFILE_ID },
    create: { id: TEST_PROFILE_ID, email: "mail-test@example.com" },
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
    (unit) =>
      createPatient(
        ctx,
        {
          fullName,
          gender: "UNDISCLOSED",
          email: `${fullName.toLowerCase().replace(/\s+/g, "")}@example.com`,
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

describe("patient mail: the third manual gate", () => {
  it("refuses a SENT email row with no sender or sentAt via database CHECK constraint", async () => {
    const ctx = await makeOrgContext("Mail Check Org");
    const patient = await makePatient(ctx, "Check Email Patient");

    // Raw insert of SENT status without sentAt / sentByProfileId
    await expect(
      prisma.$executeRaw`
        INSERT INTO patient_emails (id, "organizationId", "patientId", recipient, subject, body, status, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${ctx.organizationId}::uuid, ${patient.id}::uuid, 'patient@example.com', 'Test Subject', 'Test Body', 'SENT', now(), now())
      `,
    ).rejects.toThrow();
  });
});

describe("patient mail: draft lifecycle and sending", () => {
  it("creates, updates, and deletes an email draft", async () => {
    const ctx = await makeOrgContext("Mail Draft Org");
    const patient = await makePatient(ctx, "Draft Patient");

    const draft = await runCommand(
      { ctx, action: "test.mail.create", actor: { type: "USER" } },
      (unit) =>
        createEmailDraft(
          ctx,
          {
            patientId: patient.id,
            recipient: "draft@example.com",
            subject: "Initial Subject",
            body: "Initial Body Content",
          },
          unit,
        ),
    );

    expect(draft.status).toBe("DRAFT");
    expect(draft.subject).toBe("Initial Subject");

    const updated = await runCommand(
      { ctx, action: "test.mail.update", actor: { type: "USER" } },
      (unit) =>
        updateEmailDraft(
          ctx,
          {
            id: draft.id,
            recipient: "updated@example.com",
            subject: "Updated Subject",
            body: "Updated Body Content",
          },
          unit,
        ),
    );

    expect(updated.subject).toBe("Updated Subject");

    await runCommand(
      { ctx, action: "test.mail.delete", actor: { type: "USER" } },
      (unit) => deleteEmailDraft(ctx, { id: draft.id }, unit),
    );

    await expect(getPatientEmailOrThrow(ctx, draft.id)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("sendPatientEmail updates status to SENT and sets sentAt/sentByProfileId when Brevo is configured", async () => {
    const ctx = await makeOrgContext("Mail Send Brevo Org");
    const patient = await makePatient(ctx, "Send Patient Brevo");

    const draft = await runCommand(
      { ctx, action: "test.mail.create", actor: { type: "USER" } },
      (unit) =>
        createEmailDraft(
          ctx,
          {
            patientId: patient.id,
            recipient: "send-brevo@example.com",
            subject: "Treatment plan review",
            body: "Please review the attached treatment plan.",
          },
          unit,
        ),
    );

    const fakeIntent = {
      at: new Date(),
      profileId: ctx.profileId,
    } as unknown as HumanIntent;

    vi.spyOn(envModule, "isBrevoConfigured").mockReturnValue(true);
    const dispatchSpy = vi.spyOn(brevo, "dispatchEmail").mockResolvedValue({
      messageId: "brevo-msg-test-1234",
      provider: "brevo_rest",
    });

    const sent = await runCommand(
      { ctx, action: "test.mail.send", actor: { type: "USER" } },
      (unit) => sendPatientEmail(ctx, { id: draft.id }, fakeIntent, unit),
    );

    expect(sent.status).toBe("SENT");
    expect(sent.sentAt).not.toBeNull();
    expect(sent.sentByProfileId).toBe(ctx.profileId);
    expect(sent.providerMessageId).toBe("brevo-msg-test-1234");
    expect(sent.failureReason).toBeNull();
    expect(dispatchSpy).toHaveBeenCalled();

    dispatchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("sendPatientEmail updates status to FAILED when Brevo delivery throws an error", async () => {
    const ctx = await makeOrgContext("Mail Send Fail Org");
    const patient = await makePatient(ctx, "Send Patient Fail");

    const draft = await runCommand(
      { ctx, action: "test.mail.create", actor: { type: "USER" } },
      (unit) =>
        createEmailDraft(
          ctx,
          {
            patientId: patient.id,
            recipient: "send-fail@example.com",
            subject: "Test Subject",
            body: "Test Body",
          },
          unit,
        ),
    );

    const fakeIntent = {
      at: new Date(),
      profileId: ctx.profileId,
    } as unknown as HumanIntent;

    vi.spyOn(envModule, "isBrevoConfigured").mockReturnValue(true);
    const dispatchSpy = vi.spyOn(brevo, "dispatchEmail").mockRejectedValue(
      new Error("Invalid recipient domain"),
    );

    const sent = await runCommand(
      { ctx, action: "test.mail.send", actor: { type: "USER" } },
      (unit) => sendPatientEmail(ctx, { id: draft.id }, fakeIntent, unit),
    );

    expect(sent.status).toBe("FAILED");
    expect(sent.sentAt).toBeNull();
    expect(sent.sentByProfileId).toBeNull();
    expect(sent.failureReason).toContain("Invalid recipient domain");

    dispatchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("sendPatientEmail updates status to PROVIDER_NOT_CONFIGURED and leaves sentAt/sentByProfileId null when unconfigured", async () => {
    const ctx = await makeOrgContext("Mail Send Org");
    const patient = await makePatient(ctx, "Send Patient");

    const draft = await runCommand(
      { ctx, action: "test.mail.create", actor: { type: "USER" } },
      (unit) =>
        createEmailDraft(
          ctx,
          {
            patientId: patient.id,
            recipient: "send@example.com",
            subject: "Treatment plan review",
            body: "Please review the attached treatment plan.",
          },
          unit,
        ),
    );

    const fakeIntent = {
      at: new Date(),
      profileId: ctx.profileId,
    } as unknown as HumanIntent;

    vi.spyOn(envModule, "isBrevoConfigured").mockReturnValue(false);

    const sent = await runCommand(
      { ctx, action: "test.mail.send", actor: { type: "USER" } },
      (unit) => sendPatientEmail(ctx, { id: draft.id }, fakeIntent, unit),
    );

    expect(sent.status).toBe("PROVIDER_NOT_CONFIGURED");
    expect(sent.sentAt).toBeNull();
    expect(sent.sentByProfileId).toBeNull();
    expect(sent.failureReason).toContain("No email provider configured");

    vi.restoreAllMocks();
  });
});

describe("patient mail: tenant isolation", () => {
  it("never returns another organization's emails", async () => {
    const orgA = await makeOrgContext("Mail Tenant A");
    const orgB = await makeOrgContext("Mail Tenant B");

    const patientA = await makePatient(orgA, "Patient Org A");
    const patientB = await makePatient(orgB, "Patient Org B");

    await runCommand(
      { ctx: orgA, action: "test.mail.create", actor: { type: "USER" } },
      (unit) =>
        createEmailDraft(
          orgA,
          {
            patientId: patientA.id,
            recipient: "a@example.com",
            subject: "Org A Email",
            body: "Hello A",
          },
          unit,
        ),
    );

    const emailB = await runCommand(
      { ctx: orgB, action: "test.mail.create", actor: { type: "USER" } },
      (unit) =>
        createEmailDraft(
          orgB,
          {
            patientId: patientB.id,
            recipient: "b@example.com",
            subject: "Org B Email",
            body: "Hello B",
          },
          unit,
        ),
    );

    const listA = await listPatientEmails(orgA);
    expect(listA.some((e) => e.subject === "Org A Email")).toBe(true);
    expect(listA.some((e) => e.subject === "Org B Email")).toBe(false);

    await expect(getPatientEmailOrThrow(orgA, emailB.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("patient mail: AI draft generation", () => {
  it("generates subject and body for a requested topic", async () => {
    const ctx = await makeOrgContext("Mail AI Org");
    const patient = await makePatient(ctx, "AI Patient");

    const draft = await generateAiDraft(ctx, {
      patientId: patient.id,
      topic: "APPOINTMENT_REMINDER",
      notes: "Tomorrow at 10 AM",
    });

    expect(draft.subject).toBeTruthy();
    expect(draft.body).toContain(patient.fullName);
  });
});
