import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A labelled input with its validation message.
 *
 * Built directly on the primitives rather than pulling in react-hook-form: these
 * forms submit to Server Actions and read their errors from `ActionResult`, so a
 * client-side form library would be a second source of truth for validation.
 *
 * Accessibility is the reason this is a component at all rather than repeated
 * markup — `aria-describedby` and `aria-invalid` have to be wired to the same
 * generated id every time, and that is exactly the sort of thing that gets
 * forgotten on the fourth copy.
 */
export function Field({
  name,
  label,
  errors,
  hint,
  className,
  children,
  ...inputProps
}: React.ComponentProps<typeof Input> & {
  name: string;
  label: string;
  errors?: string[];
  hint?: ReactNode;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const invalid = Boolean(errors?.length);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={name}>{label}</Label>
        {children}
      </div>

      <Input
        id={name}
        name={name}
        aria-invalid={invalid}
        aria-describedby={cn(invalid && errorId, hint && hintId) || undefined}
        {...inputProps}
      />

      {hint && !invalid ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}

      {invalid ? (
        <p id={errorId} className="text-destructive text-xs" role="alert">
          {errors?.[0]}
        </p>
      ) : null}
    </div>
  );
}

/** Form-level error, for failures that belong to no single field. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="border-destructive/25 bg-destructive/5 text-destructive rounded-md border px-3 py-2.5 text-sm"
    >
      {message}
    </div>
  );
}
