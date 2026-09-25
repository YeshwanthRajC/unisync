"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { action } from "@/lib/server/action";
import {
  followUpFormSchema,
  followUpUpdateSchema,
  completeFollowUpSchema,
  cancelFollowUpSchema,
  createFollowUp,
  updateFollowUp,
  completeFollowUp,
  cancelFollowUp,
} from "@/services/followups";

const createFollowUpCommand = action({
  audit: "followup.create",
  permission: "followup.create",
  schema: followUpFormSchema,
  entityType: "FollowUp",
  revalidate: (input) => ["/followups", `/patients/${input.patientId}`, "/home"],
  run: ({ input, ctx, unit }) => createFollowUp(ctx, input, unit),
});

export async function createFollowUpAction(
  _previous: unknown,
  formData: FormData,
) {
  const result = await createFollowUpCommand(
    Object.fromEntries(formData.entries()),
  );
  if (result.ok) {
    redirect("/followups");
  }
  return result;
}

const updateFollowUpCommand = action({
  audit: "followup.update",
  permission: "followup.update",
  schema: followUpUpdateSchema,
  entityType: "FollowUp",
  revalidate: () => ["/followups", "/home"],
  run: ({ input, ctx, unit }) => updateFollowUp(ctx, input, unit),
});

export async function updateFollowUpAction(
  _previous: unknown,
  formData: FormData,
) {
  return updateFollowUpCommand(Object.fromEntries(formData.entries()));
}

const completeFollowUpCommand = action({
  audit: "followup.complete",
  permission: "followup.complete",
  schema: completeFollowUpSchema,
  entityType: "FollowUp",
  revalidate: () => ["/followups", "/home"],
  run: ({ input, ctx, unit }) => completeFollowUp(ctx, input, unit),
});

export async function completeFollowUpAction(
  _previous: unknown,
  formData: FormData,
) {
  const result = await completeFollowUpCommand(
    Object.fromEntries(formData.entries()),
  );
  if (result.ok) {
    revalidatePath("/followups");
  }
  return result;
}

const cancelFollowUpCommand = action({
  audit: "followup.cancel",
  permission: "followup.update",
  schema: cancelFollowUpSchema,
  entityType: "FollowUp",
  revalidate: () => ["/followups", "/home"],
  run: ({ input, ctx, unit }) => cancelFollowUp(ctx, input, unit),
});

export async function cancelFollowUpAction(
  _previous: unknown,
  formData: FormData,
) {
  const result = await cancelFollowUpCommand(
    Object.fromEntries(formData.entries()),
  );
  if (result.ok) {
    revalidatePath("/followups");
  }
  return result;
}
