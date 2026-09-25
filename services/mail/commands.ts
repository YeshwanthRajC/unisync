import "server-only";

import type { HumanIntent } from "@/lib/auth/human-intent";
import type { OrganizationContext } from "@/lib/auth/session";
import { orgScope, orgWhere } from "@/lib/db/scope";
import { RuleViolationError } from "@/lib/server/errors";
import type { UnitOfWork } from "@/lib/server/unit";
import { prisma } from "@/lib/db/prisma";
import { isGeminiConfigured, isBrevoConfigured } from "@/lib/env";
import { getLlmProvider } from "@/lib/ai/provider";
import { getPatientOrThrow } from "@/services/patients";
import { getPatientEmailOrThrow } from "@/services/mail/queries";
import { dispatchEmail, formatEmailHtml } from "@/services/mail/brevo";
import { verifyPatientActionContext } from "@/services/mail/verifier";
import type {
  EmailDraftInput,
  UpdateDraftInput,
  SendEmailInput,
  EmailIdInput,
  AiDraftPromptInput,
} from "@/services/mail/schema";

export async function createEmailDraft(
  ctx: OrganizationContext,
  input: EmailDraftInput,
  unit: UnitOfWork,
) {
  const patient = await getPatientOrThrow(ctx, input.patientId, unit.db);

  const email = await unit.db.patientEmail.create({
    data: {
      patientId: input.patientId,
      recipient: input.recipient.trim().toLowerCase(),
      subject: input.subject.trim(),
      body: input.body.trim(),
      status: "DRAFT",
      generatedByAI: input.generatedByAI ?? false,
      relatedAppointmentId: input.relatedAppointmentId || null,
      relatedBillId: input.relatedBillId || null,
      relatedFollowUpId: input.relatedFollowUpId || null,
      ...orgScope(ctx),
    },
  });

  unit.target("PatientEmail", email.id);
  unit.note({
    patientId: patient.id,
    recipient: email.recipient,
    generatedByAI: email.generatedByAI,
  });

  return email;
}

export async function updateEmailDraft(
  ctx: OrganizationContext,
  input: UpdateDraftInput,
  unit: UnitOfWork,
) {
  const existing = await getPatientEmailOrThrow(ctx, input.id, unit.db);

  if (existing.status !== "DRAFT") {
    throw new RuleViolationError("Only draft emails can be edited.");
  }

  const email = await unit.db.patientEmail.update({
    where: orgWhere(ctx, { id: input.id }),
    data: {
      recipient: input.recipient.trim().toLowerCase(),
      subject: input.subject.trim(),
      body: input.body.trim(),
    },
  });

  unit.target("PatientEmail", email.id);
  unit.note({ subject: email.subject, recipient: email.recipient });

  return email;
}

export async function deleteEmailDraft(
  ctx: OrganizationContext,
  input: EmailIdInput,
  unit: UnitOfWork,
) {
  const existing = await getPatientEmailOrThrow(ctx, input.id, unit.db);

  if (existing.status !== "DRAFT") {
    throw new RuleViolationError("Only draft emails can be deleted.");
  }

  await unit.db.patientEmail.delete({
    where: orgWhere(ctx, { id: input.id }),
  });

  unit.target("PatientEmail", input.id);
  unit.note({ deletedDraftId: input.id });

  return { id: input.id };
}

/**
 * THE THIRD MANUAL GATE.
 *
 * Sending an email to a real person requires `HumanIntent` — unforgeable at the
 * type level and only mintable by a real authenticated user action.
 *
 * As settled in architectural decisions, no email delivery provider is configured.
 * UniSync never claims delivery it cannot substantiate, so Send records
 * `PROVIDER_NOT_CONFIGURED` with a clear explanation rather than pretending the
 * message was sent.
 *
 * Postgres CHECK constraint `email_sent_requires_human` mandates:
 * ("status" = 'SENT') = ("sentAt" IS NOT NULL AND "sentByProfileId" IS NOT NULL)
 * Because status is `PROVIDER_NOT_CONFIGURED`, sentAt and sentByProfileId remain null.
 */
