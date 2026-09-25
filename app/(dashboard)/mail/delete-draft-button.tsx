"use client";

import { useActionState } from "react";
import { Trash2Icon } from "lucide-react";

import { deleteDraftAction } from "@/app/(dashboard)/mail/actions";
import { SubmitButton } from "@/components/form/submit-button";
import { FormError } from "@/components/form/field";

export function DeleteDraftButton({ emailId }: { emailId: string }) {
  const [state, formAction] = useActionState(deleteDraftAction, null);
  const errors = state && !state.ok ? state.error : undefined;

  return (
    <form action={formAction} className="inline-block space-y-2">
      <FormError message={errors?.message} />
      <input type="hidden" name="id" value={emailId} />
      <SubmitButton variant="outline" className="gap-2 text-destructive hover:bg-destructive/10">
        <Trash2Icon className="size-4" />
        Delete Draft
      </SubmitButton>
    </form>
  );
}
