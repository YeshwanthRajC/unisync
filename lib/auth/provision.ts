import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { prisma } from "@/lib/db/prisma";

/**
 * Make sure a signed-in Supabase Auth user has a `Profile` row.
 *
 * Supabase Auth owns the account; `Profile` is our side of it, keyed by the same
 * UUID so application tables can join against a person. Nothing creates that row
 * automatically, so without this a freshly confirmed user would be authenticated
 * yet invisible to every query — `requireOrganizationContext()` would find no
 * membership and the app would look broken for exactly the users it just gained.
 *
 * The alternative was a Postgres trigger on `auth.users`. Rejected: it would live
 * outside the migration history Prisma manages, it cannot be typechecked, and it
 * fires for service-role inserts too. Doing it on first authenticated request is
 * visible, testable, and idempotent.
 *
 * Called from the dashboard guard rather than from the sign-in action, so it also
 * covers the email-confirmation callback and any future OAuth path. Wrapped in
 * React `cache()` so a page whose layout and three components all guard performs
 * one upsert per request rather than five.
 */
export const ensureProfile = cache(async (user: User): Promise<void> => {
  const email = user.email;

  // A Supabase user can in principle have no email (phone-only sign-up). We do
  // not offer that, and `Profile.email` is non-null and unique, so refuse rather
  // than inventing a placeholder that would collide on the second such user.
  if (!email) {
    throw new Error(
      "This account has no email address. UniSync requires an email-based account.",
    );
  }

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  await prisma.profile.upsert({
    where: { id: user.id },
    // Keep email in step with Supabase if the user changes it there. `fullName`
    // is only ever set, never cleared, so an edit made inside UniSync is not
    // overwritten by stale sign-up metadata.
    update: {
      email,
      ...(fullName ? { fullName } : {}),
    },
    create: {
      id: user.id,
      email,
      fullName,
    },
  });
});
