-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('CONSULTATION', 'CLEANING', 'FILLING', 'EXTRACTION', 'ROOT_CANAL', 'CROWN_OR_BRIDGE', 'ORTHODONTIC', 'FOLLOW_UP', 'EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'RETURN', 'WASTE');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'DUE', 'OVERDUE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PatientEmailStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'FAILED', 'PROVIDER_NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'TOOL');

-- CreateEnum
CREATE TYPE "AiToolExecutionStatus" AS ENUM ('PENDING_CONFIRMATION', 'APPROVED', 'EXECUTED', 'REJECTED', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "commandId" UUID;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "addressLine" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'IN',
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "state" TEXT,
ALTER COLUMN "timezone" SET DEFAULT 'Asia/Kolkata';

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "dateOfBirth" DATE,
    "gender" "Gender" NOT NULL DEFAULT 'UNDISCLOSED',
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "type" "AppointmentType" NOT NULL DEFAULT 'CONSULTATION',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdByProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedByProfileId" UUID,
    "outcomeNotes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "appointmentId" UUID,
    "consultedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chiefComplaint" TEXT,
    "diagnosis" TEXT,
    "treatment" TEXT,
    "notes" TEXT,
    "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
    "recordedByProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "consultationId" UUID,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "medicine" TEXT NOT NULL,
    "dosage" TEXT,
    "frequency" TEXT,
    "durationDays" INTEGER,
    "instructions" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "appointmentId" UUID,
    "number" TEXT NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdByProfileId" UUID,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_items" (
    "id" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bill_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "billId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "PaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "reference" TEXT,
    "notes" TEXT,
    "recordedByProfileId" UUID,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByProfileId" UUID,
    "refundedAt" TIMESTAMP(3),
    "refundReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "quantityOnHand" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minimumQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "preferredQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "performedByProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "appointmentId" UUID,
    "consultationId" UUID,
    "dueDate" DATE NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "assignedToProfileId" UUID,
    "completedAt" TIMESTAMP(3),
    "completedByProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_emails" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "PatientEmailStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedByAI" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "sentByProfileId" UUID,
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    "relatedAppointmentId" UUID,
    "relatedBillId" UUID,
    "relatedFollowUpId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdByProfileId" UUID,
    "title" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "toolName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_tool_executions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "toolName" TEXT NOT NULL,
    "arguments" JSONB NOT NULL,
    "status" "AiToolExecutionStatus" NOT NULL DEFAULT 'EXECUTED',
    "confirmationPrompt" TEXT,
    "requestedByProfileId" UUID,
    "decidedByProfileId" UUID,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_tool_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patients_organizationId_fullName_idx" ON "patients"("organizationId", "fullName");

-- CreateIndex
CREATE INDEX "patients_organizationId_phone_idx" ON "patients"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "patients_organizationId_createdAt_idx" ON "patients"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "appointments_organizationId_scheduledAt_idx" ON "appointments"("organizationId", "scheduledAt");

-- CreateIndex
CREATE INDEX "appointments_organizationId_status_scheduledAt_idx" ON "appointments"("organizationId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "appointments_organizationId_patientId_scheduledAt_idx" ON "appointments"("organizationId", "patientId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "consultations_appointmentId_key" ON "consultations"("appointmentId");

-- CreateIndex
CREATE INDEX "consultations_organizationId_patientId_consultedAt_idx" ON "consultations"("organizationId", "patientId", "consultedAt");

-- CreateIndex
CREATE INDEX "consultations_organizationId_consultedAt_idx" ON "consultations"("organizationId", "consultedAt");

-- CreateIndex
CREATE INDEX "prescriptions_organizationId_patientId_issuedAt_idx" ON "prescriptions"("organizationId", "patientId", "issuedAt");

-- CreateIndex
CREATE INDEX "prescription_items_prescriptionId_idx" ON "prescription_items"("prescriptionId");

-- CreateIndex
CREATE INDEX "bills_organizationId_status_createdAt_idx" ON "bills"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "bills_organizationId_patientId_createdAt_idx" ON "bills"("organizationId", "patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bills_organizationId_number_key" ON "bills"("organizationId", "number");

-- CreateIndex
CREATE INDEX "bill_items_billId_idx" ON "bill_items"("billId");

-- CreateIndex
CREATE INDEX "payments_organizationId_status_recordedAt_idx" ON "payments"("organizationId", "status", "recordedAt");

-- CreateIndex
CREATE INDEX "payments_billId_idx" ON "payments"("billId");

-- CreateIndex
CREATE INDEX "inventory_items_organizationId_isActive_name_idx" ON "inventory_items"("organizationId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_organizationId_sku_key" ON "inventory_items"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "stock_movements_organizationId_createdAt_idx" ON "stock_movements"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_itemId_createdAt_idx" ON "stock_movements"("itemId", "createdAt");

-- CreateIndex
CREATE INDEX "follow_ups_organizationId_status_dueDate_idx" ON "follow_ups"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "follow_ups_organizationId_patientId_dueDate_idx" ON "follow_ups"("organizationId", "patientId", "dueDate");

-- CreateIndex
CREATE INDEX "patient_emails_organizationId_status_createdAt_idx" ON "patient_emails"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "patient_emails_organizationId_patientId_createdAt_idx" ON "patient_emails"("organizationId", "patientId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_organizationId_readAt_createdAt_idx" ON "notifications"("organizationId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "ai_conversations_organizationId_lastMessageAt_idx" ON "ai_conversations"("organizationId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_tool_executions_organizationId_status_createdAt_idx" ON "ai_tool_executions"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ai_tool_executions_conversationId_createdAt_idx" ON "ai_tool_executions"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_organizationId_commandId_key" ON "audit_logs"("organizationId", "commandId");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_closedByProfileId_fkey" FOREIGN KEY ("closedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_recordedByProfileId_fkey" FOREIGN KEY ("recordedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedByProfileId_fkey" FOREIGN KEY ("recordedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_confirmedByProfileId_fkey" FOREIGN KEY ("confirmedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performedByProfileId_fkey" FOREIGN KEY ("performedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "consultations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_assignedToProfileId_fkey" FOREIGN KEY ("assignedToProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_completedByProfileId_fkey" FOREIGN KEY ("completedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_emails" ADD CONSTRAINT "patient_emails_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_emails" ADD CONSTRAINT "patient_emails_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_emails" ADD CONSTRAINT "patient_emails_sentByProfileId_fkey" FOREIGN KEY ("sentByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_emails" ADD CONSTRAINT "patient_emails_relatedAppointmentId_fkey" FOREIGN KEY ("relatedAppointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_emails" ADD CONSTRAINT "patient_emails_relatedBillId_fkey" FOREIGN KEY ("relatedBillId") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_emails" ADD CONSTRAINT "patient_emails_relatedFollowUpId_fkey" FOREIGN KEY ("relatedFollowUpId") REFERENCES "follow_ups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_executions" ADD CONSTRAINT "ai_tool_executions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_executions" ADD CONSTRAINT "ai_tool_executions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_executions" ADD CONSTRAINT "ai_tool_executions_requestedByProfileId_fkey" FOREIGN KEY ("requestedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_tool_executions" ADD CONSTRAINT "ai_tool_executions_decidedByProfileId_fkey" FOREIGN KEY ("decidedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- MANUAL GATES
-- ---------------------------------------------------------------------------
-- Three states in this product must never be reached as a side effect, on a
-- schedule, or because a language model suggested them. The application enforces
-- that with a branded HumanIntent token the AI layer cannot construct, but a type
-- only protects code that goes through the type.
--
-- These constraints make the bad row IMPOSSIBLE -- including via a raw query, a
-- future migration script, a Supabase Studio edit, or a bug three modules away.
--
-- Each is written as an equivalence (=) rather than an implication, so the
-- reverse is also guaranteed: a closer cannot be recorded without the status
-- that justifies it, which stops a half-applied write leaving a misleading row.

ALTER TABLE "appointments" ADD CONSTRAINT "appointment_completed_requires_human"
  CHECK (("status" = 'COMPLETED') = ("closedAt" IS NOT NULL AND "closedByProfileId" IS NOT NULL));

ALTER TABLE "payments" ADD CONSTRAINT "payment_confirmed_requires_human"
  CHECK (("status" = 'CONFIRMED') = ("confirmedAt" IS NOT NULL AND "confirmedByProfileId" IS NOT NULL));

ALTER TABLE "patient_emails" ADD CONSTRAINT "email_sent_requires_human"
  CHECK (("status" = 'SENT') = ("sentAt" IS NOT NULL AND "sentByProfileId" IS NOT NULL));

-- A stock movement records a magnitude; `type` carries the direction. A negative
-- quantity would make the ledger ambiguous and the running balance wrong.
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movement_quantity_positive"
  CHECK ("quantity" > 0);

-- Money never goes backwards by accident.
ALTER TABLE "payments" ADD CONSTRAINT "payment_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "bills" ADD CONSTRAINT "bill_totals_non_negative"
  CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "tax" >= 0 AND "total" >= 0);

-- An appointment occupies time.
ALTER TABLE "appointments" ADD CONSTRAINT "appointment_duration_positive"
  CHECK ("durationMinutes" > 0);
