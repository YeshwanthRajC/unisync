import "server-only";

import { z } from "zod";

import { defineTool } from "@/lib/ai/tools/define";
import {
  createEmailDraft,
  listPatientEmails,
  dispatchEmail,
  formatEmailHtml,
  verifyPatientActionContext,
} from "@/services/mail";
import { getPatientOrThrow } from "@/services/patients";
import { orgScope, orgWhere } from "@/lib/db/scope";
import { isBrevoConfigured } from "@/lib/env";

export const listPatientEmailsTool = defineTool({
  name: "list_patient_emails",
  description: "List email communications and message drafts prepared or sent to clinic patients.",
  permission: "patient_email.read",
  audit: "patient_email.read",
  mode: "read",
  input: z.object({
    status: z
      .enum(["ALL", "DRAFT", "QUEUED", "SENT", "FAILED", "PROVIDER_NOT_CONFIGURED"])
      .optional()
      .describe("Filter emails by status."),
    patientId: z.string().optional().describe("Filter emails by patient UUID."),
  }),
  confirmation: { required: false },
  execute: async ({ input, ctx, db }) => {
    const list = await listPatientEmails(
      ctx,
      { status: input.status, patientId: input.patientId },
      db,
    );
    return list.slice(0, 15).map((e) => ({
      id: e.id,
      patientId: e.patientId,
      patientName: e.patient.fullName,
      recipient: e.recipient,
      subject: e.subject,
      status: e.status,
      generatedByAI: e.generatedByAI,
      createdAt: e.createdAt.toISOString(),
    }));
  },
});

export const draftPatientEmailTool = defineTool({
  name: "draft_patient_email",
  description: "Draft a personalized email for a patient after verifying real clinic records. Requires human review before sending.",
  permission: "patient_email.draft",
  audit: "patient_email.draft",
  mode: "write",
  confirmation: {
    required: true,
    describe: (input) =>
      `Create email draft to ${input.recipient} with subject "${input.subject}"`,
  },
  input: z.object({
    patientId: z.string().describe("UUID of the patient."),
    recipient: z.string().describe("Recipient email address."),
    subject: z.string().min(1).describe("Subject line of the email."),
    body: z.string().min(1).describe("Body text of the email message."),
    relatedAppointmentId: z
      .string()
      .optional()
      .describe("Optional appointment UUID linked to this email."),
    relatedBillId: z
      .string()
      .optional()
      .describe("Optional bill UUID linked to this email."),
    relatedFollowUpId: z
      .string()
      .optional()
      .describe("Optional follow-up UUID linked to this email."),
  }),
  execute: async ({ input, ctx, unit }) => {
    // Ground truth verification: check real records to prevent mistakes
    const verification = await verifyPatientActionContext(
      ctx,
      input.patientId,
      `${input.subject} ${input.body}`,
      unit.db,
    );

    if (!verification.valid) {
      // Raise alert notification in database
      await unit.db.notification.create({
        data: {
          title: `Inappropriate Action Warning: ${verification.title}`,
          body: `Draft creation prevented for ${verification.patientName}: ${verification.message}`,
          severity: "WARNING",
          entityType: "PatientEmail",
          entityId: input.patientId,
          href: `/patients/${input.patientId}`,
          ...orgScope(ctx),
        },
      });

      return {
        rejected: true,
        title: verification.title,
        warning: verification.message,
        suggestion: verification.suggestion,
        notificationRaised: true,
        message: `⚠️ Action Warning: ${verification.title}. ${verification.message} Suggestion: ${verification.suggestion}`,
      };
    }

    // Auto-link real records if user omitted them (corrects minor mistakes)
    const appointmentId =
      input.relatedAppointmentId || verification.appointment?.id || undefined;

    const draft = await createEmailDraft(
      ctx,
      {
        patientId: input.patientId,
        recipient: input.recipient,
        subject: input.subject,
        body: input.body,
        generatedByAI: true,
        relatedAppointmentId: appointmentId,
        relatedBillId: input.relatedBillId,
        relatedFollowUpId: input.relatedFollowUpId,
      },
      unit,
    );

    return {
      id: draft.id,
      recipient: draft.recipient,
      subject: draft.subject,
      status: draft.status,
      linkedAppointmentId: appointmentId || null,
      verifiedRecord: verification.appointment ? "Appointment record verified" : "Verified",
    };
  },
});

