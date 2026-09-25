import "server-only";

import type { HumanIntent } from "@/lib/auth/human-intent";
import type { OrganizationContext } from "@/lib/auth/session";
import { orgScope, orgWhere } from "@/lib/db/scope";
import { RuleViolationError } from "@/lib/server/errors";
import type { UnitOfWork } from "@/lib/server/unit";
import { getPatientOrThrow } from "@/services/patients";
import { getAppointmentOrThrow } from "@/services/appointments/queries";
import {
  getBillOrThrow,
  getPaymentOrThrow,
  generateBillNumber,
} from "@/services/billing/queries";
import type {
  BillFormInput,
  VoidBillInput,
  RecordPaymentInput,
  ConfirmPaymentInput,
  RefundPaymentInput,
} from "@/services/billing/schema";
import { Decimal } from "@/lib/db/generated/internal/prismaNamespace";

export async function createBill(
  ctx: OrganizationContext,
  input: BillFormInput,
  unit: UnitOfWork,
) {
  await getPatientOrThrow(ctx, input.patientId, unit.db);

  if (input.appointmentId) {
    const appt = await getAppointmentOrThrow(ctx, input.appointmentId, unit.db);
    if (appt.patientId !== input.patientId) {
      throw new RuleViolationError(
        "That appointment belongs to a different patient.",
      );
    }
  }

  const number = await generateBillNumber(ctx, unit.db);

  // Compute totals from line items.
  const subtotal = input.items.reduce(
    (sum, item) => sum.add(new Decimal(item.quantity).mul(new Decimal(item.unitPrice))),
    new Decimal(0),
  );
  const discount = new Decimal(input.discount ?? 0);
  const tax = new Decimal(input.tax ?? 0);
  const total = subtotal.sub(discount).add(tax);

  if (total.lt(0)) {
    throw new RuleViolationError("Bill total cannot be negative.");
  }

  const bill = await unit.db.bill.create({
    data: {
      patientId: input.patientId,
      appointmentId: input.appointmentId || null,
      number,
      status: "ISSUED",
      issuedAt: new Date(),
      subtotal,
      discount,
      tax,
      total,
      notes: input.notes || null,
      createdByProfileId: ctx.profileId,
      ...orgScope(ctx),
      items: {
        create: input.items.map((item, i) => ({
          description: item.description,
          quantity: new Decimal(item.quantity),
          unitPrice: new Decimal(item.unitPrice),
          lineTotal: new Decimal(item.quantity).mul(new Decimal(item.unitPrice)),
          position: i,
        })),
      },
    },
    include: { items: true },
  });

  unit.target("Bill", bill.id);
  unit.note({ number, total: total.toString(), patientId: input.patientId });

  return bill;
}

/**
 * Void a bill — the manual gate for bill destruction.
 * Requires `bill.void` which is in HUMAN_ONLY_PERMISSIONS.
 */
export async function voidBill(
  ctx: OrganizationContext,
  input: VoidBillInput,
  unit: UnitOfWork,
) {
  const existing = await getBillOrThrow(ctx, input.id, unit.db);

  if (existing.status === "VOID") {
    throw new RuleViolationError("This bill has already been voided.");
  }

  // Cannot void a bill that has confirmed payments.
  const hasConfirmedPayments = existing.payments.some(
    (p) => p.status === "CONFIRMED",
  );
  if (hasConfirmedPayments) {
    throw new RuleViolationError(
      "This bill has confirmed payments and cannot be voided. Refund the payments first.",
    );
  }

  const bill = await unit.db.bill.update({
    where: orgWhere(ctx, { id: input.id }),
    data: {
      status: "VOID",
      voidedAt: new Date(),
      voidReason: input.voidReason,
    },
  });

  unit.target("Bill", bill.id);
  unit.note({ voidReason: input.voidReason });
  return bill;
}

/**
 * Record a payment against a bill. Any user with `payment.record` may do this.
 * The payment starts as RECORDED — confirming it is a separate human act.
 */
export async function recordPayment(
  ctx: OrganizationContext,
  input: RecordPaymentInput,
  unit: UnitOfWork,
) {
  const bill = await getBillOrThrow(ctx, input.billId, unit.db);

  if (bill.status === "VOID") {
    throw new RuleViolationError(
      "Payments cannot be recorded against a voided bill.",
    );
  }

  const payment = await unit.db.payment.create({
    data: {
      billId: input.billId,
      amount: new Decimal(input.amount),
      method: input.method,
      reference: input.reference || null,
      notes: input.notes || null,
      status: "RECORDED",
      recordedByProfileId: ctx.profileId,
      recordedAt: new Date(),
      ...orgScope(ctx),
    },
  });

  unit.target("Payment", payment.id);
  unit.note({
    billId: input.billId,
    amount: input.amount,
    method: input.method,
  });

  return payment;
}

/**
 * The second manual gate. `intent` is a `HumanIntent` — a type branded with a
 * unique symbol, mintable only inside `lib/server/action.ts` from a real
 * cookie-authenticated request. `lib/ai/**` is ESLint-forbidden from importing
 * the module that mints it, so an AI tool cannot call this function: not
 * because a runtime check rejects it, but because the code does not compile.
 * The database's CHECK constraint on `payments` is the second, independent
 * layer of the same guarantee.
 */
export async function confirmPayment(
  ctx: OrganizationContext,
  input: ConfirmPaymentInput,
  intent: HumanIntent,
  unit: UnitOfWork,
) {
  const existing = await getPaymentOrThrow(ctx, input.id, unit.db);

  if (existing.status !== "RECORDED") {
    throw new RuleViolationError(
      `A payment that is ${existing.status.toLowerCase()} cannot be confirmed.`,
    );
  }

  const payment = await unit.db.payment.update({
    where: orgWhere(ctx, { id: input.id }),
    data: {
      status: "CONFIRMED",
      confirmedAt: intent.at,
      confirmedByProfileId: intent.profileId,
      notes: input.notes || existing.notes,
    },
  });

  unit.target("Payment", payment.id);
  unit.note({ billId: payment.billId, amount: payment.amount.toString() });
  return payment;
}

/**
 * Refund a confirmed payment. Requires `payment.refund` which is in
 * HUMAN_ONLY_PERMISSIONS.
 */
export async function refundPayment(
  ctx: OrganizationContext,
  input: RefundPaymentInput,
  unit: UnitOfWork,
) {
  const existing = await getPaymentOrThrow(ctx, input.id, unit.db);

  if (existing.status !== "CONFIRMED") {
    throw new RuleViolationError(
      `Only a CONFIRMED payment can be refunded. This payment is ${existing.status.toLowerCase()}.`,
    );
  }

  const payment = await unit.db.payment.update({
    where: orgWhere(ctx, { id: input.id }),
    data: {
      status: "REFUNDED",
      refundedAt: new Date(),
      refundReason: input.refundReason,
      confirmedAt: null,
      confirmedByProfileId: null,
    },
  });

  unit.target("Payment", payment.id);
  unit.note({ refundReason: input.refundReason, billId: payment.billId });
  return payment;
}
