import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/session";
import { userHasOrganization } from "@/services/organizations";

export const metadata: Metadata = { title: "Set up your organization" };

/**
 * Where a brand-new account lands.
 *
 * Not inside the (dashboard) group: that group's layout renders the sidebar,
 * which needs an organization to describe. This page exists precisely because
 * there isn't one yet.
 */
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  // Someone who already has an organization does not need this page, and leaving
  // it reachable would let them create a second one by accident.
  if (await userHasOrganization(user.id)) redirect("/home");

  const suggestedName =
    typeof user.user_metadata?.full_name === "string"
      ? `${user.user_metadata.full_name.split(" ")[0]}'s Clinic`
      : "";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6 py-10">
      <Logo />

      <main className="flex flex-1 flex-col justify-center py-10">
        <div className="space-y-6">
          <div className="space-y-1.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Set up your organization
            </h1>
            <p className="text-muted-foreground text-sm">
              This is the workspace your patients, appointments and billing live
              in. You can change these details later in Settings.
            </p>
          </div>

          <OnboardingForm suggestedName={suggestedName} />
        </div>
      </main>
    </div>
  );
}
