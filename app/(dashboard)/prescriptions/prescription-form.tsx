"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useState } from "react";

import { createPrescriptionAction } from "@/app/(dashboard)/prescriptions/actions";
import { FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ItemDraft = {
  medicine: string;
  dosage: string;
  frequency: string;
  durationDays: string;
  instructions: string;
};

const EMPTY_ITEM: ItemDraft = {
  medicine: "",
  dosage: "",
  frequency: "",
  durationDays: "",
  instructions: "",
};

/**
 * `items` has no native FormData shape (an array of objects), so it is kept
 * as component state and mirrored into a hidden JSON input on every change —
 * `createPrescriptionAction` parses that string back into an array server-side.
 */
export function PrescriptionForm({
  patientId,
  consultationId,
}: {
  patientId: string;
  consultationId?: string;
}) {
  const [state, formAction] = useActionState(createPrescriptionAction, null);
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);

  const errors = state && !state.ok ? state.error : undefined;
  const formMessage =
    errors && errors.code !== "VALIDATION" ? errors.message : undefined;

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormError message={formMessage} />

      <input type="hidden" name="patientId" value={patientId} />
      {consultationId ? (
        <input type="hidden" name="consultationId" value={consultationId} />
      ) : null}
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="border-border space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Medicine</Label>
                  <Input
                    value={item.medicine}
                    onChange={(e) => updateItem(index, { medicine: e.target.value })}
                    placeholder="Amoxicillin 500mg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Dosage</Label>
                  <Input
                    value={item.dosage}
                    onChange={(e) => updateItem(index, { dosage: e.target.value })}
                    placeholder="1 tablet"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Input
                    value={item.frequency}
                    onChange={(e) => updateItem(index, { frequency: e.target.value })}
                    placeholder="Twice daily"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Duration (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={item.durationDays}
                    onChange={(e) => updateItem(index, { durationDays: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Instructions</Label>
                  <Input
                    value={item.instructions}
                    onChange={(e) => updateItem(index, { instructions: e.target.value })}
                    placeholder="After food"
                  />
                </div>
              </div>
              {items.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                >
                  <Trash2Icon aria-hidden="true" />
                  <span className="sr-only">Remove medicine</span>
                </Button>
              ) : null}
            </div>
          </div>
        ))}

        {errors?.fieldErrors?.items ? (
          <p className="text-destructive text-xs" role="alert">
            {errors.fieldErrors.items[0]}
          </p>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setItems((current) => [...current, { ...EMPTY_ITEM }])}
        >
          <PlusIcon aria-hidden="true" />
          Add another medicine
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="instructions">General instructions</Label>
        <Textarea id="instructions" name="instructions" rows={2} />
      </div>

      <SubmitButton>Issue prescription</SubmitButton>
    </form>
  );
}