export const sendPatientEmailTool = defineTool({
  name: "send_patient_email",
  description: "Send an email communication directly to a patient via Brevo after validating genuine clinic records. Dispatches automatically and logs to patient history.",
  permission: "ai.use",
  audit: "patient_email.agent_send",
  mode: "write",
  confirmation: { required: false },
  input: z.object({
    patientId: z.string().describe("UUID of the recipient patient."),
    recipient: z.string().email().describe("Recipient patient email address."),
    subject: z.string().min(1).describe("Subject line of the email."),
    body: z.string().min(1).describe("Message body text to send to the patient."),
    relatedAppointmentId: z
      .string()
      .optional()
      .describe("Optional appointment UUID linked to this email."),
    relatedBillId: z
      .string()
      .optional()
      .describe("Optional bill UUID linked to this email."),
    relatedFollowUpId: z
      .string()
      .optional()
      .describe("Optional follow-up UUID linked to this email."),
  }),
  execute: async ({ input, ctx, unit }) => {
    const patient = await getPatientOrThrow(ctx, input.patientId, unit.db);

    // Ground truth verification: check real records to prevent inappropriate emails
    const verification = await verifyPatientActionContext(
      ctx,
      input.patientId,
      `${input.subject} ${input.body}`,
      unit.db,
    );

    if (!verification.valid) {
      // Raise alert notification in database
      await unit.db.notification.create({
        data: {
          title: `Inappropriate Action Warning: ${verification.title}`,
          body: `Automatic email send prevented for ${patient.fullName}: ${verification.message}`,
          severity: "WARNING",
          entityType: "PatientEmail",
          entityId: patient.id,
          href: `/patients/${patient.id}`,
          ...orgScope(ctx),
        },
      });

      return {
        success: false,
        rejected: true,
        title: verification.title,
        warning: verification.message,
        suggestion: verification.suggestion,
        notificationRaised: true,
        message: `⚠️ Action Prevented: ${verification.title}. ${verification.message} Suggestion: ${verification.suggestion}`,
      };
    }

    // Auto-link real records if user omitted them (corrects minor mistakes)
    const appointmentId =
      input.relatedAppointmentId || verification.appointment?.id || null;

    const email = await unit.db.patientEmail.create({
      data: {
        patientId: input.patientId,
        recipient: input.recipient.trim().toLowerCase(),
        subject: input.subject.trim(),
        body: input.body.trim(),
        status: "DRAFT",
        generatedByAI: true,
        relatedAppointmentId: appointmentId,
        relatedBillId: input.relatedBillId || null,
        relatedFollowUpId: input.relatedFollowUpId || null,
        ...orgScope(ctx),
      },
    });

    unit.target("PatientEmail", email.id);

    if (isBrevoConfigured()) {
      try {
        const dispatchResult = await dispatchEmail({
          to: email.recipient,
          recipientName: patient.fullName,
          subject: email.subject,
          htmlContent: formatEmailHtml(email.body, ctx.organizationName),
          textContent: email.body,
          senderName: ctx.organizationName,
          preferMcp: true, // Use Brevo MCP server
        });

        await unit.db.patientEmail.update({
          where: orgWhere(ctx, { id: email.id }),
          data: {
            status: "SENT",
            sentAt: new Date(),
            sentByProfileId: ctx.profileId,
            providerMessageId: dispatchResult.messageId,
            failureReason: null,
          },
        });

        unit.note({
          recipient: email.recipient,
          sentByProfileId: ctx.profileId,
          providerMessageId: dispatchResult.messageId,
          provider: dispatchResult.provider,
          automated: true,
        });

        return {
          id: email.id,
          recipient: email.recipient,
          subject: email.subject,
          status: "SENT",
          providerMessageId: dispatchResult.messageId,
          message: `Email successfully dispatched to ${email.recipient} via Brevo MCP.`,
        };
      } catch (dispatchErr) {
        const failureReason =
          dispatchErr instanceof Error
            ? dispatchErr.message
            : "Failed to dispatch email via Brevo MCP";

        await unit.db.patientEmail.update({
          where: orgWhere(ctx, { id: email.id }),
          data: {
            status: "FAILED",
            failureReason,
            sentAt: null,
            sentByProfileId: null,
          },
        });

        unit.note({
          recipient: email.recipient,
          status: "FAILED",
          failureReason,
          automated: true,
        });

        return {
          id: email.id,
          recipient: email.recipient,
          subject: email.subject,
          status: "FAILED",
          error: failureReason,
        };
      }
    }

    // Fallback when Brevo is not configured
    await unit.db.patientEmail.update({
      where: orgWhere(ctx, { id: email.id }),
      data: {
        status: "PROVIDER_NOT_CONFIGURED",
        failureReason: "Brevo email provider is not configured.",
        sentAt: null,
        sentByProfileId: null,
      },
    });

    return {
      id: email.id,
      recipient: email.recipient,
      subject: email.subject,
      status: "PROVIDER_NOT_CONFIGURED",
      message: "Email saved as draft because email provider is not configured.",
    };
  },
});
