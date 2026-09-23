"use client";

import { useActionState } from "react";

import {
  createConsultationAction,
  updateConsultationAction,
} from "@/app/(dashboard)/consultations/actions";
import { FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ConsultationDefaults = {
  id?: string;
  patientId?: string;
  appointmentId?: string;
  chiefComplaint?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  notes?: string | null;
  followUpNeeded?: boolean;
};

function TextField({
  name,
  label,
  defaultValue,
  errors,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  errors?: string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Textarea
        id={name}
        name={name}
        rows={2}
        defaultValue={defaultValue ?? ""}
        aria-invalid={Boolean(errors?.length)}
      />
      {errors?.length ? (
        <p className="text-destructive text-xs" role="alert">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

/** Create and edit share one form. `patientId`/`appointmentId` are only
 * present (as hidden fields) when creating — see the schema comment on why
 * they can't be edited afterward. */
export function ConsultationForm({ defaults }: { defaults?: ConsultationDefaults }) {
  const isEdit = Boolean(defaults?.id);
  const [state, formAction] = useActionState(
    isEdit ? updateConsultationAction : createConsultationAction,
    null,
  );

  const errors = state && !state.ok ? state.error : undefined;
  const formMessage =
    errors && errors.code !== "VALIDATION" ? errors.message : undefined;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormError message={formMessage} />

      {isEdit ? (
        <input type="hidden" name="id" value={defaults?.id} />
      ) : (
        <>
          <input type="hidden" name="patientId" value={defaults?.patientId} />
          {defaults?.appointmentId ? (
            <input type="hidden" name="appointmentId" value={defaults.appointmentId} />
          ) : null}
        </>
      )}

      <TextField
        name="chiefComplaint"
        label="Chief complaint"
        defaultValue={defaults?.chiefComplaint}
        errors={errors?.fieldErrors?.chiefComplaint}
      />
      <TextField
        name="diagnosis"
        label="Diagnosis"
        defaultValue={defaults?.diagnosis}
        errors={errors?.fieldErrors?.diagnosis}
      />
      <TextField
        name="treatment"
        label="Treatment given"
        defaultValue={defaults?.treatment}
        errors={errors?.fieldErrors?.treatment}
      />
      <TextField
        name="notes"
        label="Notes"
        defaultValue={defaults?.notes}
        errors={errors?.fieldErrors?.notes}
      />

      <div className="flex items-center gap-2">
        <Checkbox
          id="followUpNeeded"
          name="followUpNeeded"
          value="true"
          defaultChecked={defaults?.followUpNeeded ?? false}
        />
        <Label htmlFor="followUpNeeded" className="font-normal">
          This patient needs a follow-up
        </Label>
      </div>

      <SubmitButton>{isEdit ? "Save changes" : "Record consultation"}</SubmitButton>
    </form>
  );
}
