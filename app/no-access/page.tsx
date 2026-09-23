import Link from "next/link";
import { ShieldXIcon } from "lucide-react";
import type { Metadata } from "next";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "No access" };

/**
 * Signed in, but not permitted to view what was requested.
 *
 * Deliberately says nothing about what exists. "You do not have access to that
 * organization" and "that organization does not exist" are worded identically
 * throughout the application, so a response cannot be used to probe for other
 * tenants.
 */
export default function NoAccessPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10">
      <Logo />

      <main className="flex flex-1 flex-col justify-center">
        <div className="space-y-4">
          <ShieldXIcon className="text-muted-foreground size-8" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            You don&apos;t have access to this
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your account is signed in, but it isn&apos;t permitted to view this
            page. If you think that&apos;s wrong, ask whoever administers your
            organization.
          </p>
          <div className="flex gap-2 pt-2">
            <Button asChild>
              <Link href="/home">Go to Home</Link>
            </Button>
            <SignOutButton variant="outline" />
          </div>
        </div>
      </main>
    </div>
  );
}
