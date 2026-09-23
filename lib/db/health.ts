import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Database liveness probe.
 *
 * This lives in the data layer rather than in the health route because the route
 * is forbidden — by the ESLint import boundary — from touching Prisma directly.
 * That boundary is worth keeping absolute: an exception for "just a connectivity
 * check" is exactly the shape the first tenant-scope bug would take.
 *
 * `$queryRaw` is not a model operation, so the tenant tripwire does not apply and
 * no organization scope is required. That is correct here: this asks whether
 * Postgres is reachable, not what it contains.
 */
export async function checkDatabaseReachable(): Promise<
  { reachable: true } | { reachable: false; detail: string }
> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { reachable: true };
  } catch (error) {
    return {
      reachable: false,
      // Prisma redacts credentials in connection errors, so the first line is
      // safe to surface. Only the first line: later lines can include the
      // resolved host and connection parameters.
      detail:
        error instanceof Error
          ? (error.message.split("\n")[0] ?? "Unknown error")
          : "Unknown error",
    };
  }
}
