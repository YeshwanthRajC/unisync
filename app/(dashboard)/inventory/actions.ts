"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { action } from "@/lib/server/action";
import {
  inventoryItemFormSchema,
  inventoryItemUpdateSchema,
  stockMovementSchema,
  createInventoryItem,
  updateInventoryItem,
  recordStockMovement,
} from "@/services/inventory";

const createInventoryItemCommand = action({
  audit: "inventory.create",
  permission: "inventory.create",
  schema: inventoryItemFormSchema,
  entityType: "InventoryItem",
  revalidate: () => ["/inventory", "/home"],
  run: async ({ input, ctx, unit }) => {
    const item = await createInventoryItem(ctx, input, unit);
    return {
      id: item.id,
      name: item.name,
      quantityOnHand: item.quantityOnHand.toString(),
    };
  },
});

export async function createInventoryItemAction(
  _previous: unknown,
  formData: FormData,
) {
  const result = await createInventoryItemCommand(
    Object.fromEntries(formData.entries()),
  );
  if (result.ok) {
    redirect(`/inventory/${result.data.id}`);
  }
  return result;
}

const updateInventoryItemCommand = action({
  audit: "inventory.update",
  permission: "inventory.update",
  schema: inventoryItemUpdateSchema,
  entityType: "InventoryItem",
  revalidate: (input) => ["/inventory", `/inventory/${input.id}`, "/home"],
  run: async ({ input, ctx, unit }) => {
    const item = await updateInventoryItem(ctx, input, unit);
    return {
      id: item.id,
      name: item.name,
      quantityOnHand: item.quantityOnHand.toString(),
    };
  },
});

export async function updateInventoryItemAction(
  _previous: unknown,
  formData: FormData,
) {
  const raw = Object.fromEntries(formData.entries());
  const isActive = raw.isActive !== undefined ? raw.isActive === "true" || raw.isActive === "on" : true;
  return updateInventoryItemCommand({ ...raw, isActive });
}

const recordStockMovementCommand = action({
  audit: "inventory.movement",
  permission: "inventory.movement",
  schema: stockMovementSchema,
  entityType: "StockMovement",
  revalidate: (input) => ["/inventory", `/inventory/${input.itemId}`, "/home"],
  run: async ({ input, ctx, unit }) => {
    const movement = await recordStockMovement(ctx, input, unit);
    return {
      id: movement.id,
      itemId: movement.itemId,
      type: movement.type,
      quantity: movement.quantity.toString(),
      balanceAfter: movement.balanceAfter.toString(),
    };
  },
});

export async function recordStockMovementAction(
  _previous: unknown,
  formData: FormData,
) {
  const result = await recordStockMovementCommand(
    Object.fromEntries(formData.entries()),
  );
  if (result.ok) {
    revalidatePath(`/inventory/${result.data.itemId}`);
    revalidatePath("/inventory");
  }
  return result;
}
