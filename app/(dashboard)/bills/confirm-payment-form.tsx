"use client";

import { useActionState, useEffect, useState } from "react";

import { confirmPaymentAction } from "@/app/(dashboard)/bills/actions";
import { FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Confirming a payment is the manual gate: this form is the ONLY UI path to
 * it, and submits through `confirmPaymentAction`, which mints `HumanIntent`
 * server-side from the cookie-authenticated request.
 */
export function ConfirmPaymentForm({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(confirmPaymentAction, null);
  const errors = state && !state.ok ? state.error : undefined;

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <Button size="sm" variant="default" onClick={() => setOpen(true)}>
        Confirm received
      </Button>
    );
  }

  return (
    <form action={formAction} className="border-border w-full space-y-3 rounded-lg border p-4">
      <input type="hidden" name="id" value={paymentId} />
      <FormError message={errors && errors.code !== "VALIDATION" ? errors.message : undefined} />
      <div className="space-y-1.5">
        <Label htmlFor={`confirm-notes-${paymentId}`}>Notes (optional)</Label>
        <Textarea
          id={`confirm-notes-${paymentId}`}
          name="notes"
          rows={2}
          placeholder="Reference number, receipt details…"
          aria-invalid={Boolean(errors?.fieldErrors?.notes?.length)}
        />
        {errors?.fieldErrors?.notes ? (
          <p className="text-destructive text-xs" role="alert">
            {errors.fieldErrors.notes[0]}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <SubmitButton size="sm">Confirm payment received</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
