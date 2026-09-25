import { z } from "zod";

/**
 * Input schemas for the inventory module.
 * No `server-only`: client components import these to validate before submitting.
 */

export const STOCK_MOVEMENT_TYPES = [
  "STOCK_IN",
  "STOCK_OUT",
  "ADJUSTMENT",
  "RETURN",
  "WASTE",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  STOCK_IN: "Stock in",
  STOCK_OUT: "Stock out",
  ADJUSTMENT: "Adjustment",
  RETURN: "Return",
  WASTE: "Waste / Expired",
};

export const inventoryItemFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  sku: z.string().trim().max(100).optional().or(z.literal("")),
  unit: z.string().trim().min(1, "Unit is required (e.g. box, pack, kit).").max(50).default("unit"),
  minimumQuantity: z.coerce
    .number()
    .min(0, "Minimum quantity cannot be negative.")
    .max(999_999)
    .default(0),
  preferredQuantity: z.coerce
    .number()
    .min(0, "Preferred quantity cannot be negative.")
    .max(999_999)
    .default(0),
  initialQuantity: z.coerce
    .number()
    .min(0, "Initial quantity cannot be negative.")
    .max(999_999)
    .optional(),
});

export type InventoryItemFormInput = z.infer<typeof inventoryItemFormSchema>;

export const inventoryItemUpdateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, "Name is required.").max(200),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  sku: z.string().trim().max(100).optional().or(z.literal("")),
  unit: z.string().trim().min(1, "Unit is required.").max(50).default("unit"),
  minimumQuantity: z.coerce
    .number()
    .min(0, "Minimum quantity cannot be negative.")
    .max(999_999)
    .default(0),
  preferredQuantity: z.coerce
    .number()
    .min(0, "Preferred quantity cannot be negative.")
    .max(999_999)
    .default(0),
  isActive: z.boolean().default(true),
});

export type InventoryItemUpdateInput = z.infer<typeof inventoryItemUpdateSchema>;

export const stockMovementSchema = z.object({
  itemId: z.uuid("Select an item."),
  type: z.enum(STOCK_MOVEMENT_TYPES),
  quantity: z.coerce
    .number()
    .positive("Quantity must be greater than zero.")
    .max(999_999),
  /** For ADJUSTMENT: whether to increase or decrease current stock. */
  adjustmentDirection: z.enum(["INCREASE", "DECREASE"]).optional(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export type StockMovementInput = z.infer<typeof stockMovementSchema>;

export const inventoryItemIdSchema = z.object({ id: z.uuid() });

export const inventoryListParamsSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  lowStockOnly: z.coerce.boolean().optional().default(false),
  activeOnly: z.coerce.boolean().optional().default(true),
});

export type InventoryListParams = z.infer<typeof inventoryListParamsSchema>;
