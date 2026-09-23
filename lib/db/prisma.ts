import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client";
import { getDatabaseEnv } from "@/lib/env";
import { tenantTripwire } from "@/lib/db/tenant-guard";

/**
 * The single Prisma client for the application.
 *
 * All database access goes through this module — no other file constructs a
 * PrismaClient, and nothing outside `lib/` and `services/` talks to the database
 * directly (enforced by an ESLint import boundary). `server-only` turns an
 * accidental import from a Client Component into a build error rather than a
 * runtime leak.
 */

function createPrismaClient() {
  const env = getDatabaseEnv();

  /*
   * Prisma 7 requires an explicit driver adapter. It is pointed at the POOLED
   * Supabase connection (Supavisor, port 6543) because serverless functions
   * open many short-lived connections and would otherwise exhaust Postgres'
   * direct connection limit. Migrations use DIRECT_URL — see prisma.config.ts.
   */
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  const client = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["warn", "error"],
  });

  /*
   * The tenant tripwire is applied HERE, inside the factory, and never at module
   * scope. `$extends` touches the client, and constructing the client reads
   * DATABASE_URL — doing it at import time is what used to break `next build`
   * for routes that never query the database.
   */
  return client.$extends(tenantTripwire());
}

/** The extended client's type. `$extends` changes it, so it must be derived. */
export type AppPrisma = ReturnType<typeof createPrismaClient>;

/**
 * Next.js clears the module registry on every hot reload in development, which
 * would otherwise spawn a new connection pool per edit until Postgres refuses
 * new clients. Caching on `globalThis` survives reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: AppPrisma | undefined;
};

function getPrismaClient(): AppPrisma {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}

/**
 * Construction is deferred until the first property access.
 *
 * Doing it eagerly would read DATABASE_URL at import time, which makes
 * `next build` fail on any machine or CI runner without database credentials —
 * even for routes that never touch the database. The proxy keeps the ergonomic
 * `import { prisma }` while moving the env requirement to the moment a query
 * is actually made.
 */
export const prisma: AppPrisma = new Proxy({} as AppPrisma, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
