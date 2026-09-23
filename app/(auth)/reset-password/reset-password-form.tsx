"use client";

import { useActionState } from "react";

import { updatePasswordAction } from "@/app/(auth)/actions";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, null);

  const errors = state?.ok === false ? state.error : undefined;
  const formMessage =
    errors && errors.code !== "VALIDATION" ? errors.message : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={formMessage} />

      <Field
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        errors={errors?.fieldErrors?.password}
      />

      <SubmitButton className="w-full">Save password</SubmitButton>
    </form>
  );
}
