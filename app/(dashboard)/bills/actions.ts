"use server";

import { redirect } from "next/navigation";

import { action } from "@/lib/server/action";
import {
  billFormSchema,
  billIdSchema,
  voidBillSchema,
  recordPaymentSchema,
  confirmPaymentSchema,
  refundPaymentSchema,
  createBill,
  voidBill,
  recordPayment,
  confirmPayment,
  refundPayment,
} from "@/services/billing";

function fromForm(formData: FormData): Record<string, unknown> {
  // Pull bill items out: items[0][description], items[0][quantity], etc.
  const raw = Object.fromEntries(formData.entries());

  // Reconstruct items array from flat form fields.
  const items: Array<{ description: string; quantity: string; unitPrice: string }> = [];
  let i = 0;
  while (raw[`items[${i}][description]`] !== undefined) {
    items.push({
      description: raw[`items[${i}][description]`] as string,
      quantity: raw[`items[${i}][quantity]`] as string,
      unitPrice: raw[`items[${i}][unitPrice]`] as string,
    });
    i++;
  }

  return { ...raw, items };
}

const createBillCommand = action({
  audit: "bill.create",
  permission: "bill.create",
  schema: billFormSchema,
  entityType: "Bill",
  revalidate: (input) => ["/bills", `/patients/${input.patientId}`],
  run: async ({ input, ctx, unit }) => {
    const bill = await createBill(ctx, input, unit);
    return {
      id: bill.id,
      number: bill.number,
      status: bill.status,
    };
  },
});

export async function createBillAction(_previous: unknown, formData: FormData) {
  const result = await createBillCommand(fromForm(formData));
  if (result.ok) redirect(`/bills/${result.data.id}`);
  return result;
}

const voidBillCommand = action({
  audit: "bill.void",
  permission: "bill.void",
  schema: voidBillSchema,
  entityType: "Bill",
  revalidate: (input) => ["/bills", `/bills/${input.id}`],
  run: async ({ input, ctx, unit }) => {
    const bill = await voidBill(ctx, input, unit);
    return {
      id: bill.id,
      status: bill.status,
    };
  },
});

export async function voidBillAction(_previous: unknown, formData: FormData) {
  return voidBillCommand(Object.fromEntries(formData.entries()));
}

const recordPaymentCommand = action({
  audit: "payment.record",
  permission: "payment.record",
  schema: recordPaymentSchema,
  entityType: "Payment",
  revalidate: (input) => ["/bills", `/bills/${input.billId}`],
  run: async ({ input, ctx, unit }) => {
    const payment = await recordPayment(ctx, input, unit);
    return {
      id: payment.id,
      billId: payment.billId,
      amount: payment.amount.toString(),
      status: payment.status,
    };
  },
});

export async function recordPaymentAction(_previous: unknown, formData: FormData) {
  return recordPaymentCommand(Object.fromEntries(formData.entries()));
}

const confirmPaymentCommand = action({
  audit: "payment.confirm",
  permission: "payment.confirm",
  schema: confirmPaymentSchema,
  entityType: "Payment",
  revalidate: () => ["/bills"],
  run: async ({ input, ctx, unit, intent }) => {
    const payment = await confirmPayment(ctx, input, intent, unit);
    return {
      id: payment.id,
      billId: payment.billId,
      amount: payment.amount.toString(),
      status: payment.status,
    };
  },
});

export async function confirmPaymentAction(_previous: unknown, formData: FormData) {
  return confirmPaymentCommand(Object.fromEntries(formData.entries()));
}

const refundPaymentCommand = action({
  audit: "payment.refund",
  permission: "payment.refund",
  schema: refundPaymentSchema,
  entityType: "Payment",
  revalidate: () => ["/bills"],
  run: async ({ input, ctx, unit }) => {
    const payment = await refundPayment(ctx, input, unit);
    return {
      id: payment.id,
      billId: payment.billId,
      amount: payment.amount.toString(),
      status: payment.status,
    };
  },
});

export async function refundPaymentAction(_previous: unknown, formData: FormData) {
  return refundPaymentCommand(Object.fromEntries(formData.entries()));
}

// Simple status-bump with just the bill id (e.g., future: issue a draft)
const issueBillCommand = action({
  audit: "bill.issue",
  permission: "bill.create",
  schema: billIdSchema,
  entityType: "Bill",
  revalidate: (input) => ["/bills", `/bills/${input.id}`],
  run: async ({ input, ctx, unit }) => {
    return unit.db.bill.update({
      where: { id: input.id, organizationId: ctx.organizationId },
      data: { status: "ISSUED", issuedAt: new Date() },
    });
  },
});

export async function issueBillAction(formData: FormData) {
  await issueBillCommand(Object.fromEntries(formData.entries()));
}
