import type { User } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  createOrganizationForUser,
  userHasOrganization,
} from "@/services/organizations";

/**
 * The full sign-up path, exercised against the real database.
 *
 * This exists because the tenant tripwire rejected `Membership.findFirst` —
 * which broke onboarding AND sign-in, since `requireOrganizationContext` makes
 * the same query. Neither was covered: the unit tests checked the guard's rules
 * in isolation, and nothing walked the path a new user actually takes.
 *
 * So this runs the real service functions through the real extended client. A
 * regression here fails a test rather than greeting a new user with a stack
 * trace on the first screen they ever see.
 */

const TEST_PROFILE_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TEST_SLUG_PREFIX = "onboarding-test-";

function fakeAuthUser(): User {
  // Only the fields the onboarding path reads. Cast rather than reconstructing
  // the whole Supabase User shape, which is large and irrelevant here.
  return {
    id: TEST_PROFILE_ID,
    email: "onboarding-test@example.com",
    user_metadata: { full_name: "Onboarding Test" },
  } as unknown as User;
}

afterEach(async () => {
  // Organization delete cascades to Membership and AuditLog.
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: TEST_SLUG_PREFIX } },
  });
  await prisma.profile.deleteMany({ where: { id: TEST_PROFILE_ID } });
});

describe("new account onboarding", () => {
  it("reports no organization for a brand-new profile", async () => {
    // The exact query that threw TenantScopeError: scoped by profileId, because
    // "which organizations does this person belong to?" cannot be scoped by one.
    await expect(userHasOrganization(TEST_PROFILE_ID)).resolves.toBe(false);
  });

  it("creates the organization, the OWNER membership and an audit record", async () => {
    const user = fakeAuthUser();
    const slug = `${TEST_SLUG_PREFIX}${Date.now()}`;

    await prisma.profile.create({
      data: { id: user.id, email: user.email!, fullName: "Onboarding Test" },
    });

    const result = await createOrganizationForUser(user, {
      name: "Onboarding Test Clinic",
      slug,
      type: "DENTAL_CLINIC",
      timezone: "Asia/Kolkata",
      currency: "INR",
      phone: "",
      city: "",
    });

    expect(result.slug).toBe(slug);

    const membership = await prisma.membership.findFirst({
      where: { profileId: user.id },
    });
    expect(membership?.role).toBe("OWNER");
    expect(membership?.status).toBe("ACTIVE");
    expect(membership?.organizationId).toBe(result.organizationId);

    // Creating an organization is the one write that cannot go through
    // runCommand — it has no context to be given — so it writes its own audit
    // record, and that is worth asserting rather than assuming.
    const audit = await prisma.auditLog.findFirst({
      where: { organizationId: result.organizationId, action: "organization.create" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorProfileId).toBe(user.id);

    await expect(userHasOrganization(user.id)).resolves.toBe(true);
  });

  it("refuses a slug that is already taken", async () => {
    const user = fakeAuthUser();
    const slug = `${TEST_SLUG_PREFIX}dup-${Date.now()}`;

    await prisma.profile.create({
      data: { id: user.id, email: user.email!, fullName: "Onboarding Test" },
    });

    const input = {
      name: "First",
      slug,
      type: "DENTAL_CLINIC" as const,
      timezone: "Asia/Kolkata" as const,
      currency: "INR" as const,
      phone: "",
      city: "",
    };

    await createOrganizationForUser(user, input);
    // A ConflictError, so onboarding can put the message beside the slug field
    // rather than showing a raw unique-constraint violation.
    await expect(
      createOrganizationForUser(user, { ...input, name: "Second" }),
    ).rejects.toThrow(/already taken/);
  });

  it("applies the organization's locale defaults", async () => {
    const user = fakeAuthUser();
    const slug = `${TEST_SLUG_PREFIX}locale-${Date.now()}`;

    await prisma.profile.create({
      data: { id: user.id, email: user.email!, fullName: "Onboarding Test" },
    });

    const { organizationId } = await createOrganizationForUser(user, {
      name: "Locale Clinic",
      slug,
      type: "DENTAL_CLINIC",
      timezone: "Asia/Kolkata",
      currency: "INR",
      phone: "+91 98400 11223",
      city: "Bengaluru",
    });

    const organization = await prisma.organization.findFirst({
      where: { id: organizationId },
    });
    expect(organization?.timezone).toBe("Asia/Kolkata");
    expect(organization?.currency).toBe("INR");
    expect(organization?.city).toBe("Bengaluru");
  });
});
