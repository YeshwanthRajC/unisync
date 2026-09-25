import "server-only";

import { z } from "zod";

import { defineTool } from "@/lib/ai/tools/define";
import {
  createBill,
  getBillOrThrow,
  listBills,
  recordPayment,
} from "@/services/billing";

export const listBillsTool = defineTool({
  name: "list_bills",
  description: "List bills and invoices for the clinic, with optional filtering by status or patient.",
  permission: "bill.read",
  audit: "bill.read",
  mode: "read",
  input: z.object({
    status: z
      .enum(["ALL", "DRAFT", "ISSUED", "VOID"])
      .optional()
      .describe("Filter by bill status, or ALL for all statuses."),
    patientId: z.string().optional().describe("Filter bills by patient UUID."),
  }),
  confirmation: { required: false },
  execute: async ({ input, ctx, db }) => {
    const status = input.status === "ALL" ? undefined : input.status;
    const bills = await listBills(ctx, { status, patientId: input.patientId }, db);
    return bills.slice(0, 15).map((b) => ({
      id: b.id,
      number: b.number,
      patientId: b.patientId,
      patientName: b.patient.fullName,
      total: b.total.toString(),
      status: b.status,
      createdAt: b.createdAt.toISOString(),
      paymentsCount: b.payments.length,
    }));
  },
});

export const getBillDetailsTool = defineTool({
  name: "get_bill_details",
  description: "Retrieve complete line items, subtotal, discounts, and payment history for a specific bill.",
  permission: "bill.read",
  audit: "bill.read",
  mode: "read",
  input: z.object({
    billId: z.string().describe("UUID of the bill to retrieve."),
  }),
  confirmation: { required: false },
  execute: async ({ input, ctx, db }) => {
    const b = await getBillOrThrow(ctx, input.billId, db);
    return {
      id: b.id,
      number: b.number,
      patientId: b.patientId,
      patientName: b.patient.fullName,
      subtotal: b.subtotal.toString(),
      discount: b.discount.toString(),
      tax: b.tax.toString(),
      total: b.total.toString(),
      status: b.status,
      notes: b.notes,
      items: b.items.map((i) => ({
        id: i.id,
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: i.unitPrice.toString(),
        lineTotal: i.lineTotal.toString(),
      })),
      payments: b.payments.map((p) => ({
        id: p.id,
        amount: p.amount.toString(),
        method: p.method,
        status: p.status,
        recordedAt: p.recordedAt.toISOString(),
      })),
    };
  },
});

export const createBillTool = defineTool({
  name: "create_bill",
  description:
    "Create an itemized bill or invoice for clinical services and treatments provided to a patient. IMPORTANT: Never generate arbitrary line items or amounts. You MUST ask the user for the specific clinical services/procedures, quantities, and unit prices before invoking this tool.",
  permission: "bill.create",
  audit: "bill.create",
  mode: "write",
  confirmation: {
    required: true,
    describe: (input) =>
      `Create invoice for patient ${input.patientId} with ${input.items.length} line items`,
  },
  input: z.object({
    patientId: z.string().describe("UUID of the patient being billed."),
    appointmentId: z
      .string()
      .optional()
      .describe("Optional appointment UUID associated with this invoice."),
    items: z
      .array(
        z.object({
          description: z.string().min(1).describe("Description of clinical service, medication, or procedure."),
          quantity: z.number().int().min(1).describe("Number of units provided."),
          unitPrice: z.number().min(0).describe("Price per unit in clinic currency."),
        }),
      )
      .min(1)
      .describe("List of invoice line items."),
    discount: z.number().min(0).optional().describe("Discount amount to deduct from total."),
    tax: z.number().min(0).optional().describe("Tax amount to add to total."),
    notes: z.string().optional().describe("Optional invoice notes or payment instructions."),
  }),
  execute: async ({ input, ctx, unit }) => {
    const bill = await createBill(
      ctx,
      {
        patientId: input.patientId,
        appointmentId: input.appointmentId,
        items: input.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        discount: input.discount ?? 0,
        tax: input.tax ?? 0,
        notes: input.notes,
      },
      unit,
    );
    return { id: bill.id, number: bill.number, total: bill.total.toString() };
  },
});

export const recordPaymentTool = defineTool({
  name: "record_payment",
  description: "Record a payment received from a patient against an issued bill. Confirmation requires staff verification.",
  permission: "payment.record",
  audit: "payment.record",
  mode: "write",
  confirmation: {
    required: true,
    describe: (input) =>
      `Record ${input.method} payment of ${input.amount} against bill ID ${input.billId}`,
  },
  input: z.object({
    billId: z.string().describe("UUID of the bill to record payment against."),
    amount: z.number().positive().describe("Payment amount received."),
    method: z
      .enum(["CASH", "CARD", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"])
      .describe("Payment method used by patient."),
    notes: z.string().optional().describe("Optional reference number or notes for this payment."),
  }),
  execute: async ({ input, ctx, unit }) => {
    const payment = await recordPayment(
      ctx,
      {
        billId: input.billId,
        amount: input.amount,
        method: input.method,
        notes: input.notes,
      },
      unit,
    );
    return { id: payment.id, amount: payment.amount.toString(), status: payment.status };
  },
});
