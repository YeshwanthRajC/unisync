"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction } from "@/app/(auth)/actions";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";

/**
 * Sign-in form.
 *
 * `useActionState` rather than a form library: the action already validates and
 * returns typed field errors, so client-side validation would be a second source
 * of truth that can disagree with the server. The form also works without
 * JavaScript, which matters on a clinic's aging reception PC.
 */
export function SignInForm({ linkError }: { linkError?: string }) {
  const [state, formAction] = useActionState(signInAction, null);

  const errors = state?.ok === false ? state.error : undefined;
  // A validation failure is shown per-field; anything else is a form-level
  // message, so the same text is never displayed twice.
  const formMessage =
    errors && errors.code !== "VALIDATION" ? errors.message : linkError;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={formMessage} />

      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@clinic.com"
        required
        errors={errors?.fieldErrors?.email}
      />

      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        errors={errors?.fieldErrors?.password}
      >
        <Link
          href="/forgot-password"
          className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
        >
          Forgot password?
        </Link>
      </Field>

      <SubmitButton className="w-full">Sign in</SubmitButton>
    </form>
  );
}
