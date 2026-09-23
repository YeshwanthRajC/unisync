import "server-only";

import { redirect } from "next/navigation";

import {
  AuthenticationError,
  AuthorizationError,
  NoOrganizationError,
} from "@/lib/auth/errors";
import type { Permission } from "@/lib/auth/permissions";
import { ensureProfile } from "@/lib/auth/provision";
import {
  requireOrganizationContext,
  requirePermission,
  requireUser,
  type OrganizationContext,
} from "@/lib/auth/session";

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

/** Signed in, with a provisioned Profile. Nothing about organizations yet. */
export async function loadUser() {
  try {
    const user = await requireUser();
    // First authenticated request after sign-up or email confirmation: this is
    // where the user becomes visible to the rest of the application.
    await ensureProfile(user);
    return user;
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/sign-in");
    throw error;
  }
}

/**
 * Signed in AND a member of an organization, with a permission asserted.
 *
 * The three redirects are deliberately different outcomes:
 *   - not signed in      -> sign in
 *   - no organization    -> create one (an onboarding step, not a refusal)
 *   - insufficient rights -> no access
 */
export async function loadContext(
  permission: Permission,
): Promise<OrganizationContext> {
  await loadUser();

  try {
    return await requirePermission(permission);
  } catch (error) {
    // Must be tested before AuthorizationError: it is a subclass.
    if (error instanceof NoOrganizationError) redirect("/onboarding");
    if (error instanceof AuthenticationError) redirect("/sign-in");
    if (error instanceof AuthorizationError) redirect("/no-access");
    throw error;
  }
}

/**
 * Organization context without asserting a specific permission.
 *
 * For the shell — the sidebar needs the organization's name before it knows
 * which page the user is heading to.
 */
export async function loadOrganization(): Promise<OrganizationContext> {
  await loadUser();

  try {
    return await requireOrganizationContext();
  } catch (error) {
    if (error instanceof NoOrganizationError) redirect("/onboarding");
    if (error instanceof AuthenticationError) redirect("/sign-in");
    if (error instanceof AuthorizationError) redirect("/no-access");
    throw error;
  }
}
