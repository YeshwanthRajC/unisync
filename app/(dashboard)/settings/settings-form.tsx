"use client";

import { useActionState } from "react";
import { CheckIcon } from "lucide-react";

import { updateOrganizationAction } from "@/app/(dashboard)/settings/actions";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CURRENCIES,
  TIMEZONES,
} from "@/services/organizations/schema";

interface SettingsFormProps {
  initialData: {
    name: string;
    description: string | null;
    email: string | null;
    phone: string | null;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    timezone: string;
    currency: string;
    slug: string;
  };
}

export function SettingsForm({ initialData }: SettingsFormProps) {
  const [state, formAction] = useActionState(updateOrganizationAction, null);
  const errors = state && !state.ok ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-6">
      <FormError message={errors?.message} />

      {state?.ok && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckIcon className="size-4 text-emerald-600" />
          Settings updated successfully.
        </div>
      )}

      {/* General Clinic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Clinic Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            name="name"
            label="Clinic / Practice Name *"
            defaultValue={initialData.name}
            errors={errors?.fieldErrors?.name}
            required
          />

          <div className="space-y-1.5">
            <Label htmlFor="description">About the Practice</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={initialData.description || ""}
              rows={2}
              placeholder="Specialties, clinical focus, or practice overview."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="phone"
              label="Official Telephone"
              defaultValue={initialData.phone || ""}
              errors={errors?.fieldErrors?.phone}
              placeholder="+91 98765 43210"
            />

            <Field
              name="email"
              label="Official Email"
              type="email"
              defaultValue={initialData.email || ""}
              errors={errors?.fieldErrors?.email}
              placeholder="contact@brightsmile.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Location & Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Location & Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            name="addressLine"
            label="Street Address"
            defaultValue={initialData.addressLine || ""}
            errors={errors?.fieldErrors?.addressLine}
            placeholder="Suite 401, Healthcare Plaza"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="city"
              label="City"
              defaultValue={initialData.city || ""}
              errors={errors?.fieldErrors?.city}
              placeholder="Mumbai"
            />

            <Field
              name="state"
              label="State / Region"
              defaultValue={initialData.state || ""}
              errors={errors?.fieldErrors?.state}
              placeholder="Maharashtra"
            />
          </div>
        </CardContent>
      </Card>

      {/* Regional & Financial Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Regional Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Clinic Timezone</Label>
            <Select name="timezone" defaultValue={initialData.timezone}>
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currency">Billing Currency</Label>
            <Select name="currency" defaultValue={initialData.currency}>
              <SelectTrigger id="currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-2">
        <SubmitButton>Save Settings</SubmitButton>
      </div>
    </form>
  );
}
