import { loadOrganization } from "@/lib/server/guard";

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
 *
 * The full sidebar and assistant panel land with the design-system step; for now
 * this is deliberately plain so the auth flow can be verified end to end.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  await loadOrganization();

  return <div className="flex min-h-svh flex-1 flex-col">{children}</div>;
}
