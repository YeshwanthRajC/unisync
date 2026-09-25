import type { Metadata } from "next";
import Link from "next/link";
import { CheckCheckIcon } from "lucide-react";

import { MarkAllReadButton } from "@/app/(dashboard)/notifications/mark-all-read-button";
import { NotificationItem } from "@/app/(dashboard)/notifications/notification-item";
import { Button } from "@/components/ui/button";
import { loadContext } from "@/lib/server/guard";
import {
  countUnreadNotifications,
  listNotifications,
} from "@/services/notifications";
import { getCurrentOrganization } from "@/services/organizations";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: PageProps<"/notifications">) {
  const ctx = await loadContext("organization.read");
  const params = await searchParams;
  const unreadOnly = params?.filter === "unread";

  const [notifications, unreadCount, organization] = await Promise.all([
    listNotifications(ctx, { unreadOnly }),
    countUnreadNotifications(ctx),
    getCurrentOrganization(ctx),
  ]);

  const dateFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: organization.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Notifications & Alerts
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Internal clinic alerts for low inventory stock, upcoming patient recalls, and administrative actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && <MarkAllReadButton />}
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          variant={!unreadOnly ? "secondary" : "ghost"}
          size="sm"
          asChild
          className="text-xs"
        >
          <Link href="/notifications">All Alerts</Link>
        </Button>
        <Button
          variant={unreadOnly ? "secondary" : "ghost"}
          size="sm"
          asChild
          className="text-xs"
        >
          <Link href="/notifications?filter=unread">
            Unread Only ({unreadCount})
          </Link>
        </Button>
      </div>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <CheckCheckIcon className="size-6 text-muted-foreground" />
          </div>
          <p className="mt-3 font-heading font-medium">All caught up!</p>
          <p className="text-xs text-muted-foreground">
            {unreadOnly
              ? "You have no unread notifications at this time."
              : "No clinic notifications recorded yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              formattedDate={dateFormatter.format(new Date(n.createdAt))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
