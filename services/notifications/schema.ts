import { z } from "zod";

export const NOTIFICATION_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export const createNotificationSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  body: z.string().trim().max(1000).optional(),
  severity: z.enum(NOTIFICATION_SEVERITIES).default("INFO"),
  href: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export const notificationIdSchema = z.object({
  id: z.uuid("Invalid notification ID"),
});

export type NotificationIdInput = z.infer<typeof notificationIdSchema>;
