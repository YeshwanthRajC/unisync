"use client";

import Link from "next/link";
import { BellIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      asChild
      className="relative size-9 text-muted-foreground hover:text-foreground"
      title="Notifications & Alerts"
    >
      <Link href="/notifications">
        <BellIcon className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
        )}
        <span className="sr-only">Notifications</span>
      </Link>
    </Button>
  );
}
