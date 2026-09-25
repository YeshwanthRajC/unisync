import "server-only";

import { z } from "zod";

import { defineTool } from "@/lib/ai/tools/define";
import {
  countLowStock,
  listInventoryItems,
  recordStockMovement,
} from "@/services/inventory";

export const listInventoryTool = defineTool({
  name: "list_inventory",
  description: "List clinic inventory items, medications, and supplies with current stock levels and reorder points.",
  permission: "inventory.read",
  audit: "inventory.read",
  mode: "read",
  input: z.object({
    search: z
      .string()
      .optional()
      .describe("Search term matching inventory item name or SKU code."),
    category: z.string().optional().describe("Filter by inventory category name."),
    lowStockOnly: z
      .boolean()
      .optional()
      .describe("When true, only items at or below minimum threshold are returned."),
  }),
  confirmation: { required: false },
  execute: async ({ input, ctx, db }) => {
    const items = await listInventoryItems(
      ctx,
      {
        search: input.search,
        category: input.category,
        lowStockOnly: input.lowStockOnly,
      },
      db,
    );
    return items.slice(0, 20).map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      category: i.category,
      quantityOnHand: Number(i.quantityOnHand),
      minimumQuantity: Number(i.minimumQuantity),
      preferredQuantity: Number(i.preferredQuantity),
      unit: i.unit,
      isLowStock: Number(i.quantityOnHand) <= Number(i.minimumQuantity),
    }));
  },
});

export const checkLowStockTool = defineTool({
  name: "check_low_stock",
  description: "Check the count and alert status of inventory items that are currently at or below minimum threshold.",
  permission: "inventory.read",
  audit: "inventory.read",
  mode: "read",
  input: z.object({
    includeDetails: z
      .boolean()
      .optional()
      .describe("When true, returns the names and quantities of the low-stock items."),
  }),
  confirmation: { required: false },
  execute: async ({ input, ctx, db }) => {
    const count = await countLowStock(ctx, db);
    if (!input.includeDetails) {
      return { lowStockCount: count };
    }
    const lowItems = await listInventoryItems(ctx, { lowStockOnly: true }, db);
    return {
      lowStockCount: count,
      items: lowItems.map((i) => ({
        id: i.id,
        name: i.name,
        quantityOnHand: Number(i.quantityOnHand),
        minimumQuantity: Number(i.minimumQuantity),
        unit: i.unit,
      })),
    };
  },
});

export const recordStockMovementTool = defineTool({
  name: "record_stock_movement",
  description: "Record incoming stock shipment, clinic dispensing, or stock adjustment for an inventory item.",
  permission: "inventory.movement",
  audit: "inventory.movement",
  mode: "write",
  confirmation: {
    required: true,
    describe: (input) =>
      `Record stock movement (${input.type}) of ${input.quantity} units for item ID ${input.itemId}`,
  },
  input: z.object({
    itemId: z.string().describe("UUID of the inventory item."),
    type: z
      .enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "RETURN", "WASTE"])
      .describe("Type of movement (STOCK_IN/RETURN increases stock; STOCK_OUT/WASTE decreases)."),
    quantity: z
      .number()
      .int()
      .positive()
      .describe("Quantity of units moved (positive integer)."),
    reason: z
      .string()
      .min(1)
      .describe("Reason, vendor invoice number, or explanation for this stock change."),
  }),
  execute: async ({ input, ctx, unit }) => {
    const movement = await recordStockMovement(
      ctx,
      {
        itemId: input.itemId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
      },
      unit,
    );
    return {
      id: movement.id,
      quantity: Number(movement.quantity),
      balanceAfter: Number(movement.balanceAfter),
    };
  },
});
