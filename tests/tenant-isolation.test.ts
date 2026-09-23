import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { TENANT_SCOPED_MODELS } from "@/lib/db/tenant-guard";
import { getPublicEnv } from "@/lib/env";

/**
 * Tenant isolation rests on three things, and each is checked here:
 *
 *   1. The tripwire knows which models are tenant-scoped. That list is hand-
 *      written, so it is exactly the kind of thing that goes stale the moment
 *      someone adds a model — and a missing entry silently disables the backstop
 *      for that table. So it is derived from the schema and compared, rather
 *      than trusted.
 *
 *   2. Child tables deliberately carry no organizationId. That is a design
 *      decision (one copy of the truth), not an oversight, so it is asserted
 *      rather than left to memory.
 *
 *   3. The publishable key, which ships inside the browser bundle, can read
 *      nothing at all.
 */

const SCHEMA = readFileSync(
  path.join(process.cwd(), "prisma", "schema.prisma"),
  "utf8",
);

/** Every `model X { ... }` block and whether it declares an organizationId. */
function modelsFromSchema(): Map<string, boolean> {
  const models = new Map<string, boolean>();
  const blockPattern = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;

  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(SCHEMA)) !== null) {
    const [, name, body] = match;
    if (!name || body === undefined) continue;
    models.set(name, /^\s*organizationId\s+String/m.test(body));
  }

  return models;
}

describe("tenant-scoped model registry", () => {
  it("parses the schema (guards against the regex silently matching nothing)", () => {
    const models = modelsFromSchema();
    expect(models.size).toBeGreaterThanOrEqual(20);
    expect(models.has("Patient")).toBe(true);
  });

  it("matches exactly the models that declare an organizationId", () => {
    const models = modelsFromSchema();
    const declared = [...models.entries()]
      .filter(([, hasOrg]) => hasOrg)
      .map(([name]) => name)
      .sort();
    const registered = [...TENANT_SCOPED_MODELS].sort();

    // A model in the schema but not the set = the tripwire is blind to it.
    expect(declared.filter((m) => !TENANT_SCOPED_MODELS.has(m))).toEqual([]);
    // A model in the set but not the schema = a stale entry after a rename.
    expect(registered.filter((m) => !models.get(m))).toEqual([]);
  });

  it("keeps the tenant itself and cross-tenant identities out of the set", () => {
    // An Organization cannot be filtered by organizationId, and a Profile is a
    // Supabase Auth user who may belong to several organizations.
    expect(TENANT_SCOPED_MODELS.has("Organization")).toBe(false);
    expect(TENANT_SCOPED_MODELS.has("Profile")).toBe(false);
  });

  it("keeps child rows unscoped, by design", () => {
    // These have no independent existence and are always reached through a
    // scoped parent. A redundant organizationId would be a second copy of the
    // truth that could disagree with the first.
    for (const child of ["PrescriptionItem", "BillItem", "AIMessage"]) {
      expect(TENANT_SCOPED_MODELS.has(child)).toBe(false);
    }
  });
});

describe("Row Level Security lockdown", () => {
  it("lets the browser-facing publishable key read nothing", async () => {
    // This key is in the page source of every deployed build. RLS is enabled and
    // FORCED with zero policies, so PostgREST must refuse every table.
    const env = getPublicEnv();
    const supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    for (const table of [
      "patients",
      "appointments",
      "bills",
      "payments",
      "organizations",
      "audit_logs",
    ]) {
      const { data, error } = await supabase.from(table).select("*").limit(1);

      // Assert an EXPLICIT refusal rather than merely an empty result.
      //
      // Accepting "no rows came back" would make this test pass vacuously
      // whenever the table happens to be empty — which is exactly the state a
      // fresh database is in, so it would have looked green while protecting
      // nothing. 42501 is Postgres' insufficient_privilege, produced by the
      // REVOKE in the lockdown migration.
      expect(error?.code).toBe("42501");
      expect(data).toBeNull();
    }
  });

  it("still lets the application read and write (RLS must not lock us out)", async () => {
    // The failure mode this guards against is silent and total: RLS makes SELECT
    // return ZERO ROWS rather than raising, so if the role Prisma connects as
    // were subject to the FORCEd policies, every screen in the application would
    // show "no data" and every test asserting an empty result would still pass.
    //
    // So assert the round trip explicitly, and assert the mechanism that makes it
    // work, rather than inferring health from an empty list.
    const organization = await prisma.organization.create({
      data: {
        name: "RLS Round Trip",
        slug: `rls-roundtrip-${Date.now()}`,
        timezone: "Asia/Kolkata",
      },
    });

    try {
      const readBack = await prisma.organization.findFirst({
        where: { id: organization.id },
      });
      expect(readBack?.name).toBe("RLS Round Trip");

      // A tenant-scoped write and read, which is what every module does.
      const patient = await prisma.patient.create({
        data: { organizationId: organization.id, fullName: "Round Trip Patient" },
      });
      const patients = await prisma.patient.findMany({
        where: { organizationId: organization.id },
      });
      expect(patients).toHaveLength(1);
      expect(patients[0]?.id).toBe(patient.id);
    } finally {
      // Cascades to the patient.
      await prisma.organization.delete({ where: { id: organization.id } });
    }
  });

  it("connects as a role that bypasses RLS, by design and on purpose", async () => {
    // Documents WHY the round trip above works, so a future reader does not
    // conclude the lockdown is protecting our own queries. It is not: tenant
    // isolation for Prisma is the application layer plus the tripwire.
    const rows = await prisma.$queryRaw<
      Array<{ rolbypassrls: boolean }>
    >`SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user`;

    expect(rows[0]?.rolbypassrls).toBe(true);
  });
});
