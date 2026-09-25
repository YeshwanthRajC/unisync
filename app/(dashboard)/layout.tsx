import { DashboardShell } from "@/components/layout/dashboard-shell";
import { loadOrganization } from "@/lib/server/guard";
import { countUnreadNotifications } from "@/services/notifications";

/**
 * Guarded layout for every authenticated route.
 *
 * `loadOrganization` is the single gate: it redirects to sign-in when there is no
 * session, to onboarding when the user has no organization, and to no-access when
 * they lack rights. It also provisions the `Profile` row on first request.
 *
 * Note this layout is not the security boundary — each page still resolves its own
 * context and permission where it reads data, so a route added without a guard
 * cannot leak. This exists so the shell has an organization to render.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const ctx = await loadOrganization();
  const unreadNotifications = await countUnreadNotifications(ctx);

  return (
    <DashboardShell
      organizationName={ctx.organizationName}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </DashboardShell>
  );
}
