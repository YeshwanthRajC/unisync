import type { OrganizationContext } from "@/lib/auth/session";

/**
 * Tenant scoping helpers.
 *
 * Every tenant-scoped query must filter on `organizationId`, and that id must
 * come from the server-resolved session context — never from request input.
 * These two functions are the only sanctioned way to express that, which makes
 * the filter greppable and gives `lib/db/tenant-guard.ts` something consistent
 * to verify.
 */

/** `{ organizationId }` for a `create`'s data or a simple `where`. */
export function orgScope(context: OrganizationContext): {
  organizationId: string;
} {
  return { organizationId: context.organizationId };
}

/**
 * Merge the tenant filter into an existing `where`.
 *
 * Written so the tenant filter is applied LAST and therefore cannot be
 * overridden by a caller-supplied `organizationId` — if request input somehow
 * reached the filter object, the session's value still wins.
 */
export function orgWhere<T extends object>(
  context: OrganizationContext,
  where: T,
): T & { organizationId: string } {
  return { ...where, organizationId: context.organizationId };
}
