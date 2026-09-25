import { afterEach, describe, expect, it } from "vitest";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Decimal } from "@/lib/db/generated/internal/prismaNamespace";
import { NotFoundError, RuleViolationError } from "@/lib/server/errors";
import { runCommand } from "@/lib/server/unit";
import {
  createInventoryItem,
  updateInventoryItem,
  recordStockMovement,
  getInventoryItemOrThrow,
  listInventoryItems,
  listMovementsForItem,
} from "@/services/inventory";

const TEST_SLUG_PREFIX = "inventory-test-";
const TEST_PROFILE_ID = "dddddddd-0000-4000-8000-000000000004";

async function makeOrgContext(name: string): Promise<OrganizationContext> {
  await prisma.profile.upsert({
    where: { id: TEST_PROFILE_ID },
    create: { id: TEST_PROFILE_ID, email: "inventory-test@example.com" },
    update: {},
  });

  const organization = await prisma.organization.create({
    data: {
      name,
      slug: `${TEST_SLUG_PREFIX}${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timezone: "Asia/Kolkata",
    },
  });

  return {
    user: { id: TEST_PROFILE_ID } as OrganizationContext["user"],
    profileId: TEST_PROFILE_ID,
    organizationId: organization.id,
    organizationName: organization.name,
    role: "OWNER",
  };
}

afterEach(async () => {
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: TEST_SLUG_PREFIX } },
  });
  await prisma.profile.deleteMany({ where: { id: TEST_PROFILE_ID } });
});

describe("inventory: database constraints", () => {
  it("refuses a stock movement with zero or negative quantity via database CHECK constraint", async () => {
    const ctx = await makeOrgContext("Inv Check Org");
    const item = await runCommand(
      { ctx, action: "test.inventory.create", actor: { type: "USER" } },
      (unit) =>
        createInventoryItem(
          ctx,
          {
            name: "Test Syringe",
            unit: "piece",
            minimumQuantity: 10,
            preferredQuantity: 50,
          },
          unit,
        ),
    );

    // Negative quantity check
    await expect(
      prisma.$executeRaw`
        INSERT INTO stock_movements (id, "organizationId", "itemId", type, quantity, "balanceAfter", "createdAt")
        VALUES (gen_random_uuid(), ${ctx.organizationId}::uuid, ${item.id}::uuid, 'STOCK_IN', -5, 5, now())
      `,
    ).rejects.toThrow();

    // Zero quantity check
    await expect(
      prisma.$executeRaw`
        INSERT INTO stock_movements (id, "organizationId", "itemId", type, quantity, "balanceAfter", "createdAt")
        VALUES (gen_random_uuid(), ${ctx.organizationId}::uuid, ${item.id}::uuid, 'STOCK_IN', 0, 5, now())
      `,
    ).rejects.toThrow();
  });
});

describe("inventory: stock movement transaction and balance ledger", () => {
  it("creates item with initial quantity and writes opening stock movement", async () => {
    const ctx = await makeOrgContext("Inv Ledger Org 1");

    const item = await runCommand(
      { ctx, action: "test.inventory.create", actor: { type: "USER" } },
      (unit) =>
        createInventoryItem(
          ctx,
          {
            name: "Latex Gloves Medium",
            category: "Consumables",
            unit: "box",
            minimumQuantity: 5,
            preferredQuantity: 20,
            initialQuantity: 15,
          },
          unit,
        ),
    );

    expect(new Decimal(item.quantityOnHand).toNumber()).toBe(15);

    const movements = await listMovementsForItem(ctx, item.id);
    expect(movements).toHaveLength(1);
    expect(movements[0]!.type).toBe("STOCK_IN");
    expect(new Decimal(movements[0]!.quantity).toNumber()).toBe(15);
    expect(new Decimal(movements[0]!.balanceAfter).toNumber()).toBe(15);
  });

  it("updates quantityOnHand to match balanceAfter on STOCK_IN and STOCK_OUT", async () => {
    const ctx = await makeOrgContext("Inv Ledger Org 2");

    const item = await runCommand(
      { ctx, action: "test.inventory.create", actor: { type: "USER" } },
      (unit) =>
        createInventoryItem(
          ctx,
          {
            name: "Anesthetic Cartridges",
            unit: "box",
            minimumQuantity: 5,
            preferredQuantity: 30,
            initialQuantity: 10,
          },
          unit,
        ),
    );

    // Record STOCK_IN: +15
    const movement1 = await runCommand(
      { ctx, action: "test.inventory.movement", actor: { type: "USER" } },
      (unit) =>
        recordStockMovement(
          ctx,
          {
            itemId: item.id,
            type: "STOCK_IN",
            quantity: 15,
            reason: "Batch replenishment",
          },
          unit,
        ),
    );

    expect(new Decimal(movement1.balanceAfter).toNumber()).toBe(25);
    const itemAfter1 = await getInventoryItemOrThrow(ctx, item.id);
    expect(new Decimal(itemAfter1.quantityOnHand).toNumber()).toBe(25);

    // Record STOCK_OUT: -8
    const movement2 = await runCommand(
      { ctx, action: "test.inventory.movement", actor: { type: "USER" } },
      (unit) =>
        recordStockMovement(
          ctx,
          {
            itemId: item.id,
            type: "STOCK_OUT",
            quantity: 8,
            reason: "Clinic daily consumption",
          },
          unit,
        ),
    );

    expect(new Decimal(movement2.balanceAfter).toNumber()).toBe(17);
    const itemAfter2 = await getInventoryItemOrThrow(ctx, item.id);
    expect(new Decimal(itemAfter2.quantityOnHand).toNumber()).toBe(17);
  });

  it("refuses a STOCK_OUT when requested quantity exceeds stock on hand", async () => {
    const ctx = await makeOrgContext("Inv Insufficient Org");

    const item = await runCommand(
      { ctx, action: "test.inventory.create", actor: { type: "USER" } },
      (unit) =>
        createInventoryItem(
          ctx,
          {
            name: "Bonding Agent",
            unit: "bottle",
            minimumQuantity: 2,
            preferredQuantity: 5,
            initialQuantity: 3,
          },
          unit,
        ),
    );

    await expect(
      runCommand(
        { ctx, action: "test.inventory.movement", actor: { type: "USER" } },
        (unit) =>
          recordStockMovement(
            ctx,
            {
              itemId: item.id,
              type: "STOCK_OUT",
              quantity: 10, // More than 3 on hand
              reason: "Excessive usage attempt",
            },
            unit,
          ),
      ),
    ).rejects.toThrow(RuleViolationError);

    // Verify balance is unchanged
    const reloaded = await getInventoryItemOrThrow(ctx, item.id);
    expect(new Decimal(reloaded.quantityOnHand).toNumber()).toBe(3);
  });

  it("updating item metadata does not touch quantityOnHand", async () => {
    const ctx = await makeOrgContext("Inv Update Org");

    const item = await runCommand(
      { ctx, action: "test.inventory.create", actor: { type: "USER" } },
      (unit) =>
        createInventoryItem(
          ctx,
          {
            name: "Surgical Scalpel",
            unit: "pack",
            minimumQuantity: 5,
            preferredQuantity: 15,
            initialQuantity: 12,
          },
          unit,
        ),
    );

    await runCommand(
      { ctx, action: "test.inventory.update", actor: { type: "USER" } },
      (unit) =>
        updateInventoryItem(
          ctx,
          {
            id: item.id,
            name: "Surgical Scalpel #15",
            unit: "pack",
            minimumQuantity: 8,
            preferredQuantity: 25,
            isActive: true,
          },
          unit,
        ),
    );

    const reloaded = await getInventoryItemOrThrow(ctx, item.id);
    expect(reloaded.name).toBe("Surgical Scalpel #15");
    expect(new Decimal(reloaded.quantityOnHand).toNumber()).toBe(12);
  });
});

describe("inventory: tenant isolation", () => {
  it("never returns another organization's inventory items", async () => {
    const orgA = await makeOrgContext("Inv Tenant A");
    const orgB = await makeOrgContext("Inv Tenant B");

    await runCommand(
      { ctx: orgA, action: "test.inventory.create", actor: { type: "USER" } },
      (unit) =>
        createInventoryItem(
          orgA,
          { name: "Org A Item", unit: "box", minimumQuantity: 1, preferredQuantity: 5 },
          unit,
        ),
    );

    const orgBItem = await runCommand(
      { ctx: orgB, action: "test.inventory.create", actor: { type: "USER" } },
      (unit) =>
        createInventoryItem(
          orgB,
          { name: "Org B Item", unit: "box", minimumQuantity: 1, preferredQuantity: 5 },
          unit,
        ),
    );

    const orgAList = await listInventoryItems(orgA, { activeOnly: false });
    expect(orgAList.some((i) => i.name === "Org A Item")).toBe(true);
    expect(orgAList.some((i) => i.name === "Org B Item")).toBe(false);

    // orgA cannot read orgB's item directly
    await expect(getInventoryItemOrThrow(orgA, orgBItem.id)).rejects.toThrow(
      NotFoundError,
    );
  });
});
