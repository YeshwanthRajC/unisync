"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { action } from "@/lib/server/action";
import {
  emailDraftSchema,
  updateDraftSchema,
  sendEmailSchema,
  emailIdSchema,
  aiDraftPromptSchema,
  createEmailDraft,
  updateEmailDraft,
  deleteEmailDraft,
  sendPatientEmail,
  generateAiDraft,
} from "@/services/mail";
import { requireOrganizationContext } from "@/lib/auth/session";

const createDraftCommand = action({
  audit: "patient_email.draft",
  permission: "patient_email.draft",
  schema: emailDraftSchema,
  entityType: "PatientEmail",
  revalidate: (input) => ["/mail", `/patients/${input.patientId}`],
  run: ({ input, ctx, unit }) => createEmailDraft(ctx, input, unit),
});

export async function createDraftAction(
  _previous: unknown,
  formData: FormData,
) {
  const raw = Object.fromEntries(formData.entries());
  const generatedByAI = raw.generatedByAI === "true";
  const result = await createDraftCommand({ ...raw, generatedByAI });
  if (result.ok) {
    redirect(`/mail/${result.data.id}`);
  }
  return result;
}

const updateDraftCommand = action({
  audit: "patient_email.draft",
  permission: "patient_email.draft",
  schema: updateDraftSchema,
  entityType: "PatientEmail",
  revalidate: (input) => ["/mail", `/mail/${input.id}`],
  run: ({ input, ctx, unit }) => updateEmailDraft(ctx, input, unit),
});

export async function updateDraftAction(
  _previous: unknown,
  formData: FormData,
) {
  return updateDraftCommand(Object.fromEntries(formData.entries()));
}

const deleteDraftCommand = action({
  audit: "patient_email.draft",
  permission: "patient_email.draft",
  schema: emailIdSchema,
  entityType: "PatientEmail",
  revalidate: () => ["/mail"],
  run: ({ input, ctx, unit }) => deleteEmailDraft(ctx, input, unit),
});

export async function deleteDraftAction(
  _previous: unknown,
  formData: FormData,
) {
  const result = await deleteDraftCommand(Object.fromEntries(formData.entries()));
  if (result.ok) {
    redirect("/mail");
  }
  return result;
}

/**
 * The third manual gate Server Action:
 * action() mints HumanIntent only for cookie-authenticated human requests!
 */
const sendEmailCommand = action({
  audit: "patient_email.send",
  permission: "patient_email.send",
  schema: sendEmailSchema,
  entityType: "PatientEmail",
  revalidate: (input) => ["/mail", `/mail/${input.id}`],
  run: ({ input, ctx, unit, intent }) =>
    sendPatientEmail(ctx, input, intent, unit),
});

export async function sendEmailAction(
  _previous: unknown,
  formData: FormData,
) {
  const result = await sendEmailCommand(Object.fromEntries(formData.entries()));
  if (result.ok) {
    revalidatePath("/mail");
  }
  return result;
}

/**
 * Generate AI Draft helper action
 */
export async function generateAiDraftAction(
  _previous: unknown,
  formData: FormData,
) {
  const ctx = await requireOrganizationContext();
  const raw = Object.fromEntries(formData.entries());
  const parsed = aiDraftPromptSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid draft options" };
  }

  const result = await generateAiDraft(ctx, parsed.data);
  return { ok: true as const, data: result };
}
