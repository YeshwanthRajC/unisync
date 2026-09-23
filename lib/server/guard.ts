import "server-only";

import { redirect } from "next/navigation";

import { AuthenticationError, AuthorizationError } from "@/lib/auth/errors";
import type { Permission } from "@/lib/auth/permissions";
import { requirePermission, type OrganizationContext } from "@/lib/auth/session";

/**
 * Guard for Server Components, which have no return channel for an error.
 *
 * The classification happens HERE, on the server, where the error is still a
 * class. It deliberately does not happen in `error.tsx`: Next.js replaces a
 * forwarded error's message with a generic one in production, so `isAuthError`
 * inside an error boundary appears to work in `next dev` and silently stops
 * working once deployed — worse than not having it at all.
 *
 * `unauthorized()` and `forbidden()` from `next/navigation` would express this
 * more precisely, but they require `experimental.authInterrupts`. A sign-in
 * redirect and a rendered no-access route need no experimental flag and are
 * indistinguishable to the user.
 */
export async function loadContext(
  permission: Permission,
): Promise<OrganizationContext> {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      redirect("/sign-in");
    }
    if (error instanceof AuthorizationError) {
      // Signed in, but a member of no organization (or of a different one).
      redirect("/no-access");
    }
    throw error;
  }
}
