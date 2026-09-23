"use client";

import { MailCheckIcon } from "lucide-react";
import { useActionState } from "react";

import { signUpAction } from "@/app/(auth)/actions";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, null);

  /*
   * Email confirmation is enabled on the Supabase project, so a successful
   * sign-up returns a user with NO session. Saying so plainly is important: a
   * redirect into the app would bounce straight back to sign-in and read as a
   * bug rather than as "we sent you an email".
   */
  if (state?.ok && state.data.needsConfirmation) {
    return (
      <div className="border-border bg-muted/40 space-y-3 rounded-lg border p-5">
        <MailCheckIcon className="text-primary size-6" aria-hidden="true" />
        <h2 className="font-heading text-base font-semibold">
          Confirm your email
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We&apos;ve sent you a confirmation link. Open it to activate your
          account, and you&apos;ll come straight back here to set up your
          organization.
        </p>
        <p className="text-muted-foreground text-xs">
          Nothing arrived? Check your spam folder. Confirmation emails are
          rate-limited, so wait a minute before trying again.
        </p>
      </div>
    );
  }

  const errors = state?.ok === false ? state.error : undefined;
  const formMessage =
    errors && errors.code !== "VALIDATION" ? errors.message : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={formMessage} />

      <Field
        name="fullName"
        label="Your name"
        autoComplete="name"
        placeholder="Meera Nair"
        required
        errors={errors?.fieldErrors?.fullName}
      />

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
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        errors={errors?.fieldErrors?.password}
      />

      <SubmitButton className="w-full">Create account</SubmitButton>
    </form>
  );
}
