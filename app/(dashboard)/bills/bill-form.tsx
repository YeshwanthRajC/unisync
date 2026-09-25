"use client";

import { useActionState, useState } from "react";
import { PlusIcon, TrashIcon } from "lucide-react";

import { createBillAction } from "@/app/(dashboard)/bills/actions";
import { Field, FormError } from "@/components/form/field";
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

type PatientOption = { id: string; fullName: string };
type AppointmentOption = { id: string; scheduledAt: Date; type: string };

type BillDefaults = {
  patientId?: string;
  appointmentId?: string;
};

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  CONSULTATION: "Consultation",
  CLEANING: "Cleaning",
  FILLING: "Filling",
  EXTRACTION: "Extraction",
  ROOT_CANAL: "Root Canal",
  CROWN_OR_BRIDGE: "Crown / Bridge",
  ORTHODONTIC: "Orthodontic",
  FOLLOW_UP: "Follow-up",
  EMERGENCY: "Emergency",
  OTHER: "Other",
};

export function BillForm({
  patients,
  appointments = [],
  defaults,
  currency,
}: {
  patients: readonly PatientOption[];
  appointments?: readonly AppointmentOption[];
  defaults?: BillDefaults;
  currency: string;
}) {
  const [state, formAction] = useActionState(createBillAction, null);
  const errors = state && !state.ok ? state.error : undefined;
  const formMessage = errors && errors.code !== "VALIDATION" ? errors.message : undefined;

  const [items, setItems] = useState([
    { description: "", quantity: "1", unitPrice: "" },
  ]);

  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(
    index: number,
    field: "description" | "quantity" | "unitPrice",
    value: string,
  ) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormError message={formMessage} />

      {/* Patient */}
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

      {/* Appointment (optional) */}
      {appointments.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="appointmentId">Appointment (optional)</Label>
          <Select name="appointmentId" defaultValue={defaults?.appointmentId ?? ""}>
            <SelectTrigger id="appointmentId" className="w-full">
              <SelectValue placeholder="Link to an appointment (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No appointment</SelectItem>
              {appointments.map((appt) => (
                <SelectItem key={appt.id} value={appt.id}>
                  {new Intl.DateTimeFormat("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }).format(appt.scheduledAt)}{" "}
                  · {APPOINTMENT_TYPE_LABELS[appt.type] ?? appt.type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        // Pass empty string so appointmentId is absent from the parse
        <input type="hidden" name="appointmentId" value="" />
      )}

      {/* Line items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Line items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <PlusIcon className="size-4" aria-hidden="true" />
            Add item
          </Button>
        </div>

        {errors?.fieldErrors?.items ? (
          <p className="text-destructive text-xs" role="alert">
            {errors.fieldErrors.items[0]}
          </p>
        ) : null}

        <div className="space-y-2">
          {/* Header row */}
          <div className="text-muted-foreground grid grid-cols-[1fr_80px_100px_32px] gap-2 text-xs">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit price ({currency})</span>
            <span />
          </div>

          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-2">
              <Input
                name={`items[${i}][description]`}
                placeholder="Service or treatment"
                value={item.description}
                onChange={(e) => updateItem(i, "description", e.target.value)}
                required
              />
              <Input
                name={`items[${i}][quantity]`}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="1"
                value={item.quantity}
                onChange={(e) => updateItem(i, "quantity", e.target.value)}
                required
              />
              <Input
                name={`items[${i}][unitPrice]`}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={item.unitPrice}
                onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(i)}
                disabled={items.length === 1}
                aria-label={`Remove item ${i + 1}`}
              >
                <TrashIcon className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>

        {/* Subtotal preview */}
        <div className="text-muted-foreground flex justify-end text-sm">
          Subtotal:{" "}
          {new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
          }).format(subtotal)}
        </div>
      </div>

      {/* Discount & Tax */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="discount"
          label={`Discount (${currency})`}
          type="number"
          min={0}
          step="0.01"
          defaultValue={0}
          errors={errors?.fieldErrors?.discount}
        />
        <Field
          name="tax"
          label={`Tax (${currency})`}
          type="number"
          min={0}
          step="0.01"
          defaultValue={0}
          errors={errors?.fieldErrors?.tax}
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={3} />
      </div>

      <SubmitButton>Create bill</SubmitButton>
    </form>
  );
}
