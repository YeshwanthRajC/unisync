"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  createFollowUpAction,
  updateFollowUpAction,
} from "@/app/(dashboard)/followups/actions";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type FollowUpDefaults = {
  id?: string;
  patientId?: string;
  patientName?: string;
  dueDate?: string;
  reason?: string;
  notes?: string | null;
  appointmentId?: string | null;
  consultationId?: string | null;
};

export function FollowUpForm({
  defaults,
  patients,
}: {
  defaults?: FollowUpDefaults;
  patients?: Array<{ id: string; fullName: string; phone?: string | null }>;
}) {
  const isEdit = Boolean(defaults?.id);
  const [state, formAction] = useActionState(
    isEdit ? updateFollowUpAction : createFollowUpAction,
    null,
  );

  const errors = state && !state.ok ? state.error : undefined;
  const formMessage =
    errors && errors.code !== "VALIDATION" ? errors.message : undefined;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormError message={formMessage} />

      {defaults?.id ? (
        <input type="hidden" name="id" value={defaults.id} />
      ) : null}

      {defaults?.appointmentId ? (
        <input type="hidden" name="appointmentId" value={defaults.appointmentId} />
      ) : null}

      {defaults?.consultationId ? (
        <input type="hidden" name="consultationId" value={defaults.consultationId} />
      ) : null}

      {!isEdit && defaults?.patientId ? (
        <input type="hidden" name="patientId" value={defaults.patientId} />
      ) : null}

      {/* Patient Selection (if creating and not locked to a specific patient) */}
      {!isEdit && !defaults?.patientId && patients ? (
        <div className="space-y-1.5">
          <Label htmlFor="patientId">Select Patient *</Label>
          <select
            id="patientId"
            name="patientId"
            required
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">-- Choose a patient --</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} {p.phone ? `(${p.phone})` : ""}
              </option>
            ))}
          </select>
          {errors?.fieldErrors?.patientId ? (
            <p className="text-destructive text-xs">
              {errors.fieldErrors.patientId[0]}
            </p>
          ) : null}
        </div>
      ) : null}

      {defaults?.patientName ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <span className="text-muted-foreground">Patient:</span>{" "}
          <strong className="font-semibold">{defaults.patientName}</strong>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="dueDate"
          type="date"
          label="Due Date *"
          defaultValue={
            defaults?.dueDate ?? new Date().toISOString().slice(0, 10)
          }
          errors={errors?.fieldErrors?.dueDate}
          required
        />

        <Field
          name="reason"
          label="Reason / Purpose *"
          defaultValue={defaults?.reason ?? ""}
          placeholder="e.g. 6-month recall, check healing, crown fit"
          errors={errors?.fieldErrors?.reason}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes / Instructions</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={defaults?.notes ?? ""}
          placeholder="Add clinical or operational instructions for this follow-up..."
          rows={3}
        />
        {errors?.fieldErrors?.notes ? (
          <p className="text-destructive text-xs">
            {errors.fieldErrors.notes[0]}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" asChild>
          <Link href="/followups">Cancel</Link>
        </Button>
        <SubmitButton>
          {isEdit ? "Save Changes" : "Schedule Follow-up"}
        </SubmitButton>
      </div>
    </form>
  );
}
