"use client";

import { useActionState, useState } from "react";

import { cancelAppointmentAction } from "@/app/(dashboard)/appointments/actions";
import { FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CancelAppointmentForm({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(cancelAppointmentAction, null);
  const errors = state && !state.ok ? state.error : undefined;

  if (!open) {
    return (
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Cancel appointment
      </Button>
    );
  }

  return (
    <form action={formAction} className="border-border w-full space-y-3 rounded-lg border p-4">
      <input type="hidden" name="id" value={appointmentId} />
      <FormError message={errors && errors.code !== "VALIDATION" ? errors.message : undefined} />
      <div className="space-y-1.5">
        <Label htmlFor="cancellationReason">Why is this being cancelled?</Label>
        <Textarea
          id="cancellationReason"
          name="cancellationReason"
          rows={2}
          required
          aria-invalid={Boolean(errors?.fieldErrors?.cancellationReason?.length)}
        />
        {errors?.fieldErrors?.cancellationReason ? (
          <p className="text-destructive text-xs" role="alert">
            {errors.fieldErrors.cancellationReason[0]}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <SubmitButton variant="destructive" size="sm">
          Confirm cancellation
        </SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Never mind
        </Button>
      </div>
    </form>
  );
}
