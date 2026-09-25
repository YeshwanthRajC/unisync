import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AskUniSyncDrawer } from "@/components/layout/ask-unisync-drawer";
import { CommandPalette } from "@/components/layout/command-palette";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBell } from "@/components/layout/notification-bell";

/**
 * Desktop: sidebar | workspace. Below `lg`: a top bar with a drawer instead.
 * The Ask UniSync panel slides in via floating pill or ⌘J shortcut.
 */
export function DashboardShell({
  organizationName,
  unreadNotifications = 0,
  children,
}: {
  organizationName: string;
  unreadNotifications?: number;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh w-full">
      <AppSidebar organizationName={organizationName} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop Top Bar */}
        <header className="hidden lg:flex h-14 items-center justify-between border-b px-6 bg-background/95 backdrop-blur-xs">
          <div className="w-full max-w-sm">
            <CommandPalette />
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell unreadCount={unreadNotifications} />
          </div>
        </header>

        <MobileNav
          organizationName={organizationName}
          unreadNotifications={unreadNotifications}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <AskUniSyncDrawer organizationName={organizationName} />
    </div>
  );
}
