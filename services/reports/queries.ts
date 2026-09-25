import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Db } from "@/lib/db/types";
import { orgWhere } from "@/lib/db/scope";

export type ClinicReportsData = {
  patientCount: number;
  activePatientCount: number;
  appointmentsSummary: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    upcoming: number;
  };
  financialSummary: {
    totalBilled: number;
    totalCollected: number;
    outstandingBalance: number;
    billsCount: number;
    issuedBillsCount: number;
  };
  paymentMethods: Array<{
    method: string;
    totalAmount: number;
    count: number;
  }>;
  inventorySummary: {
    totalItems: number;
    lowStockCount: number;
  };
  followUpsSummary: {
    total: number;
    pending: number;
    due: number;
    overdue: number;
    completed: number;
  };
};

export async function getClinicReportsData(
  ctx: OrganizationContext,
  db: Db = prisma,
): Promise<ClinicReportsData> {
  const [
    patientCount,
    activePatientCount,
    appointments,
    bills,
    payments,
    inventoryItems,
    followUps,
  ] = await Promise.all([
    db.patient.count({ where: orgWhere(ctx, {}) }),
    db.patient.count({ where: orgWhere(ctx, { isActive: true }) }),
    db.appointment.findMany({
      where: orgWhere(ctx, {}),
      select: { status: true, type: true },
    }),
    db.bill.findMany({
      where: orgWhere(ctx, { status: { not: "VOID" as const } }),
      select: { total: true, status: true },
    }),
    db.payment.findMany({
      where: orgWhere(ctx, { status: "CONFIRMED" as const }),
      select: { amount: true, method: true },
    }),
    db.inventoryItem.findMany({
      where: orgWhere(ctx, { isActive: true }),
      select: { quantityOnHand: true, minimumQuantity: true },
    }),
    db.followUp.findMany({
      where: orgWhere(ctx, {}),
      select: { status: true },
    }),
  ]);

  // Appointments summary
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  let upcoming = 0;

  for (const a of appointments) {
    if (a.status === "COMPLETED") completed += 1;
    else if (a.status === "CANCELLED") cancelled += 1;
    else if (a.status === "NO_SHOW") noShow += 1;
    else upcoming += 1;
  }

  // Financial summary
  const totalBilled = bills.reduce((sum, b) => sum + Number(b.total), 0);
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstandingBalance = Math.max(0, totalBilled - totalCollected);
  const issuedBillsCount = bills.filter((b) => b.status === "ISSUED").length;

  // Payments by method
  const methodMap = new Map<string, { totalAmount: number; count: number }>();
  for (const p of payments) {
    const existing = methodMap.get(p.method) ?? { totalAmount: 0, count: 0 };
    existing.totalAmount += Number(p.amount);
    existing.count += 1;
    methodMap.set(p.method, existing);
  }

  const paymentMethods = Array.from(methodMap.entries()).map(([method, val]) => ({
    method,
    totalAmount: val.totalAmount,
    count: val.count,
  }));

  // Inventory summary
  const lowStockCount = inventoryItems.filter(
    (i) => Number(i.quantityOnHand) <= Number(i.minimumQuantity),
  ).length;

  // Follow-ups summary
  let pendingF = 0;
  let dueF = 0;
  let overdueF = 0;
  let completedF = 0;

  for (const f of followUps) {
    if (f.status === "COMPLETED") completedF += 1;
    else if (f.status === "OVERDUE") overdueF += 1;
    else if (f.status === "DUE") dueF += 1;
    else if (f.status === "PENDING") pendingF += 1;
  }

  return {
    patientCount,
    activePatientCount,
    appointmentsSummary: {
      total: appointments.length,
      completed,
      cancelled,
      noShow,
      upcoming,
    },
    financialSummary: {
      totalBilled,
      totalCollected,
      outstandingBalance,
      billsCount: bills.length,
      issuedBillsCount,
    },
    paymentMethods,
    inventorySummary: {
      totalItems: inventoryItems.length,
      lowStockCount,
    },
    followUpsSummary: {
      total: followUps.length,
      pending: pendingF,
      due: dueF,
      overdue: overdueF,
      completed: completedF,
    },
  };
}
