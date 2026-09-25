"use server";

import { revalidatePath } from "next/cache";

import { action } from "@/lib/server/action";
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationIdSchema,
} from "@/services/notifications";
import { z } from "zod";

const markReadCommand = action({
  audit: "notification.read",
  permission: "organization.read",
  schema: notificationIdSchema,
  entityType: "Notification",
  revalidate: () => ["/notifications"],
  run: ({ input, ctx, unit }) => markNotificationRead(ctx, input.id, unit),
});

export async function markReadAction(
  _previous: unknown,
  formData: FormData,
) {
  const id = formData.get("id");
  const result = await markReadCommand({ id });
  if (result.ok) {
    revalidatePath("/notifications");
  }
  return result;
}

const emptySchema = z.object({});

const markAllReadCommand = action({
  audit: "notification.read_all",
  permission: "organization.read",
  schema: emptySchema,
  revalidate: () => ["/notifications"],
  run: ({ ctx, unit }) => markAllNotificationsRead(ctx, unit),
});

export async function markAllReadAction() {
  const result = await markAllReadCommand({});
  if (result.ok) {
    revalidatePath("/notifications");
  }
  return result;
}