export async function sendPatientEmail(
  ctx: OrganizationContext,
  input: SendEmailInput,
  intent: HumanIntent,
  unit: UnitOfWork,
) {
  const existing = await getPatientEmailOrThrow(ctx, input.id, unit.db);

  if (existing.status === "SENT") {
    throw new RuleViolationError("This email has already been sent.");
  }

  // If Brevo email service is configured, attempt live dispatch
  if (isBrevoConfigured()) {
    try {
      const result = await dispatchEmail({
        to: existing.recipient,
        recipientName: existing.patient.fullName,
        subject: existing.subject,
        htmlContent: formatEmailHtml(existing.body, ctx.organizationName),
        textContent: existing.body,
        senderName: ctx.organizationName,
        preferMcp: false, // Manual emails use the REST API key
      });

      const email = await unit.db.patientEmail.update({
        where: orgWhere(ctx, { id: input.id }),
        data: {
          status: "SENT",
          sentAt: intent.at,
          sentByProfileId: intent.profileId,
          providerMessageId: result.messageId,
          failureReason: null,
        },
      });

      unit.target("PatientEmail", email.id);
      unit.note({
        recipient: email.recipient,
        sentByProfileId: intent.profileId,
        providerMessageId: result.messageId,
        status: "SENT",
      });

      return email;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to deliver email via Brevo";

      const email = await unit.db.patientEmail.update({
        where: orgWhere(ctx, { id: input.id }),
        data: {
          status: "FAILED",
          failureReason: errorMessage,
          sentAt: null,
          sentByProfileId: null,
        },
      });

      unit.target("PatientEmail", email.id);
      unit.note({
        recipient: email.recipient,
        attemptedByProfileId: intent.profileId,
        status: "FAILED",
        failureReason: errorMessage,
      });

      return email;
    }
  }

  const email = await unit.db.patientEmail.update({
    where: orgWhere(ctx, { id: input.id }),
    data: {
      status: "PROVIDER_NOT_CONFIGURED",
      failureReason:
        "No email provider configured. UniSync operates in preview mode for patient mail.",
      sentAt: null,
      sentByProfileId: null,
    },
  });

  unit.target("PatientEmail", email.id);
  unit.note({
    recipient: email.recipient,
    attemptedByProfileId: intent.profileId,
    status: "PROVIDER_NOT_CONFIGURED",
  });

  return email;
}

/**
 * Generate an email draft using Gemini (or fallback template if offline / unconfigured).
 */
export type GeneratedAiDraft = {
  subject: string;
  body: string;
  warning?: {
    title: string;
    message: string;
    suggestion?: string;
  };
  verifiedContext?: {
    appointmentDate?: string;
    outstandingBalance?: string;
  };
};

/**
 * Generate an email draft using Gemini (or fallback template if offline / unconfigured).
 * Verifies real patient ground truth data to detect discrepancies and inject genuine clinic facts.
 */
