import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { orgScope, orgWhere } from "@/lib/db/scope";
import { RuleViolationError } from "@/lib/server/errors";
import type { UnitOfWork } from "@/lib/server/unit";
import { Decimal } from "@/lib/db/generated/internal/prismaNamespace";
import { getInventoryItemOrThrow } from "@/services/inventory/queries";
import type {
  InventoryItemFormInput,
  InventoryItemUpdateInput,
  StockMovementInput,
} from "@/services/inventory/schema";

export async function createInventoryItem(
  ctx: OrganizationContext,
  input: InventoryItemFormInput,
  unit: UnitOfWork,
) {
  if (input.sku && input.sku.trim().length > 0) {
    const existingSku = await unit.db.inventoryItem.findFirst({
      where: orgWhere(ctx, { sku: input.sku.trim() }),
    });
    if (existingSku) {
      throw new RuleViolationError(`An item with SKU "${input.sku.trim()}" already exists.`);
    }
  }

  const initialQty = new Decimal(input.initialQuantity ?? 0);
  if (initialQty.lt(0)) {
    throw new RuleViolationError("Initial quantity cannot be negative.");
  }

  const item = await unit.db.inventoryItem.create({
    data: {
      name: input.name.trim(),
      category: input.category?.trim() || null,
      sku: input.sku?.trim() || null,
      unit: input.unit.trim() || "unit",
      quantityOnHand: initialQty,
      minimumQuantity: new Decimal(input.minimumQuantity ?? 0),
      preferredQuantity: new Decimal(input.preferredQuantity ?? 0),
      isActive: true,
      ...orgScope(ctx),
    },
  });

  // If opening stock was specified, write opening stock movement in the same transaction
  if (initialQty.gt(0)) {
    await unit.db.stockMovement.create({
      data: {
        itemId: item.id,
        type: "STOCK_IN",
        quantity: initialQty,
        balanceAfter: initialQty,
        reason: "Opening stock",
        performedByProfileId: ctx.profileId,
        ...orgScope(ctx),
      },
    });
  }

  unit.target("InventoryItem", item.id);
  unit.note({
    name: item.name,
    sku: item.sku ?? undefined,
    initialQuantity: initialQty.toString(),
  });

  return item;
}

export async function updateInventoryItem(
  ctx: OrganizationContext,
  input: InventoryItemUpdateInput,
  unit: UnitOfWork,
) {
  const existing = await getInventoryItemOrThrow(ctx, input.id, unit.db);

  if (input.sku && input.sku.trim().length > 0 && input.sku.trim() !== existing.sku) {
    const duplicate = await unit.db.inventoryItem.findFirst({
      where: orgWhere(ctx, { sku: input.sku.trim() }),
    });
    if (duplicate && duplicate.id !== input.id) {
      throw new RuleViolationError(`An item with SKU "${input.sku.trim()}" already exists.`);
    }
  }

  const item = await unit.db.inventoryItem.update({
    where: orgWhere(ctx, { id: input.id }),
    data: {
      name: input.name.trim(),
      category: input.category?.trim() || null,
      sku: input.sku?.trim() || null,
      unit: input.unit.trim() || "unit",
      minimumQuantity: new Decimal(input.minimumQuantity ?? 0),
      preferredQuantity: new Decimal(input.preferredQuantity ?? 0),
      isActive: input.isActive,
    },
  });

  unit.target("InventoryItem", item.id);
  unit.note({ name: item.name, isActive: item.isActive });

  return item;
}

export async function recordStockMovement(
  ctx: OrganizationContext,
  input: StockMovementInput,
  unit: UnitOfWork,
) {
  const item = await getInventoryItemOrThrow(ctx, input.itemId, unit.db);

  if (!item.isActive) {
    throw new RuleViolationError("Cannot record movements on a deactivated item.");
  }

  const currentBalance = new Decimal(item.quantityOnHand);
  const qty = new Decimal(input.quantity);

  if (qty.lte(0)) {
    throw new RuleViolationError("Quantity must be greater than zero.");
  }

  let balanceAfter: Decimal;

  switch (input.type) {
    case "STOCK_IN":
    case "RETURN":
      balanceAfter = currentBalance.add(qty);
      break;

    case "STOCK_OUT":
    case "WASTE":
      if (currentBalance.lt(qty)) {
        throw new RuleViolationError(
          `Cannot record stock reduction: requested ${qty.toString()} ${item.unit}, but only ${currentBalance.toString()} ${item.unit} available on hand.`,
        );
      }
      balanceAfter = currentBalance.sub(qty);
      break;

    case "ADJUSTMENT":
      if (input.adjustmentDirection === "INCREASE") {
        balanceAfter = currentBalance.add(qty);
      } else {
        if (currentBalance.lt(qty)) {
          throw new RuleViolationError(
            `Cannot reduce stock by ${qty.toString()} ${item.unit}: current balance is ${currentBalance.toString()} ${item.unit}.`,
          );
        }
        balanceAfter = currentBalance.sub(qty);
      }
      break;

    default: {
      const _exhaustive: never = input.type;
      throw new RuleViolationError(`Unknown movement type: ${_exhaustive}`);
    }
  }

  // Update item quantity on hand and write movement row in the same transaction
  await unit.db.inventoryItem.update({
    where: orgWhere(ctx, { id: input.itemId }),
    data: { quantityOnHand: balanceAfter },
  });

  const movement = await unit.db.stockMovement.create({
    data: {
      itemId: input.itemId,
      type: input.type,
      quantity: qty,
      balanceAfter,
      reason: input.reason?.trim() || null,
      performedByProfileId: ctx.profileId,
      ...orgScope(ctx),
    },
  });

  unit.target("InventoryItem", item.id);
  unit.note({
    movementId: movement.id,
    type: input.type,
    quantity: qty.toString(),
    balanceAfter: balanceAfter.toString(),
  });

  return movement;
}
