"use client";

import { MailCheckIcon } from "lucide-react";
import { useActionState } from "react";

import { requestPasswordResetAction } from "@/app/(auth)/actions";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, null);

  if (state?.ok) {
    return (
      <div className="border-border bg-muted/40 space-y-3 rounded-lg border p-5">
        <MailCheckIcon className="text-primary size-6" aria-hidden="true" />
        <h2 className="font-heading text-base font-semibold">Check your email</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          If an account exists for that address, a reset link is on its way. The
          link is valid for one hour.
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
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@clinic.com"
        required
        errors={errors?.fieldErrors?.email}
      />

      <SubmitButton className="w-full">Send reset link</SubmitButton>
    </form>
  );
}
