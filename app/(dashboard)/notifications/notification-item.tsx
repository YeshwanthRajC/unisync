"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  ExternalLinkIcon,
  InfoIcon,
} from "lucide-react";

import { markReadAction } from "@/app/(dashboard)/notifications/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface NotificationItemProps {
  notification: {
    id: string;
    title: string;
    body: string | null;
    severity: "INFO" | "WARNING" | "CRITICAL";
    href: string | null;
    readAt: Date | null;
    createdAt: Date;
  };
  formattedDate: string;
}

export function NotificationItem({
  notification,
  formattedDate,
}: NotificationItemProps) {
  const [, formAction] = useActionState(markReadAction, null);
  const isRead = Boolean(notification.readAt);

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-xl border p-4 transition-colors ${
        isRead
          ? "bg-background text-muted-foreground"
          : "bg-muted/30 border-primary/20 text-foreground font-medium shadow-xs"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div className="mt-0.5 shrink-0">
          {notification.severity === "CRITICAL" && (
            <AlertCircleIcon className="size-4 text-destructive" />
          )}
          {notification.severity === "WARNING" && (
            <AlertTriangleIcon className="size-4 text-amber-500" />
          )}
          {notification.severity === "INFO" && (
            <InfoIcon className="size-4 text-primary" />
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{notification.title}</p>
            <Badge
              variant="outline"
              className={`text-[10px] py-0 px-1.5 ${
                notification.severity === "CRITICAL"
                  ? "border-destructive/40 text-destructive bg-destructive/10"
                  : notification.severity === "WARNING"
                    ? "border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/20"
                    : "border-primary/30 text-primary bg-primary/10"
              }`}
            >
              {notification.severity}
            </Badge>
            {!isRead && (
              <span className="size-2 rounded-full bg-primary" title="Unread" />
            )}
          </div>

          {notification.body && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {notification.body}
            </p>
          )}

          <p className="text-[11px] text-muted-foreground pt-0.5">
            {formattedDate}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {notification.href && (
          <Button variant="ghost" size="sm" asChild className="h-8 text-xs gap-1">
            <Link href={notification.href}>
              View
              <ExternalLinkIcon className="size-3" />
            </Link>
          </Button>
        )}

        {!isRead && (
          <form action={formAction}>
            <input type="hidden" name="id" value={notification.id} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              title="Mark as read"
            >
              <CheckIcon className="size-3" />
              Read
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
