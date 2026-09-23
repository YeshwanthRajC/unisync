"use client";

import { useActionState } from "react";

import {
  createPatientAction,
  updatePatientAction,
} from "@/app/(dashboard)/patients/actions";
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

type PatientDefaults = {
  id?: string;
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  dateOfBirth?: Date | null;
  gender?: string;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
};

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

/** Create and edit share one form: the only difference is which action runs
 * and whether an id travels along as a hidden field. */
export function PatientForm({ defaults }: { defaults?: PatientDefaults }) {
  const isEdit = Boolean(defaults?.id);
  const [state, formAction] = useActionState(
    isEdit ? updatePatientAction : createPatientAction,
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="fullName"
          label="Full name"
          required
          defaultValue={defaults?.fullName}
          errors={errors?.fieldErrors?.fullName}
          className="sm:col-span-2"
        />
        <Field
          name="phone"
          label="Phone"
          type="tel"
          defaultValue={defaults?.phone ?? ""}
          errors={errors?.fieldErrors?.phone}
        />
        <Field
          name="email"
          label="Email"
          type="email"
          defaultValue={defaults?.email ?? ""}
          errors={errors?.fieldErrors?.email}
        />
        <Field
          name="dateOfBirth"
          label="Date of birth"
          type="date"
          defaultValue={toDateInputValue(defaults?.dateOfBirth)}
          errors={errors?.fieldErrors?.dateOfBirth}
        />
        <div className="space-y-1.5">
          <Label htmlFor="gender">Gender</Label>
          <Select name="gender" defaultValue={defaults?.gender ?? "UNDISCLOSED"}>
            <SelectTrigger id="gender" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MALE">Male</SelectItem>
              <SelectItem value="FEMALE">Female</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
              <SelectItem value="UNDISCLOSED">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium">Address</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="addressLine"
            label="Address"
            defaultValue={defaults?.addressLine ?? ""}
            errors={errors?.fieldErrors?.addressLine}
            className="sm:col-span-2"
          />
          <Field
            name="city"
            label="City"
            defaultValue={defaults?.city ?? ""}
            errors={errors?.fieldErrors?.city}
          />
          <Field
            name="state"
            label="State"
            defaultValue={defaults?.state ?? ""}
            errors={errors?.fieldErrors?.state}
          />
          <Field
            name="postalCode"
            label="Postal code"
            defaultValue={defaults?.postalCode ?? ""}
            errors={errors?.fieldErrors?.postalCode}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium">Emergency contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="emergencyContactName"
            label="Contact name"
            defaultValue={defaults?.emergencyContactName ?? ""}
            errors={errors?.fieldErrors?.emergencyContactName}
          />
          <Field
            name="emergencyContactPhone"
            label="Contact phone"
            type="tel"
            defaultValue={defaults?.emergencyContactPhone ?? ""}
            errors={errors?.fieldErrors?.emergencyContactPhone}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={defaults?.notes ?? ""}
          aria-invalid={Boolean(errors?.fieldErrors?.notes?.length)}
        />
        {errors?.fieldErrors?.notes ? (
          <p className="text-destructive text-xs" role="alert">
            {errors.fieldErrors.notes[0]}
          </p>
        ) : null}
      </div>

      <SubmitButton>{isEdit ? "Save changes" : "Add patient"}</SubmitButton>
    </form>
  );
}
