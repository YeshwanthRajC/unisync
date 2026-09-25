import { afterEach, describe, expect, it } from "vitest";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { runCommand } from "@/lib/server/unit";
import { createPatient } from "@/services/patients";
import { verifyPatientActionContext, detectActionTopic } from "@/services/mail/verifier";
import { generateAiDraft } from "@/services/mail/commands";
import { draftPatientEmailTool, sendPatientEmailTool } from "@/lib/ai/tools/mail.tools";

const TEST_SLUG_PREFIX = "verifier-test-";
const TEST_PROFILE_ID = "ffffffff-0000-4000-8000-000000000009";

async function makeOrgContext(name: string): Promise<OrganizationContext> {
  await prisma.profile.upsert({
    where: { id: TEST_PROFILE_ID },
    create: { id: TEST_PROFILE_ID, email: "verifier-test@example.com" },
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

describe("detectActionTopic", () => {
  it("detects appointment reminder topics", () => {
    expect(detectActionTopic("APPOINTMENT_REMINDER")).toBe("APPOINTMENT_REMINDER");
    expect(detectActionTopic("Your upcoming appointment reminder")).toBe("APPOINTMENT_REMINDER");
    expect(detectActionTopic("Consultation reminder for tomorrow")).toBe("APPOINTMENT_REMINDER");
  });

  it("detects billing reminder topics", () => {
    expect(detectActionTopic("OVERDUE_BILL_REMINDER")).toBe("OVERDUE_BILL_REMINDER");
    expect(detectActionTopic("Friendly statement reminder for overdue payment")).toBe("OVERDUE_BILL_REMINDER");
    expect(detectActionTopic("Outstanding balance notice")).toBe("OVERDUE_BILL_REMINDER");
  });

  it("detects follow-up recall topics", () => {
    expect(detectActionTopic("FOLLOW_UP_RECALL")).toBe("FOLLOW_UP_RECALL");
    expect(detectActionTopic("Time for your follow-up check-up")).toBe("FOLLOW_UP_RECALL");
  });
});

describe("verifyPatientActionContext ground truth checking", () => {
  it("flags appointment reminder as invalid when patient has no upcoming appointment", async () => {
    const ctx = await makeOrgContext("Verifier Org No Appt");
    const patient = await makePatient(ctx, "No Appointment Patient");

    const result = await verifyPatientActionContext(
      ctx,
      patient.id,
      "APPOINTMENT_REMINDER",
    );

    expect(result.valid).toBe(false);
    expect(result.title).toContain("No Upcoming Scheduled Appointment");
    expect(result.message).toContain("no active upcoming scheduled appointments");
    expect(result.severity).toBe("WARNING");
  });

  it("validates appointment reminder when patient has an active upcoming appointment", async () => {
    const ctx = await makeOrgContext("Verifier Org With Appt");
    const patient = await makePatient(ctx, "Has Appointment Patient");

    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days in future
    const appointment = await prisma.appointment.create({
      data: {
        organizationId: ctx.organizationId,
        patientId: patient.id,
        scheduledAt: futureDate,
        durationMinutes: 30,
        type: "CONSULTATION",
        status: "SCHEDULED",
      },
    });

    const result = await verifyPatientActionContext(
      ctx,
      patient.id,
      "APPOINTMENT_REMINDER",
    );

    expect(result.valid).toBe(true);
    expect(result.appointment).toBeDefined();
    expect(result.appointment?.id).toBe(appointment.id);
    expect(result.appointment?.formattedDate).toBeTruthy();
  });

  it("flags balance reminder as invalid when patient has zero outstanding balance", async () => {
    const ctx = await makeOrgContext("Verifier Org Zero Balance");
    const patient = await makePatient(ctx, "Zero Balance Patient");

    const result = await verifyPatientActionContext(
      ctx,
      patient.id,
      "OVERDUE_BILL_REMINDER",
    );

    expect(result.valid).toBe(false);
    expect(result.title).toContain("No Outstanding Balance");
    expect(result.message).toContain("balance of ₹0.00");
    expect(result.billing?.totalOutstanding).toBe(0);
  });

  it("validates balance reminder when patient has an unpaid bill", async () => {
    const ctx = await makeOrgContext("Verifier Org Unpaid Bill");
    const patient = await makePatient(ctx, "Unpaid Bill Patient");

    const bill = await prisma.bill.create({
      data: {
        organizationId: ctx.organizationId,
        patientId: patient.id,
        number: "INV-101",
        status: "ISSUED",
        total: 1500,
      },
    });

    await prisma.payment.create({
      data: {
        organizationId: ctx.organizationId,
        billId: bill.id,
        amount: 500,
        status: "CONFIRMED",
        confirmedAt: new Date(),
        confirmedByProfileId: ctx.profileId,
      },
    });

    const result = await verifyPatientActionContext(
      ctx,
      patient.id,
      "OVERDUE_BILL_REMINDER",
    );

    expect(result.valid).toBe(true);
    expect(result.billing).toBeDefined();
    expect(result.billing?.totalOutstanding).toBe(1000);
    expect(result.billing?.formattedBalance).toContain("1,000.00");
  });
});

describe("AI Agent tools ground truth enforcement", () => {
  it("draft_patient_email rejects inappropriate appointment reminder and creates warning notification", async () => {
    const ctx = await makeOrgContext("AI Draft Rejection Org");
    const patient = await makePatient(ctx, "Draft Reject Patient");

    const prepared = draftPatientEmailTool.prepare({
      patientId: patient.id,
      recipient: "patient@example.com",
      subject: "Your upcoming dental appointment reminder",
      body: "Please remember your appointment tomorrow.",
    });

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const result = (await runCommand(
      { ctx, action: "ai.draft.test", actor: { type: "USER" } },
      (unit) => prepared.invoke(ctx, { unit }),
    )) as { rejected?: boolean; title?: string; warning?: string };

    expect(result.rejected).toBe(true);
    expect(result.title).toContain("No Upcoming Scheduled Appointment");

    // Verify in-app notification was created
    const notifications = await prisma.notification.findMany({
      where: { organizationId: ctx.organizationId },
    });

    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0]?.severity).toBe("WARNING");
    expect(notifications[0]?.title).toContain("Inappropriate Action Warning");
  });

  it("send_patient_email rejects inappropriate balance reminder and creates warning notification", async () => {
    const ctx = await makeOrgContext("AI Send Rejection Org");
    const patient = await makePatient(ctx, "Send Reject Patient");

    const prepared = sendPatientEmailTool.prepare({
      patientId: patient.id,
      recipient: "patient@example.com",
      subject: "Overdue bill statement balance notice",
      body: "Please settle your outstanding bill balance.",
    });

    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const result = (await runCommand(
      { ctx, action: "ai.send.test", actor: { type: "USER" } },
      (unit) => prepared.invoke(ctx, { unit }),
    )) as { success?: boolean; rejected?: boolean; title?: string };

    expect(result.success).toBe(false);
    expect(result.rejected).toBe(true);
    expect(result.title).toContain("No Outstanding Balance");

    // Verify in-app notification was created
    const notifications = await prisma.notification.findMany({
      where: { organizationId: ctx.organizationId },
    });

    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0]?.severity).toBe("WARNING");
    expect(notifications[0]?.body).toContain("outstanding balance of ₹0.00");
  });
});

describe("generateAiDraft incorporates verified real data and warning", () => {
  it("returns warning and creates notification when drafted for patient without appointment", async () => {
    const ctx = await makeOrgContext("AI Draft Warning Org");
    const patient = await makePatient(ctx, "AI Warning Patient");

    const draft = await generateAiDraft(ctx, {
      patientId: patient.id,
      topic: "APPOINTMENT_REMINDER",
    });

    expect(draft.subject).toBeTruthy();
    expect(draft.body).toBeTruthy();
    expect(draft.warning).toBeDefined();
    expect(draft.warning?.title).toContain("No Upcoming Scheduled Appointment");

    const notifications = await prisma.notification.findMany({
      where: { organizationId: ctx.organizationId },
    });
    expect(notifications.some((n) => n.title.includes("Inappropriate Action Warning"))).toBe(true);
  });
});