export async function generateAiDraft(
  ctx: OrganizationContext,
  input: AiDraftPromptInput,
): Promise<GeneratedAiDraft> {
  const patient = await getPatientOrThrow(ctx, input.patientId);
  const orgName = ctx.organizationName;

  // Run ground truth verification against the database
  const verification = await verifyPatientActionContext(ctx, input.patientId, input.topic);

  // If the action contradicts real records, raise a notification
  let warning: GeneratedAiDraft["warning"] | undefined;
  if (!verification.valid) {
    warning = {
      title: verification.title || "Inappropriate Action Warning",
      message: verification.message || "Action does not match patient records.",
      suggestion: verification.suggestion,
    };

    // Raise in-app notification in database
    try {
      await prisma.notification.create({
        data: {
          title: `Inappropriate Action Warning: ${verification.title}`,
          body: `Draft requested for ${patient.fullName}: ${verification.message}`,
          severity: "WARNING",
          href: `/patients/${patient.id}`,
          entityType: "PatientEmail",
          entityId: patient.id,
          organizationId: ctx.organizationId,
        },
      });
    } catch {
      // Non-blocking notification creation
    }
  }

  // Build verified facts for AI prompt and fallback
  let verifiedFactNotes = "";
  if (verification.appointment) {
    verifiedFactNotes += `\nVerified Appointment Record: Upcoming visit scheduled on ${verification.appointment.formattedDate} (${verification.appointment.type}).`;
  }
  if (verification.billing) {
    verifiedFactNotes += `\nVerified Billing Record: Outstanding Balance is ${verification.billing.formattedBalance} across ${verification.billing.unpaidCount} unpaid bill(s).`;
  }
  if (verification.followUp) {
    verifiedFactNotes += `\nVerified Follow-Up Record: Due on ${verification.followUp.formattedDate} for "${verification.followUp.reason}".`;
  }

  // If Gemini is configured, attempt intelligent generation with verified facts
  if (isGeminiConfigured()) {
    try {
      const provider = getLlmProvider();
      const prompt = `Write a polite, professional, warm clinic email to a patient with the following details:
Clinic: ${orgName}
Patient Name: ${patient.fullName}
Topic: ${input.topic.replace(/_/g, " ")}
Additional Context / Notes: ${input.notes || "None provided"}${verifiedFactNotes}

Respond ONLY with a valid JSON object formatted as:
{"subject": "Email subject line here", "body": "Full email message body here"}`;

      const result = await provider.generate({
        messages: [{ role: "user", content: prompt }],
        systemInstruction:
          "You are an empathetic, professional dental clinic administrative assistant writing clear, reassuring patient communications. Always use verified appointment dates and billing amounts provided in context. Return only JSON.",
        temperature: 0.3,
      });

      // Try parsing JSON from response
      const cleanedText = result.text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleanedText);
      if (parsed.subject && parsed.body) {
        return {
          subject: String(parsed.subject).trim(),
          body: String(parsed.body).trim(),
          warning,
          verifiedContext: {
            appointmentDate: verification.appointment?.formattedDate,
            outstandingBalance: verification.billing?.formattedBalance,
          },
        };
      }
    } catch {
      // Fall through to template if AI call or JSON parse fails
    }
  }

  // Resilient fallback templates incorporating verified ground truth data
  switch (input.topic) {
    case "APPOINTMENT_REMINDER": {
      const appointmentText = verification.appointment
        ? `about your upcoming ${verification.appointment.type.toLowerCase()} appointment at ${orgName} scheduled on ${verification.appointment.formattedDate}.`
        : `about your upcoming appointment at ${orgName}.`;

      return {
        subject: `Upcoming appointment reminder — ${orgName}`,
        body:
          `Dear ${patient.fullName},\n\n` +
          `This is a friendly reminder ${appointmentText}\n\n` +
          `Please arrive 10 minutes early. If you need to reschedule or have any questions, please reply to this email or call our desk.\n\n` +
          `Warm regards,\n${orgName}`,
        warning,
        verifiedContext: {
          appointmentDate: verification.appointment?.formattedDate,
        },
      };
    }

    case "POST_TREATMENT_CARE":
      return {
        subject: `Post-treatment care instructions — ${orgName}`,
        body:
          `Dear ${patient.fullName},\n\n` +
          `Thank you for visiting ${orgName} today. Here are important care instructions for your recovery:\n\n` +
          `1. Avoid strenuous chewing and very hot foods for the remainder of the day.\n` +
          `2. Continue gentle brushing and oral hygiene around the treated area.\n` +
          `3. Take any recommended or prescribed medications as directed.\n\n` +
          `If you experience prolonged swelling or persistent discomfort, please contact us right away.\n\n` +
          `Sincerely,\n${orgName}`,
        warning,
      };

    case "FOLLOW_UP_RECALL": {
      const recallText = verification.followUp
        ? `Our records indicate that you are due for your follow-up check-up on ${verification.followUp.formattedDate} regarding "${verification.followUp.reason}".`
        : `Our records indicate that you are due for a routine dental check-up and cleaning at ${orgName}.`;

      return {
        subject: `Time for your routine dental recall check-up — ${orgName}`,
        body:
          `Dear ${patient.fullName},\n\n` +
          `${recallText}\n\n` +
          `Routine preventive check-ups ensure that minor issues are identified early and help keep your teeth healthy.\n\n` +
          `Please let us know your preferred dates or call us to reserve a convenient time.\n\n` +
          `Best regards,\n${orgName}`,
        warning,
      };
    }

    case "OVERDUE_BILL_REMINDER": {
      const balanceText = verification.billing
        ? `We are reaching out with a gentle reminder regarding an outstanding balance of ${verification.billing.formattedBalance} on your clinic statement.`
        : `We are reaching out with a gentle reminder regarding an outstanding balance on your clinic statement.`;

      return {
        subject: `Friendly statement reminder — ${orgName}`,
        body:
          `Dear ${patient.fullName},\n\n` +
          `We hope you are keeping well. ${balanceText}\n\n` +
          `Please feel free to review your statement or reach out to our front desk team to finalize your payment.\n\n` +
          `Thank you for your prompt attention.\n\n` +
          `Warm regards,\n${orgName}`,
        warning,
        verifiedContext: {
          outstandingBalance: verification.billing?.formattedBalance,
        },
      };
    }

    case "GENERAL_ANNOUNCEMENT":
    default:
      return {
        subject: `Message from ${orgName}`,
        body:
          `Dear ${patient.fullName},\n\n` +
          `${input.notes ? input.notes : "Thank you for being a valued patient at our clinic."}\n\n` +
          `Please contact us if we can assist you with your dental care.\n\n` +
          `Warm regards,\n${orgName}`,
        warning,
      };
  }
}
