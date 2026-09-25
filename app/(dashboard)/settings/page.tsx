import type { Metadata } from "next";
import { SettingsIcon } from "lucide-react";

import { SettingsForm } from "@/app/(dashboard)/settings/settings-form";
import { loadContext } from "@/lib/server/guard";
import { getCurrentOrganization } from "@/services/organizations";

export const metadata: Metadata = { title: "Clinic Settings" };

export default async function SettingsPage() {
  const ctx = await loadContext("organization.read");
  const organization = await getCurrentOrganization(ctx);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <SettingsIcon className="size-6 text-primary" />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Practice Settings
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage clinic name, regional preferences, official contact information, and billing configuration.
        </p>
      </header>

      {/* Settings Form */}
      <SettingsForm initialData={organization} />
    </div>
  );
}
