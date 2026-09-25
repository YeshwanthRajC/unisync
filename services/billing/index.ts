/**
 * Public surface of the billing module. Other modules import from here only.
 */
export {
  createBill,
  voidBill,
  recordPayment,
  confirmPayment,
  refundPayment,
} from "@/services/billing/commands";
export {
  listBills,
  getBillOrThrow,
  listBillsForPatient,
  getPaymentOrThrow,
  computeAmountPaid,
  computeBalance,
  countOutstandingBills,
  generateBillNumber,
} from "@/services/billing/queries";
export {
  BILL_STATUSES,
  BILL_STATUS_LABELS,
  type BillStatus,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  billFormSchema,
  billIdSchema,
  voidBillSchema,
  recordPaymentSchema,
  confirmPaymentSchema,
  paymentIdSchema,
  refundPaymentSchema,
  billListParamsSchema,
  type BillFormInput,
  type VoidBillInput,
  type RecordPaymentInput,
  type ConfirmPaymentInput,
  type RefundPaymentInput,
} from "@/services/billing/schema";
