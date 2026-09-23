import type { Metadata } from "next";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadContext } from "@/lib/server/guard";
import { getCurrentOrganization } from "@/services/organizations";

export const metadata: Metadata = { title: "Home" };

/**
 * Placeholder home.
 *
 * Replaced by the Organization Pulse dashboard in the next step. It exists now so
 * the authentication flow has a real destination that proves the session, the
 * Profile row, the Membership and the tenant-scoped read all work together.
 */
export default async function HomePage() {
  const ctx = await loadContext("organization.read");
  const organization = await getCurrentOrganization(ctx);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Logo />
        <SignOutButton variant="outline" />
      </header>

      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {organization.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {ctx.user.email} · {ctx.role}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Authentication verified</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm">
            <p>
              Your session, profile and organization membership all resolved
              server-side, and this page read your organization through a
              tenant-scoped query.
            </p>
            <dl className="grid gap-x-6 gap-y-1 pt-2 sm:grid-cols-[auto_1fr]">
              <dt className="font-medium text-foreground">Timezone</dt>
              <dd>{organization.timezone}</dd>
              <dt className="font-medium text-foreground">Currency</dt>
              <dd>{organization.currency}</dd>
              <dt className="font-medium text-foreground">Type</dt>
              <dd>{organization.type.replace("_", " ").toLowerCase()}</dd>
            </dl>
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-xs">
          The sidebar, Organization Pulse and the assistant panel arrive with the
          design-system step.
        </p>
      </div>
    </div>
  );
}
