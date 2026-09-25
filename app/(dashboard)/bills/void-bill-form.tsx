"use client";

import { useActionState, useEffect, useState } from "react";

import { voidBillAction } from "@/app/(dashboard)/bills/actions";
import { FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function VoidBillForm({ billId }: { billId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(voidBillAction, null);
  const errors = state && !state.ok ? state.error : undefined;

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Void bill
      </Button>
    );
  }

  return (
    <form action={formAction} className="border-destructive/30 w-full space-y-3 rounded-lg border p-4">
      <input type="hidden" name="id" value={billId} />
      <FormError message={errors && errors.code !== "VALIDATION" ? errors.message : undefined} />
      <div className="space-y-1.5">
        <Label htmlFor={`void-reason-${billId}`}>Why is this bill being voided?</Label>
        <Textarea
          id={`void-reason-${billId}`}
          name="voidReason"
          rows={2}
          required
          placeholder="Duplicate, issued in error…"
          aria-invalid={Boolean(errors?.fieldErrors?.voidReason?.length)}
        />
        {errors?.fieldErrors?.voidReason ? (
          <p className="text-destructive text-xs" role="alert">
            {errors.fieldErrors.voidReason[0]}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <SubmitButton size="sm" variant="destructive">Void bill</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
