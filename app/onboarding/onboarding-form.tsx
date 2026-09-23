"use client";

import { useActionState, useState } from "react";

import { createOrganizationAction } from "@/app/onboarding/actions";
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
import { CURRENCIES, TIMEZONES, slugify } from "@/services/organizations/schema";

/**
 * Organization setup.
 *
 * The slug is derived from the name as you type, but stops following it the
 * moment you edit it yourself — auto-generating over a deliberate edit is the
 * behaviour people find infuriating, because it silently discards their choice.
 */
export function OnboardingForm({ suggestedName }: { suggestedName: string }) {
  const [state, formAction] = useActionState(createOrganizationAction, null);

  const [name, setName] = useState(suggestedName);
  const [slug, setSlug] = useState(slugify(suggestedName));
  const [slugEdited, setSlugEdited] = useState(false);

  const errors = state?.ok === false ? state.error : undefined;
  const formMessage =
    errors && errors.code !== "VALIDATION" && errors.code !== "CONFLICT"
      ? errors.message
      : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormError message={formMessage} />

      <Field
        name="name"
        label="Organization name"
        placeholder="Bright Smile Dental"
        required
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          if (!slugEdited) setSlug(slugify(event.target.value));
        }}
        errors={errors?.fieldErrors?.name}
      />

      <Field
        name="slug"
        label="Workspace address"
        placeholder="bright-smile-dental"
        required
        value={slug}
        onChange={(event) => {
          setSlugEdited(true);
          setSlug(event.target.value);
        }}
        hint="Lowercase letters, numbers and hyphens. Used in links."
        errors={errors?.fieldErrors?.slug}
      />

      <div className="space-y-1.5">
        <Label htmlFor="type">Organization type</Label>
        <Select name="type" defaultValue="DENTAL_CLINIC">
          <SelectTrigger id="type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DENTAL_CLINIC">Dental clinic</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Determines which vertical-specific features appear.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="timezone">Timezone</Label>
          <Select name="timezone" defaultValue="Asia/Kolkata">
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Select name="currency" defaultValue="INR">
            <SelectTrigger id="currency" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="city"
          label="City"
          placeholder="Bengaluru"
          errors={errors?.fieldErrors?.city}
        />
        <Field
          name="phone"
          label="Phone"
          type="tel"
          placeholder="+91 98400 11223"
          errors={errors?.fieldErrors?.phone}
        />
      </div>

      <SubmitButton className="w-full">Create organization</SubmitButton>
    </form>
  );
}
