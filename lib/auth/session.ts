import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { prisma } from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthenticationError, AuthorizationError } from "@/lib/auth/errors";
import { roleHasPermission, type Permission } from "@/lib/auth/permissions";
import type { MembershipRole } from "@/lib/db/generated/enums";

/**
 * Server-side session and tenant resolution.
 *
 * This is the ONLY place the application decides who the caller is and which
 * organization they are acting in. Every data path — pages, Route Handlers,
 * Server Actions and AI tools alike — must obtain its organizationId from
 * here, never from a request body or query parameter. That is what makes
 * tenant isolation a property of the system rather than a habit.
 */

export type OrganizationContext = {
  user: User;
  profileId: string;
  organizationId: string;
  organizationName: string;
  role: MembershipRole;
};

/**
 * `cache()` dedupes this per request, so a page that checks auth in a layout
 * and again in three components still makes one call to Supabase.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();

  // `getUser()` verifies the JWT with Supabase Auth. `getSession()` only
  // decodes the cookie and must not be trusted for authorization.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError();
  return user;
}

/**
 * Resolves the organization the caller is acting in.
 *
 * When `organizationId` is supplied it is treated as a REQUEST, not a fact:
 * membership is verified before it is honoured. When it is omitted, the
 * caller's single membership is used; ambiguity is an error rather than a
 * guess.
 */
export const requireOrganizationContext = cache(
  async (organizationId?: string): Promise<OrganizationContext> => {
    const user = await requireUser();

    const memberships = await prisma.membership.findMany({
      where: { profileId: user.id, status: "ACTIVE" },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    if (memberships.length === 0) {
      throw new AuthorizationError(
        "Your account does not belong to any organization yet.",
      );
    }

    const membership = organizationId
      ? memberships.find((m) => m.organizationId === organizationId)
      : memberships[0];

    if (!membership) {
      // Deliberately identical to the "no access" message: confirming that an
      // organization exists would leak the existence of another tenant.
      throw new AuthorizationError(
        "You do not have access to that organization.",
      );
    }

    return {
      user,
      profileId: user.id,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      role: membership.role,
    };
  },
);

/**
 * Asserts a permission and returns the context, so call sites read as
 * `const ctx = await requirePermission("member.invite")`.
 */
export async function requirePermission(
  permission: Permission,
  organizationId?: string,
): Promise<OrganizationContext> {
  const context = await requireOrganizationContext(organizationId);

  if (!roleHasPermission(context.role, permission)) {
    throw new AuthorizationError(
      `Your role (${context.role}) cannot perform "${permission}".`,
    );
  }

  return context;
}
