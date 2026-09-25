/**
 * Public surface of the patient mail module. Other modules import from here only.
 */
export {
  createEmailDraft,
  updateEmailDraft,
  deleteEmailDraft,
  sendPatientEmail,
  generateAiDraft,
} from "@/services/mail/commands";

export {
  sendBrevoTransactionalEmail,
  sendBrevoMcpEmail,
  dispatchEmail,
  formatEmailHtml,
} from "@/services/mail/brevo";

export {
  verifyPatientActionContext,
  detectActionTopic,
  type PatientActionContext,
  type ActionTopic,
} from "@/services/mail/verifier";

export {
  listPatientEmails,
  getPatientEmailOrThrow,
  listEmailsForPatient,
  countDraftEmails,
  EMAIL_INCLUDE,
} from "@/services/mail/queries";

export {
  PATIENT_EMAIL_STATUSES,
  PATIENT_EMAIL_STATUS_LABELS,
  AI_DRAFT_TOPICS,
  AI_DRAFT_TOPIC_LABELS,
  emailDraftSchema,
  updateDraftSchema,
  sendEmailSchema,
  emailIdSchema,
  aiDraftPromptSchema,
  emailListParamsSchema,
  type PatientEmailStatus,
  type EmailDraftInput,
  type UpdateDraftInput,
  type SendEmailInput,
  type EmailIdInput,
  type AiDraftTopic,
  type AiDraftPromptInput,
  type EmailListParams,
} from "@/services/mail/schema";
