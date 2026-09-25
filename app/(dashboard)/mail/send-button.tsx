"use client";

import { useActionState } from "react";
import { SendIcon } from "lucide-react";

import { sendEmailAction } from "@/app/(dashboard)/mail/actions";
import { SubmitButton } from "@/components/form/submit-button";
import { FormError } from "@/components/form/field";

export function SendEmailButton({ emailId }: { emailId: string }) {
  const [state, formAction] = useActionState(sendEmailAction, null);

  const errors = state && !state.ok ? state.error : undefined;

  return (
    <form action={formAction} className="inline-block space-y-2">
      <FormError message={errors?.message} />
      <input type="hidden" name="id" value={emailId} />
      <SubmitButton className="gap-2">
        <SendIcon className="size-4" />
        Send Message
      </SubmitButton>
    </form>
  );
}
