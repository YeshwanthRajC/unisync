"use client";

import { useActionState } from "react";
import { CheckCheckIcon } from "lucide-react";

import { markAllReadAction } from "@/app/(dashboard)/notifications/actions";
import { SubmitButton } from "@/components/form/submit-button";

export function MarkAllReadButton() {
  const [, formAction] = useActionState(markAllReadAction, null);

  return (
    <form action={formAction}>
      <SubmitButton variant="outline" size="sm" className="gap-1.5 text-xs">
        <CheckCheckIcon className="size-3.5" />
        Mark All as Read
      </SubmitButton>
    </form>
  );
}
