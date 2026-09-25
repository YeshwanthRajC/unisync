import { z } from "zod";

/**
 * Input schemas for the billing module.
 * No `server-only`: client components import these to validate before submitting.
 */

export const BILL_STATUSES = ["DRAFT", "ISSUED", "VOID"] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  VOID: "Void",
};

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "UPI",
  "BANK_TRANSFER",
  "CHEQUE",
  "OTHER",
] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

export const billItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required.").max(500),
  quantity: z.coerce
    .number()
    .positive("Quantity must be positive.")
    .max(9999),
  unitPrice: z.coerce
    .number()
    .min(0, "Unit price cannot be negative.")
    .max(9_999_999),
});

export type BillItemInput = z.infer<typeof billItemSchema>;

export const billFormSchema = z.object({
  patientId: z.uuid("Choose a patient."),
  appointmentId: z.uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  items: z
    .array(billItemSchema)
    .min(1, "Add at least one line item."),
  /** Discount amount in the organization's currency. */
  discount: z.coerce
    .number()
    .min(0, "Discount cannot be negative.")
    .max(9_999_999)
    .optional()
    .default(0),
  /** Tax amount. */
  tax: z.coerce
    .number()
    .min(0, "Tax cannot be negative.")
    .max(9_999_999)
    .optional()
    .default(0),
});

export type BillFormInput = z.infer<typeof billFormSchema>;

export const billIdSchema = z.object({ id: z.uuid() });

export const voidBillSchema = z.object({
  id: z.uuid(),
  voidReason: z
    .string()
    .trim()
    .min(3, "Explain why this bill is being voided.")
    .max(500),
});

export type VoidBillInput = z.infer<typeof voidBillSchema>;

export const recordPaymentSchema = z.object({
  billId: z.uuid(),
  amount: z.coerce
    .number()
    .positive("Payment amount must be positive.")
    .max(9_999_999),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const confirmPaymentSchema = z.object({
  id: z.uuid(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

export const paymentIdSchema = z.object({ id: z.uuid() });

export const refundPaymentSchema = z.object({
  id: z.uuid(),
  refundReason: z
    .string()
    .trim()
    .min(3, "Explain why this payment is being refunded.")
    .max(500),
});

export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;

/** Filter for the bills list page. */
export const billListParamsSchema = z.object({
  status: z
    .enum(["DRAFT", "ISSUED", "VOID", "ALL"])
    .optional()
    .default("ALL"),
  patientId: z.uuid().optional(),
});
