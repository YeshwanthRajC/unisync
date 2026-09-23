import type { Prisma } from "@/lib/db/generated/client";

/**
 * Normalise arbitrary detail into something a `Json` column can actually store.
 *
 * Audit metadata is assembled from whatever a command chose to record, so it can
 * contain a Date, a Prisma Decimal, a bigint, or an `undefined` — none of which
 * are JSON values. A bare `as Prisma.InputJsonValue` cast would silence the
 * compiler and then fail at the database, or worse, write a mangled value.
 *
 * Round-tripping through JSON applies each value's own `toJSON` (Date and Decimal
 * both have one), drops `undefined` exactly as JSON semantics require, and turns
 * a bigint into a string rather than throwing.
 */
export function toJsonObject(
  value: Record<string, unknown>,
): Prisma.InputJsonObject | undefined {
  if (Object.keys(value).length === 0) return undefined;

  const serialized = JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );

  // An object of only `undefined` values serialises to "{}" — treat that as
  // "nothing worth recording" rather than writing an empty object.
  if (serialized === undefined || serialized === "{}") return undefined;

  return JSON.parse(serialized) as Prisma.InputJsonObject;
}
