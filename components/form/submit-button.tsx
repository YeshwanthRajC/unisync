"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * A submit button that disables itself and shows progress while the action runs.
 *
 * Reads `useFormStatus`, so it needs no props and cannot fall out of step with
 * the form's real state. Disabling during submission is not cosmetic here — the
 * audit log has no idempotency key yet, so a double-click genuinely produces two
 * records.
 *
 * The label stays in place and the spinner is added beside it rather than
 * replacing the text: swapping to "Saving..." makes the button resize and shifts
 * everything around it.
 */
export function SubmitButton({
  children,
  className,
  size,
  variant,
}: {
  children: React.ReactNode;
  className?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size={size}
      variant={variant}
      className={className}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <Loader2Icon className="animate-spin" aria-hidden="true" />
      ) : null}
      {children}
    </Button>
  );
}
