import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { TenantScopeError } from "@/lib/db/tenant-guard";

/**
 * The tripwire is a backstop against a forgotten organizationId filter. These
 * tests exist because a backstop that silently stops working is worse than none:
 * it would give false confidence to every query written after it broke.
 *
 * The transaction case is the load-bearing one. Prisma query extensions are
 * documented as applying to the client, and it is NOT self-evident that they
 * also apply to the `tx` client handed to a `$transaction` callback. Every write
 * in this application happens inside a transaction, so if extensions did not
 * propagate there, the tripwire would cover only reads — which is exactly the
 * half that matters least.
 */

describe("tenant tripwire", () => {
  it("allows a query that is scoped to an organization", async () => {
    await expect(
      prisma.auditLog.findMany({
        where: { organizationId: "00000000-0000-0000-0000-000000000000" },
        take: 1,
      }),
    ).resolves.toEqual([]);
  });

  it("allows an AND-nested organization filter", async () => {
    await expect(
      prisma.auditLog.findMany({
        where: {
          AND: [
            { organizationId: "00000000-0000-0000-0000-000000000000" },
            { action: "anything" },
          ],
        },
        take: 1,
      }),
    ).resolves.toEqual([]);
  });

  it("throws on an unscoped findMany", async () => {
    await expect(prisma.auditLog.findMany({ take: 1 })).rejects.toThrow(
      TenantScopeError,
    );
  });

  it("throws on an unscoped count", async () => {
    await expect(prisma.membership.count()).rejects.toThrow(TenantScopeError);
  });

  it("refuses findUnique on a tenant-scoped model", async () => {
    await expect(
      prisma.membership.findUnique({
        where: { id: "00000000-0000-0000-0000-000000000000" },
      }),
    ).rejects.toThrow(TenantScopeError);
  });

  it("does NOT accept organizationId hidden inside an OR", async () => {
    // An organizationId inside OR does not constrain the result set to one
    // tenant, so accepting it would make the check worse than useless.
    await expect(
      prisma.auditLog.findMany({
        where: {
          OR: [
            { organizationId: "00000000-0000-0000-0000-000000000000" },
            { action: "anything" },
          ],
        },
      }),
    ).rejects.toThrow(TenantScopeError);
  });

  it("leaves non-tenant models alone", async () => {
    // Organization IS the tenant; Profile spans tenants. Neither carries an
    // organizationId, so neither may be required to filter on one.
    await expect(prisma.organization.findMany({ take: 1 })).resolves.toBeInstanceOf(
      Array,
    );
    await expect(prisma.profile.findMany({ take: 1 })).resolves.toBeInstanceOf(
      Array,
    );
  });

  it("applies inside $transaction — the case every write depends on", async () => {
    await expect(
      prisma.$transaction(async (tx) => tx.auditLog.findMany({ take: 1 })),
    ).rejects.toThrow(TenantScopeError);
  });

  it("applies to writes inside $transaction", async () => {
    await expect(
      prisma.$transaction(async (tx) =>
        tx.auditLog.create({
          data: { action: "tripwire.probe" } as never,
        }),
      ),
    ).rejects.toThrow(TenantScopeError);
  });
});
