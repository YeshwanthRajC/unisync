/**
 * Public surface of the inventory module. Other modules import from here only.
 */
export {
  createInventoryItem,
  updateInventoryItem,
  recordStockMovement,
} from "@/services/inventory/commands";

export {
  listInventoryItems,
  getInventoryItemOrThrow,
  listMovementsForItem,
  countLowStock,
  listCategories,
} from "@/services/inventory/queries";

export {
  STOCK_MOVEMENT_TYPES,
  STOCK_MOVEMENT_TYPE_LABELS,
  inventoryItemFormSchema,
  inventoryItemUpdateSchema,
  stockMovementSchema,
  inventoryItemIdSchema,
  inventoryListParamsSchema,
  type StockMovementType,
  type InventoryItemFormInput,
  type InventoryItemUpdateInput,
  type StockMovementInput,
  type InventoryListParams,
} from "@/services/inventory/schema";
