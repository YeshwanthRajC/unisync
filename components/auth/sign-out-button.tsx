"use client";

import { LogOutIcon } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/form/submit-button";

/**
 * Sign out.
 *
 * A form POST rather than a link: signing out is a state change, and a GET that
 * mutates session state can be triggered by a prefetch or an image tag.
 */
export function SignOutButton({
  variant = "ghost",
  className,
  withLabel = true,
}: {
  variant?: React.ComponentProps<typeof SubmitButton>["variant"];
  className?: string;
  withLabel?: boolean;
}) {
  return (
    <form action={signOutAction}>
      <SubmitButton variant={variant} size="sm" className={className}>
        <LogOutIcon aria-hidden="true" />
        {withLabel ? "Sign out" : <span className="sr-only">Sign out</span>}
      </SubmitButton>
    </form>
  );
}
