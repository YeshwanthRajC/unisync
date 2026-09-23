"use client";

import { useActionState } from "react";

import {
  createAppointmentAction,
  updateAppointmentAction,
} from "@/app/(dashboard)/appointments/actions";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { APPOINTMENT_TYPE_LABELS } from "@/services/appointments/rules";
import { APPOINTMENT_TYPES } from "@/services/appointments/schema";

type PatientOption = { id: string; fullName: string };

type AppointmentDefaults = {
  id?: string;
  patientId?: string;
  scheduledAt?: string; // "YYYY-MM-DDTHH:mm", already in the org's local time
  durationMinutes?: number;
  type?: string;
  notes?: string | null;
};

export function AppointmentForm({
  patients,
  defaults,
}: {
  patients: readonly PatientOption[];
  defaults?: AppointmentDefaults;
}) {
  const isEdit = Boolean(defaults?.id);
  const [state, formAction] = useActionState(
    isEdit ? updateAppointmentAction : createAppointmentAction,
    null,
  );

  const errors = state && !state.ok ? state.error : undefined;
  const formMessage =
    errors && errors.code !== "VALIDATION" ? errors.message : undefined;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormError message={formMessage} />

      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="patientId">Patient</Label>
        <Select name="patientId" defaultValue={defaults?.patientId}>
          <SelectTrigger id="patientId" className="w-full">
            <SelectValue placeholder="Choose a patient" />
          </SelectTrigger>
          <SelectContent>
            {patients.map((patient) => (
              <SelectItem key={patient.id} value={patient.id}>
                {patient.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.fieldErrors?.patientId ? (
          <p className="text-destructive text-xs" role="alert">
            {errors.fieldErrors.patientId[0]}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="scheduledAt"
          label="Date and time"
          type="datetime-local"
          required
          defaultValue={defaults?.scheduledAt}
          errors={errors?.fieldErrors?.scheduledAt}
        />
        <Field
          name="durationMinutes"
          label="Duration (minutes)"
          type="number"
          min={5}
          max={480}
          step={5}
          defaultValue={defaults?.durationMinutes ?? 30}
          errors={errors?.fieldErrors?.durationMinutes}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="type">Type</Label>
        <Select name="type" defaultValue={defaults?.type ?? "CONSULTATION"}>
          <SelectTrigger id="type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {APPOINTMENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {APPOINTMENT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
          aria-invalid={Boolean(errors?.fieldErrors?.notes?.length)}
        />
      </div>

      <SubmitButton>{isEdit ? "Save changes" : "Schedule appointment"}</SubmitButton>
    </form>
  );
}
