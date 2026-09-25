import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Db } from "@/lib/db/types";
import { orgWhere } from "@/lib/db/scope";
import { NotFoundError } from "@/lib/server/errors";
import { Decimal } from "@/lib/db/generated/internal/prismaNamespace";
import type { InventoryListParams } from "@/services/inventory/schema";

export async function listInventoryItems(
  ctx: OrganizationContext,
  params: Partial<InventoryListParams> = { activeOnly: true, lowStockOnly: false },
  db: Db = prisma,
) {
  const where: Record<string, unknown> = {};

  if (params.activeOnly) {
    where.isActive = true;
  }

  if (params.category && params.category.trim().length > 0) {
    where.category = params.category.trim();
  }

  if (params.search && params.search.trim().length > 0) {
    const query = params.search.trim();
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { sku: { contains: query, mode: "insensitive" } },
      { category: { contains: query, mode: "insensitive" } },
    ];
  }

  const items = await db.inventoryItem.findMany({
    where: orgWhere(ctx, where),
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  if (params.lowStockOnly) {
    return items.filter((item) =>
      new Decimal(item.quantityOnHand).lte(new Decimal(item.minimumQuantity)),
    );
  }

  return items;
}

export async function getInventoryItemOrThrow(
  ctx: OrganizationContext,
  id: string,
  db: Db = prisma,
) {
  const item = await db.inventoryItem.findFirst({
    where: orgWhere(ctx, { id }),
  });

  if (!item) {
    throw new NotFoundError("Inventory item not found.");
  }

  return item;
}

export async function listMovementsForItem(
  ctx: OrganizationContext,
  itemId: string,
  limit = 50,
  db: Db = prisma,
) {
  // Verify item belongs to this tenant first
  await getInventoryItemOrThrow(ctx, itemId, db);

  return db.stockMovement.findMany({
    where: orgWhere(ctx, { itemId }),
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      performedBy: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });
}

export async function countLowStock(
  ctx: OrganizationContext,
  db: Db = prisma,
): Promise<number> {
  const items = await db.inventoryItem.findMany({
    where: orgWhere(ctx, { isActive: true }),
    select: {
      quantityOnHand: true,
      minimumQuantity: true,
    },
  });

  return items.filter((item) =>
    new Decimal(item.quantityOnHand).lte(new Decimal(item.minimumQuantity)),
  ).length;
}

export async function listCategories(
  ctx: OrganizationContext,
  db: Db = prisma,
): Promise<string[]> {
  const items = await db.inventoryItem.findMany({
    where: orgWhere(ctx, { isActive: true, category: { not: null } }),
    select: { category: true },
    distinct: ["category"],
  });

  return items
    .map((item) => item.category)
    .filter((cat): cat is string => Boolean(cat && cat.trim().length > 0))
    .sort();
}
