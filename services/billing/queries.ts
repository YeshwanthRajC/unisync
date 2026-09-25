import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Db } from "@/lib/db/types";
import { orgWhere } from "@/lib/db/scope";
import { NotFoundError } from "@/lib/server/errors";
import { Decimal } from "@/lib/db/generated/internal/prismaNamespace";
import { BillStatus } from "@/lib/db/generated/enums";

const BILL_ITEMS_INCLUDE = {
  items: {
    orderBy: { position: "asc" as const },
  },
} as const;

const PAYMENTS_INCLUDE = {
  payments: {
    orderBy: { recordedAt: "asc" as const },
  },
} as const;

export const BILL_FULL_INCLUDE = {
  ...BILL_ITEMS_INCLUDE,
  ...PAYMENTS_INCLUDE,
  patient: { select: { id: true, fullName: true, phone: true } },
} as const;

export async function listBills(
  ctx: OrganizationContext,
  filters: { status?: BillStatus; patientId?: string } = {},
  db: Db = prisma,
) {
  return db.bill.findMany({
    where: orgWhere(ctx, {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.patientId ? { patientId: filters.patientId } : {}),
    }),
    orderBy: { createdAt: "desc" },
    include: {
      ...BILL_ITEMS_INCLUDE,
      ...PAYMENTS_INCLUDE,
      patient: { select: { id: true, fullName: true, phone: true } },
    },
  });
}

export async function getBillOrThrow(
  ctx: OrganizationContext,
  id: string,
  db: Db = prisma,
) {
  const bill = await db.bill.findFirst({
    where: orgWhere(ctx, { id }),
    include: BILL_FULL_INCLUDE,
  });

  if (!bill) throw new NotFoundError("bill");
  return bill;
}

export async function listBillsForPatient(
  ctx: OrganizationContext,
  patientId: string,
  db: Db = prisma,
) {
  return db.bill.findMany({
    where: orgWhere(ctx, { patientId }),
    orderBy: { createdAt: "desc" },
    include: {
      ...BILL_ITEMS_INCLUDE,
      ...PAYMENTS_INCLUDE,
    },
  });
}

export async function getPaymentOrThrow(
  ctx: OrganizationContext,
  id: string,
  db: Db = prisma,
) {
  const payment = await db.payment.findFirst({
    where: orgWhere(ctx, { id }),
  });

  if (!payment) throw new NotFoundError("payment");
  return payment;
}

/**
 * Derives how much of a bill has been confirmed-paid.
 * This is always computed from the ledger, never stored.
 */
export function computeAmountPaid(
  payments: { status: string; amount: Decimal }[],
): Decimal {
  return payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((sum, p) => sum.add(p.amount), new Decimal(0));
}

/**
 * Returns a human-readable balance summary for a bill.
 * Used on the list and detail pages.
 */
export function computeBalance(
  total: Decimal,
  payments: { status: string; amount: Decimal }[],
): { amountPaid: Decimal; balance: Decimal } {
  const amountPaid = computeAmountPaid(payments);
  const balance = total.sub(amountPaid);
  return { amountPaid, balance };
}

/** For Organization Pulse / home: count of bills with outstanding balance. */
export async function countOutstandingBills(
  ctx: OrganizationContext,
  db: Db = prisma,
): Promise<number> {
  // A bill is "outstanding" if it is ISSUED and not fully paid.
  // We load ISSUED bills with their payments and filter by confirmed totals.
  const bills = await db.bill.findMany({
    where: orgWhere(ctx, { status: BillStatus.ISSUED }),
    include: {
      payments: {
        select: { status: true, amount: true },
      },
    },
  });

  return bills.filter((b) => {
    const paid = computeAmountPaid(b.payments);
    return paid.lt(b.total);
  }).length;
}

/**
 * Generate the next sequential bill number for an organization.
 * Format: BILL-YYYYMM-NNNN, unique within the organization.
 */
export async function generateBillNumber(
  ctx: OrganizationContext,
  db: Db = prisma,
): Promise<string> {
  const now = new Date();
  const prefix = `BILL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-`;

  const last = await db.bill.findFirst({
    where: orgWhere(ctx, { number: { startsWith: prefix } }),
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const sequence = last
    ? (parseInt(last.number.slice(prefix.length), 10) || 0) + 1
    : 1;

  return `${prefix}${String(sequence).padStart(4, "0")}`;
}
