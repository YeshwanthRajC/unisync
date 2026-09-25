import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import type { Db } from "@/lib/db/types";
import { prisma } from "@/lib/db/prisma";
import { orgWhere } from "@/lib/db/scope";
import {
  AppointmentStatus,
  BillStatus,
  PaymentStatus,
  FollowUpStatus,
} from "@/lib/db/generated/enums";

export type ActionTopic =
  | "APPOINTMENT_REMINDER"
  | "OVERDUE_BILL_REMINDER"
  | "FOLLOW_UP_RECALL"
  | "GENERAL";

export type PatientActionContext = {
  valid: boolean;
  topic: ActionTopic;
  severity?: "INFO" | "WARNING";
  title?: string;
  message?: string;
  suggestion?: string;
  patientName: string;
  appointment?: {
    id: string;
    scheduledAt: Date;
    type: string;
    formattedDate: string;
  };
  billing?: {
    unpaidCount: number;
    totalOutstanding: number;
    latestBillNumber?: string;
    formattedBalance: string;
  };
  followUp?: {
    id: string;
    reason: string;
    dueDate: Date;
    formattedDate: string;
  };
};

/**
 * Detect the intended topic or category from text or action label.
 */
export function detectActionTopic(actionOrText: string): ActionTopic {
  const text = actionOrText.toLowerCase();

  if (
    /appointment_reminder|appointment.*remind|remind.*appointment|upcoming appointment|visit reminder|consultation reminder/i.test(
      text,
    )
  ) {
    return "APPOINTMENT_REMINDER";
  }

  if (
    /overdue_bill_reminder|bill|invoice|payment|balance|overdue|outstanding|statement/i.test(
      text,
    )
  ) {
    return "OVERDUE_BILL_REMINDER";
  }

  if (/follow_up_recall|follow-?up|recall|routine recall/i.test(text)) {
    return "FOLLOW_UP_RECALL";
  }

  return "GENERAL";
}

/**
 * Validates real clinic ground truth data for a patient before taking an action.
 * Detects discrepancies, prevents inappropriate communications, and attaches genuine clinic data.
 */
export async function verifyPatientActionContext(
  ctx: OrganizationContext,
  patientId: string,
  actionOrText: string,
  db: Db = prisma,
): Promise<PatientActionContext> {
  const patient = await db.patient.findFirst({
    where: orgWhere(ctx, { id: patientId }),
    select: { id: true, fullName: true, email: true },
  });

  if (!patient) {
    return {
      valid: false,
      topic: "GENERAL",
      severity: "WARNING",
      title: "Patient Not Found",
      message: `Patient ID ${patientId} does not exist in this clinic's records.`,
      suggestion: "Please verify the patient identity before proceeding.",
      patientName: "Unknown Patient",
    };
  }

  const topic = detectActionTopic(actionOrText);

  // 1. Verify Appointment Reminder against real appointment records
  if (topic === "APPOINTMENT_REMINDER") {
    // Look for active appointments (SCHEDULED or CONFIRMED)
    // Starting from 3 hours ago to cover immediate upcoming or today's visits
    const windowStart = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const appointments = await db.appointment.findMany({
      where: orgWhere(ctx, {
        patientId,
        status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        scheduledAt: { gte: windowStart },
      }),
      orderBy: { scheduledAt: "asc" },
      take: 1,
    });

    if (appointments.length === 0 || !appointments[0]) {
      // Check if they had past appointments to provide helpful context
      const pastAppointment = await db.appointment.findFirst({
        where: orgWhere(ctx, { patientId }),
        orderBy: { scheduledAt: "desc" },
      });

      const pastNote = pastAppointment
        ? ` (Last appointment was ${pastAppointment.status.toLowerCase()} on ${new Date(pastAppointment.scheduledAt).toLocaleDateString("en-IN")})`
        : "";

      return {
        valid: false,
        topic: "APPOINTMENT_REMINDER",
        severity: "WARNING",
        title: "No Upcoming Scheduled Appointment",
        patientName: patient.fullName,
        message: `Patient ${patient.fullName} has no active upcoming scheduled appointments on file${pastNote}. Sending an appointment reminder would be incorrect and confusing to the patient.`,
        suggestion:
          "Please verify patient appointment history or schedule an appointment first before sending a reminder.",
      };
    }

    const nearest = appointments[0];
    const formattedDate = new Intl.DateTimeFormat("en-IN", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(nearest.scheduledAt));

    return {
      valid: true,
      topic: "APPOINTMENT_REMINDER",
      patientName: patient.fullName,
      appointment: {
        id: nearest.id,
        scheduledAt: nearest.scheduledAt,
        type: String(nearest.type),
        formattedDate,
      },
    };
  }

  // 2. Verify Overdue / Balance Reminder against real billing records
  if (topic === "OVERDUE_BILL_REMINDER") {
    const issuedBills = await db.bill.findMany({
      where: orgWhere(ctx, {
        patientId,
        status: BillStatus.ISSUED,
      }),
      include: {
        payments: {
          where: { status: PaymentStatus.CONFIRMED },
          select: { amount: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    let totalOutstanding = 0;
    let unpaidCount = 0;
    let latestBillNumber: string | undefined;

    for (const bill of issuedBills) {
      const billTotal = Number(bill.total);
      const paid = bill.payments.reduce(
        (sum: number, p: { amount: { toString(): string } }) =>
          sum + Number(p.amount),
        0,
      );
      const remaining = billTotal - paid;
      if (remaining > 0) {
        totalOutstanding += remaining;
        unpaidCount++;
        if (!latestBillNumber) {
          latestBillNumber = bill.number;
        }
      }
    }

    if (unpaidCount === 0 || totalOutstanding <= 0) {
      return {
        valid: false,
        topic: "OVERDUE_BILL_REMINDER",
        severity: "WARNING",
        title: "No Outstanding Balance Found",
        patientName: patient.fullName,
        message: `Patient ${patient.fullName} has an outstanding balance of ₹0.00. All invoices are settled or paid in full. Sending an overdue balance reminder is inappropriate.`,
        suggestion:
          "Please review the patient's billing tab or generate an invoice before requesting payment.",
        billing: {
          unpaidCount: 0,
          totalOutstanding: 0,
          formattedBalance: "₹0.00",
        },
      };
    }

    return {
      valid: true,
      topic: "OVERDUE_BILL_REMINDER",
      patientName: patient.fullName,
      billing: {
        unpaidCount,
        totalOutstanding,
        latestBillNumber,
        formattedBalance: `₹${totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
      },
    };
  }

  // 3. Verify Follow-up Recall against real follow-up records
  if (topic === "FOLLOW_UP_RECALL") {
    const pendingFollowUp = await db.followUp.findFirst({
      where: orgWhere(ctx, { patientId, status: FollowUpStatus.PENDING }),
      orderBy: { dueDate: "asc" },
    });

    if (pendingFollowUp) {
      const formattedDate = new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeZone: "Asia/Kolkata",
      }).format(new Date(pendingFollowUp.dueDate));

      return {
        valid: true,
        topic: "FOLLOW_UP_RECALL",
        patientName: patient.fullName,
        followUp: {
          id: pendingFollowUp.id,
          reason: pendingFollowUp.reason,
          dueDate: pendingFollowUp.dueDate,
          formattedDate,
        },
      };
    }

    // Still valid as a general routine check-up recall invitation
    return {
      valid: true,
      topic: "FOLLOW_UP_RECALL",
      patientName: patient.fullName,
    };
  }

  return {
    valid: true,
    topic: "GENERAL",
    patientName: patient.fullName,
  };
}
