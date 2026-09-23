import "server-only";

import type { User } from "@supabase/supabase-js";

import type { OrganizationContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ConflictError } from "@/lib/server/errors";
import type { UnitOfWork } from "@/lib/server/unit";
import {
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from "@/services/organizations/schema";

/**
 * Creating the first organization is the one write that cannot go through
 * `runCommand`.
 *
 * `runCommand` writes an `AuditLog` row scoped to an organizationId, and
 * requires an `OrganizationContext` — neither of which exists yet. The context
 * is the *result* of this operation, not an input to it. Pretending otherwise
 * would mean inventing a context, which is precisely the habit the whole tenancy
 * design exists to prevent.
 *
 * So this function opens its own transaction and writes its own audit row once
 * the organization id exists. Every other write in the application goes through
 * `runCommand`; this is the documented exception, and the only one.
 */
export async function createOrganizationForUser(
  user: User,
  input: CreateOrganizationInput,
): Promise<{ organizationId: string; slug: string }> {
  // Checked before the transaction so the user gets a field-level message rather
  // than a constraint violation. The unique index is still the real guarantee —
  // this is a nicer error, not the enforcement.
  const existing = await prisma.organization.findFirst({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(
      "That workspace address is already taken. Try another.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        type: input.type,
        timezone: input.timezone,
        currency: input.currency,
        phone: input.phone || null,
        city: input.city || null,
      },
    });

    // The creator owns it. OWNER is the only role the product surfaces today.
    await tx.membership.create({
      data: {
        organizationId: organization.id,
        profileId: user.id,
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        actorType: "USER",
        actorProfileId: user.id,
        action: "organization.create",
        entityType: "Organization",
        entityId: organization.id,
        metadata: { name: organization.name, slug: organization.slug },
      },
    });

    return { organizationId: organization.id, slug: organization.slug };
  });
}

/**
 * Update the organization's own details.
 *
 * Note `slug` and `type` are absent: changing a slug breaks every link anyone
 * has saved, and changing the type would reinterpret vertical-specific data.
 * Both need a deliberate migration path rather than a settings field.
 */
export async function updateOrganization(
  ctx: OrganizationContext,
  input: UpdateOrganizationInput,
  unit: UnitOfWork,
) {
  const organization = await unit.db.organization.update({
    where: { id: ctx.organizationId },
    data: {
      name: input.name,
      description: input.description || null,
      email: input.email || null,
      phone: input.phone || null,
      addressLine: input.addressLine || null,
      city: input.city || null,
      state: input.state || null,
      timezone: input.timezone,
      currency: input.currency,
    },
  });

  unit.target("Organization", organization.id);
  unit.note({ name: organization.name, timezone: organization.timezone });

  return organization;
}
