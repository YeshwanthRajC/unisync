"use client";

import { useActionState, useEffect, useState } from "react";

import { recordPaymentAction } from "@/app/(dashboard)/bills/actions";
import { FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/services/billing/schema";

export function RecordPaymentForm({
  billId,
  currency,
}: {
  billId: string;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(recordPaymentAction, null);
  const errors = state && !state.ok ? state.error : undefined;

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Record payment
      </Button>
    );
  }

  return (
    <form action={formAction} className="border-border w-full space-y-4 rounded-lg border p-4">
      <input type="hidden" name="billId" value={billId} />
      <FormError message={errors && errors.code !== "VALIDATION" ? errors.message : undefined} />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`amount-${billId}`}>
            Amount ({currency})
          </Label>
          <Input
            id={`amount-${billId}`}
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="0.00"
            aria-invalid={Boolean(errors?.fieldErrors?.amount?.length)}
          />
          {errors?.fieldErrors?.amount ? (
            <p className="text-destructive text-xs" role="alert">
              {errors.fieldErrors.amount[0]}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`method-${billId}`}>Method</Label>
          <Select name="method" defaultValue="CASH">
            <SelectTrigger id={`method-${billId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.fieldErrors?.method ? (
            <p className="text-destructive text-xs" role="alert">
              {errors.fieldErrors.method[0]}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`reference-${billId}`}>Reference (optional)</Label>
        <Input
          id={`reference-${billId}`}
          name="reference"
          placeholder="UPI ID, cheque no., card terminal ref…"
          maxLength={200}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`payment-notes-${billId}`}>Notes (optional)</Label>
        <Textarea
          id={`payment-notes-${billId}`}
          name="notes"
          rows={2}
          maxLength={1000}
        />
      </div>

      <div className="flex gap-2">
        <SubmitButton size="sm">Record payment</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
