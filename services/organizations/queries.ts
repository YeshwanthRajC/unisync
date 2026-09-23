import "server-only";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Db } from "@/lib/db/types";
import { NotFoundError } from "@/lib/server/errors";

/** The organization the caller is acting in, with its display settings. */
export async function getCurrentOrganization(
  ctx: OrganizationContext,
  db: Db = prisma,
) {
  const organization = await db.organization.findFirst({
    where: { id: ctx.organizationId },
  });

  if (!organization) throw new NotFoundError("organization");
  return organization;
}

/** Is this workspace address free? Used to give live feedback on the form. */
export async function isSlugAvailable(
  slug: string,
  db: Db = prisma,
): Promise<boolean> {
  const existing = await db.organization.findFirst({
    where: { slug },
    select: { id: true },
  });
  return existing === null;
}

/**
 * Does this user already belong to an organization?
 *
 * Used by onboarding to avoid offering setup to somebody who is already set up —
 * leaving that page reachable would let them create a second organization by
 * accident, and the product has no way to switch between them yet.
 *
 * Takes a profileId rather than an OrganizationContext, because the caller is by
 * definition someone who may not have an organization to build a context from.
 */
export async function userHasOrganization(
  profileId: string,
  db: Db = prisma,
): Promise<boolean> {
  const membership = await db.membership.findFirst({
    where: { profileId, status: "ACTIVE" },
    select: { id: true },
  });
  return membership !== null;
}
