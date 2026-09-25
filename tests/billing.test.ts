import { afterEach, describe, expect, it } from "vitest";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Decimal } from "@/lib/db/generated/internal/prismaNamespace";
import { NotFoundError, RuleViolationError } from "@/lib/server/errors";
import { runCommand } from "@/lib/server/unit";
import {
  createBill,
  confirmPayment,
  recordPayment,
  voidBill,
  refundPayment,
} from "@/services/billing/commands";
import {
  getBillOrThrow,
  computeBalance,
} from "@/services/billing/queries";
import { createPatient } from "@/services/patients";

/**
 * Billing carries the product's second manual gate: `confirmPayment` requires
 * a `HumanIntent`, which is unforgeable at the type level.
 *
 * That guarantee cannot be exercised from a test that never has a HumanIntent
 * to withhold — what a test CAN check is the second, independent layer: the
 * database's CHECK constraint refuses a CONFIRMED row with no confirmer, even
 * bypassing the application entirely.
 */

const TEST_SLUG_PREFIX = "billing-test-";
const TEST_PROFILE_ID = "cccccccc-0000-4000-8000-000000000003";

async function makeOrgContext(name: string): Promise<OrganizationContext> {
  await prisma.profile.upsert({
    where: { id: TEST_PROFILE_ID },
    create: { id: TEST_PROFILE_ID, email: "billing-test@example.com" },
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

async function makeBill(ctx: OrganizationContext, patientId: string) {
  return runCommand(
    { ctx, action: "test.bill.create", actor: { type: "USER" } },
    (unit) =>
      createBill(
        ctx,
        {
          patientId,
          notes: "Test bill",
          items: [{ description: "Consultation", quantity: 1, unitPrice: 500 }],
          discount: 0,
          tax: 0,
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

describe("billing: the manual confirm gate", () => {
  it("refuses a CONFIRMED payment row with no confirmer, even via a raw insert bypassing the application", async () => {
    const ctx = await makeOrgContext("Bill Check Org");
    const patient = await makePatient(ctx, "Check Patient");
    const bill = await makeBill(ctx, patient.id);

    await expect(
      prisma.$executeRaw`
        INSERT INTO payments (id, "organizationId", "billId", amount, method, status, "recordedAt", "updatedAt")
        VALUES (gen_random_uuid(), ${ctx.organizationId}::uuid, ${bill.id}::uuid, 500, 'CASH', 'CONFIRMED', now(), now())
      `,
    ).rejects.toThrow(/payment_confirmed_requires_human/);
  });

  it("confirmPayment writes confirmedAt/confirmedByProfileId from the intent", async () => {
    const ctx = await makeOrgContext("Bill Confirm Org");
    const patient = await makePatient(ctx, "Confirm Patient");
    const bill = await makeBill(ctx, patient.id);

    const payment = await runCommand(
      { ctx, action: "test.payment.record", actor: { type: "USER" } },
      (unit) =>
        recordPayment(
          ctx,
          {
            billId: bill.id,
            amount: 500,
            method: "CASH",
          },
          unit,
        ),
    );

    expect(payment.status).toBe("RECORDED");

    const intent = { profileId: ctx.profileId, at: new Date() } as Parameters<
      typeof confirmPayment
    >[2];

    const confirmed = await runCommand(
      { ctx, action: "payment.confirm", actor: { type: "USER" } },
      (unit) =>
        confirmPayment(ctx, { id: payment.id }, intent, unit),
    );

    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.confirmedByProfileId).toBe(ctx.profileId);
    expect(confirmed.confirmedAt).not.toBeNull();
  });

  it("refuses to confirm an already-confirmed payment", async () => {
    const ctx = await makeOrgContext("Bill Double Confirm Org");
    const patient = await makePatient(ctx, "Double Confirm Patient");
    const bill = await makeBill(ctx, patient.id);

    const payment = await runCommand(
      { ctx, action: "test.payment.record", actor: { type: "USER" } },
      (unit) =>
        recordPayment(ctx, { billId: bill.id, amount: 500, method: "CASH" }, unit),
    );

    const intent = { profileId: ctx.profileId, at: new Date() } as Parameters<
      typeof confirmPayment
    >[2];

    await runCommand(
      { ctx, action: "payment.confirm", actor: { type: "USER" } },
      (unit) => confirmPayment(ctx, { id: payment.id }, intent, unit),
    );

    await expect(
      runCommand(
        { ctx, action: "payment.confirm", actor: { type: "USER" } },
        (unit) => confirmPayment(ctx, { id: payment.id }, intent, unit),
      ),
    ).rejects.toThrow(RuleViolationError);
  });
});

describe("billing: bill lifecycle", () => {
  it("createBill produces a correctly numbered, ISSUED bill with computed totals", async () => {
    const ctx = await makeOrgContext("Bill Create Org");
    const patient = await makePatient(ctx, "Bill Patient");

    const bill = await runCommand(
      { ctx, action: "test.bill.create", actor: { type: "USER" } },
      (unit) =>
        createBill(
          ctx,
          {
            patientId: patient.id,
            items: [
              { description: "Cleaning", quantity: 1, unitPrice: 1000 },
              { description: "X-Ray", quantity: 2, unitPrice: 250 },
            ],
            discount: 100,
            tax: 90,
          },
          unit,
        ),
    );

    expect(bill.status).toBe("ISSUED");
    expect(bill.number).toMatch(/^BILL-\d{6}-\d{4}$/);
    expect(bill.subtotal.toString()).toBe("1500");
    expect(bill.discount.toString()).toBe("100");
    expect(bill.tax.toString()).toBe("90");
    expect(bill.total.toString()).toBe("1490");
    expect(bill.items).toHaveLength(2);
  });

  it("voidBill sets status to VOID", async () => {
    const ctx = await makeOrgContext("Bill Void Org");
    const patient = await makePatient(ctx, "Void Patient");
    const bill = await makeBill(ctx, patient.id);

    const voided = await runCommand(
      { ctx, action: "bill.void", actor: { type: "USER" } },
      (unit) =>
        voidBill(ctx, { id: bill.id, voidReason: "Duplicate entry" }, unit),
    );

    expect(voided.status).toBe("VOID");
    expect(voided.voidReason).toBe("Duplicate entry");
    expect(voided.voidedAt).not.toBeNull();
  });

  it("refuses to void a bill with confirmed payments", async () => {
    const ctx = await makeOrgContext("Bill Void Paid Org");
    const patient = await makePatient(ctx, "Void Paid Patient");
    const bill = await makeBill(ctx, patient.id);

    const payment = await runCommand(
      { ctx, action: "test.payment.record", actor: { type: "USER" } },
      (unit) => recordPayment(ctx, { billId: bill.id, amount: 500, method: "CASH" }, unit),
    );

    const intent = { profileId: ctx.profileId, at: new Date() } as Parameters<
      typeof confirmPayment
    >[2];
    await runCommand(
      { ctx, action: "payment.confirm", actor: { type: "USER" } },
      (unit) => confirmPayment(ctx, { id: payment.id }, intent, unit),
    );

    await expect(
      runCommand(
        { ctx, action: "bill.void", actor: { type: "USER" } },
        (unit) => voidBill(ctx, { id: bill.id, voidReason: "Test" }, unit),
      ),
    ).rejects.toThrow(RuleViolationError);
  });

  it("treats another organization's bill id as not found", async () => {
    const orgA = await makeOrgContext("Bill Org A");
    const orgB = await makeOrgContext("Bill Org B");
    const patientA = await makePatient(orgA, "Patient A");
    const bill = await makeBill(orgA, patientA.id);

    await expect(getBillOrThrow(orgB, bill.id)).rejects.toThrow(NotFoundError);
  });
});

describe("billing: computeBalance", () => {
  it("counts only CONFIRMED payments toward the balance", () => {
    const total = new Decimal("1000");
    const payments = [
      { status: "CONFIRMED", amount: new Decimal("400") },
      { status: "RECORDED", amount: new Decimal("600") }, // not yet confirmed
      { status: "REFUNDED", amount: new Decimal("400") }, // refunded, not counted
    ];

    const { amountPaid, balance } = computeBalance(total, payments);
    expect(amountPaid.toString()).toBe("400");
    expect(balance.toString()).toBe("600");
  });
});

describe("billing: payment refund", () => {
  it("refundPayment sets status to REFUNDED", async () => {
    const ctx = await makeOrgContext("Bill Refund Org");
    const patient = await makePatient(ctx, "Refund Patient");
    const bill = await makeBill(ctx, patient.id);

    const payment = await runCommand(
      { ctx, action: "test.payment.record", actor: { type: "USER" } },
      (unit) => recordPayment(ctx, { billId: bill.id, amount: 500, method: "UPI" }, unit),
    );

    const intent = { profileId: ctx.profileId, at: new Date() } as Parameters<
      typeof confirmPayment
    >[2];
    await runCommand(
      { ctx, action: "payment.confirm", actor: { type: "USER" } },
      (unit) => confirmPayment(ctx, { id: payment.id }, intent, unit),
    );

    const refunded = await runCommand(
      { ctx, action: "payment.refund", actor: { type: "USER" } },
      (unit) =>
        refundPayment(ctx, { id: payment.id, refundReason: "Patient request" }, unit),
    );

    expect(refunded.status).toBe("REFUNDED");
    expect(refunded.refundReason).toBe("Patient request");
  });

  it("refuses to refund a RECORDED (not yet confirmed) payment", async () => {
    const ctx = await makeOrgContext("Bill Refund Blocked Org");
    const patient = await makePatient(ctx, "Refund Blocked Patient");
    const bill = await makeBill(ctx, patient.id);

    const payment = await runCommand(
      { ctx, action: "test.payment.record", actor: { type: "USER" } },
      (unit) => recordPayment(ctx, { billId: bill.id, amount: 500, method: "CARD" }, unit),
    );

    await expect(
      runCommand(
        { ctx, action: "payment.refund", actor: { type: "USER" } },
        (unit) =>
          refundPayment(ctx, { id: payment.id, refundReason: "Test" }, unit),
      ),
    ).rejects.toThrow(RuleViolationError);
  });
});
