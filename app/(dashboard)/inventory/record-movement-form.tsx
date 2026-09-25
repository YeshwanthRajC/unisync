"use client";

import { useActionState, useState } from "react";

import { recordStockMovementAction } from "@/app/(dashboard)/inventory/actions";
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
import {
  STOCK_MOVEMENT_TYPES,
  STOCK_MOVEMENT_TYPE_LABELS,
  type StockMovementType,
} from "@/services/inventory/schema";

export function RecordMovementForm({
  itemId,
  unit,
  currentStock,
}: {
  itemId: string;
  unit: string;
  currentStock: number;
}) {
  const [movementType, setMovementType] = useState<StockMovementType>("STOCK_IN");
  const [state, formAction] = useActionState(recordStockMovementAction, null);

  const errors = state && !state.ok ? state.error : undefined;
  const formMessage =
    errors && errors.code !== "VALIDATION" ? errors.message : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record Stock Movement</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4" noValidate>
          <FormError message={formMessage} />

          <input type="hidden" name="itemId" value={itemId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="type-select">Movement Type *</Label>
              <Select
                name="type"
                defaultValue="STOCK_IN"
                onValueChange={(val) => setMovementType(val as StockMovementType)}
              >
                <SelectTrigger id="type-select" className="w-full">
                  <SelectValue placeholder="Select movement type" />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_MOVEMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {STOCK_MOVEMENT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors?.fieldErrors?.type ? (
                <p className="text-destructive text-xs">{errors.fieldErrors.type[0]}</p>
              ) : null}
            </div>

            <Field
              name="quantity"
              type="number"
              min="0.01"
              step="any"
              label={`Quantity (${unit}) *`}
              placeholder="e.g. 5"
              errors={errors?.fieldErrors?.quantity}
              required
            />
          </div>

          {movementType === "ADJUSTMENT" ? (
            <div className="space-y-1.5">
              <Label htmlFor="direction-select">Adjustment Direction</Label>
              <Select name="adjustmentDirection" defaultValue="DECREASE">
                <SelectTrigger id="direction-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DECREASE">
                    Decrease stock (loss / correction down)
                  </SelectItem>
                  <SelectItem value="INCREASE">
                    Increase stock (found / correction up)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <Field
            name="reason"
            label="Reason / Notes"
            placeholder="e.g. Weekly clinic restocking, patient treatment use, expired batch"
            errors={errors?.fieldErrors?.reason}
          />

          <div className="flex items-center justify-between pt-2">
            <p className="text-muted-foreground text-xs">
              Current stock: <span className="font-semibold text-foreground">{currentStock} {unit}</span>
            </p>
            <SubmitButton>Confirm Movement</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
