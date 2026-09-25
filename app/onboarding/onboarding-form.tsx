"use client";

import { useActionState, useState } from "react";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";

import {
  cancelOnboardingAction,
  createOrganizationAction,
} from "@/app/onboarding/actions";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
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

  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancel = async () => {
    if (isCancelling) return;
    setCancelError(null);
    setIsCancelling(true);
    setName("");
    setSlug("");

    try {
      const res = await cancelOnboardingAction();
      if (res && !res.ok) {
        setCancelError(res.error.message);
        setIsCancelling(false);
        return;
      }
    } catch {
      // Even if network or server call throws, proceed to navigate to sign-in
    }

    // Full page navigation to reset all in-memory React state, Supabase client session and cookies
    window.location.replace("/sign-in");
  };

  const errors = state?.ok === false ? state.error : undefined;
  const formMessage =
    errors && errors.code !== "VALIDATION" && errors.code !== "CONFLICT"
      ? errors.message
      : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="flex items-center justify-between pb-1">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isCancelling}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
        >
          <ArrowLeftIcon className="size-3.5" />
          {isCancelling ? "Returning to login..." : "Go back to login"}
        </button>
      </div>

      <FormError message={cancelError ?? formMessage} />

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

      <div className="space-y-2 pt-2">
        <SubmitButton className="w-full" disabled={isCancelling}>
          Create organization
        </SubmitButton>
        <Button
          type="button"
          variant="outline"
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? (
            <>
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              Discarding data & returning to login...
            </>
          ) : (
            <>
              <ArrowLeftIcon className="mr-2 size-4" />
              Cancel & return to login
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
