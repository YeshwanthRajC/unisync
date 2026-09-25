"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  createInventoryItemAction,
  updateInventoryItemAction,
} from "@/app/(dashboard)/inventory/actions";
import { Field, FormError } from "@/components/form/field";
import { SubmitButton } from "@/components/form/submit-button";
import { Button } from "@/components/ui/button";

type InventoryItemDefaults = {
  id?: string;
  name?: string;
  category?: string | null;
  sku?: string | null;
  unit?: string;
  minimumQuantity?: number | string;
  preferredQuantity?: number | string;
  isActive?: boolean;
};

export function InventoryItemForm({
  defaults,
}: {
  defaults?: InventoryItemDefaults;
}) {
  const isEdit = Boolean(defaults?.id);
  const [state, formAction] = useActionState(
    isEdit ? updateInventoryItemAction : createInventoryItemAction,
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
          name="name"
          label="Item Name *"
          defaultValue={defaults?.name ?? ""}
          errors={errors?.fieldErrors?.name}
          placeholder="e.g. Latex Gloves (Medium)"
          required
        />

        <Field
          name="category"
          label="Category"
          defaultValue={defaults?.category ?? ""}
          errors={errors?.fieldErrors?.category}
          placeholder="e.g. Consumables, Restorative, Instruments"
          hint="Group items together in reports and inventory lists"
        />

        <Field
          name="sku"
          label="SKU / Item Code"
          defaultValue={defaults?.sku ?? ""}
          errors={errors?.fieldErrors?.sku}
          placeholder="e.g. GLOVE-MED-01"
        />

        <Field
          name="unit"
          label="Unit of Measurement *"
          defaultValue={defaults?.unit ?? "unit"}
          errors={errors?.fieldErrors?.unit}
          placeholder="e.g. box, pack, kit, bottle"
          required
        />

        <Field
          name="minimumQuantity"
          type="number"
          min="0"
          step="any"
          label="Minimum Alert Quantity"
          defaultValue={defaults?.minimumQuantity?.toString() ?? "0"}
          errors={errors?.fieldErrors?.minimumQuantity}
          hint="Items at or below this level trigger low stock warnings"
        />

        <Field
          name="preferredQuantity"
          type="number"
          min="0"
          step="any"
          label="Target Stock Level"
          defaultValue={defaults?.preferredQuantity?.toString() ?? "0"}
          errors={errors?.fieldErrors?.preferredQuantity}
          hint="Ideal quantity to maintain on hand"
        />

        {!isEdit ? (
          <Field
            name="initialQuantity"
            type="number"
            min="0"
            step="any"
            label="Opening Stock"
            defaultValue="0"
            errors={errors?.fieldErrors?.initialQuantity}
            hint="Initial quantity on hand (creates an opening stock movement)"
          />
        ) : null}
      </div>

      {isEdit ? (
        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            value="true"
            defaultChecked={defaults?.isActive ?? true}
            className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="isActive" className="text-sm font-medium">
            Active item (uncheck to deactivate without deleting movement history)
          </label>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-4">
        <Button variant="outline" asChild>
          <Link href={defaults?.id ? `/inventory/${defaults.id}` : "/inventory"}>
            Cancel
          </Link>
        </Button>
        <SubmitButton>
          {isEdit ? "Save Changes" : "Create Item"}
        </SubmitButton>
      </div>
    </form>
  );
}
