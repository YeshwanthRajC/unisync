import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

/**
 * Desktop: sidebar | workspace. Below `lg`: a top bar with a drawer instead.
 * The Ask UniSync panel arrives with the agent loop (build step 12) — until
 * then a third column here would be an empty surface with nothing to show.
 */
export function DashboardShell({
  organizationName,
  children,
}: {
  organizationName: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh w-full">
      <AppSidebar organizationName={organizationName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav organizationName={organizationName} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
