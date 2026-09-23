"use client";

import { useActionState, useState } from "react";

import { closeAppointmentAction } from "@/app/(dashboard)/appointments/actions";
import { FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Closing an appointment is the manual gate: this form is the ONLY UI path to
 * it, requires the outcome to be written down, and submits through
 * `closeAppointmentAction`, which mints `HumanIntent` server-side from the
 * cookie-authenticated request that renders this page.
 */
export function CloseAppointmentForm({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(closeAppointmentAction, null);
  const errors = state && !state.ok ? state.error : undefined;

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Close appointment
      </Button>
    );
  }

  return (
    <form action={formAction} className="border-border w-full space-y-3 rounded-lg border p-4">
      <input type="hidden" name="id" value={appointmentId} />
      <FormError message={errors && errors.code !== "VALIDATION" ? errors.message : undefined} />
      <div className="space-y-1.5">
        <Label htmlFor="outcomeNotes">What happened at the visit?</Label>
        <Textarea
          id="outcomeNotes"
          name="outcomeNotes"
          rows={3}
          required
          aria-invalid={Boolean(errors?.fieldErrors?.outcomeNotes?.length)}
        />
        {errors?.fieldErrors?.outcomeNotes ? (
          <p className="text-destructive text-xs" role="alert">
            {errors.fieldErrors.outcomeNotes[0]}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <SubmitButton size="sm">Confirm and close</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
