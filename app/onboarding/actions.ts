"use server";

import { redirect, unstable_rethrow } from "next/navigation";

import { ensureProfile } from "@/lib/auth/provision";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { mapError } from "@/lib/server/error-mapping";
import { fail, ok, type ActionResult } from "@/lib/server/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createOrganizationForUser,
  createOrganizationSchema,
  revertOnboardingForUser,
  userHasOrganization,
} from "@/services/organizations";

/**
 * Create the organization for a signed-in user who has none.
 *
 * Like the auth actions, this cannot use the `action()` wrapper: that wrapper
 * calls `requirePermission`, which resolves an organization context — and the
 * whole point here is that no organization exists yet. It authenticates, it does
 * not authorize against a tenant.
 */
export async function createOrganizationAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    // The user may arrive here straight from the confirmation link, before any
    // guarded page has run. Their Profile row must exist before a Membership can
    // reference it.
    await ensureProfile(user);

    const parsed = createOrganizationSchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      type: formData.get("type"),
      timezone: formData.get("timezone"),
      currency: formData.get("currency"),
      phone: formData.get("phone") ?? "",
      city: formData.get("city") ?? "",
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return fail("VALIDATION", "Check the details below.", fieldErrors);
    }

    await createOrganizationForUser(user, parsed.data);
  } catch (error) {
    unstable_rethrow(error);

    const mapped = mapError(error, "action:organization.create");
    // A taken slug is a field problem, not a form-level one, so it lands next to
    // the input the user has to change.
    if (mapped.code === "CONFLICT") {
      return fail("CONFLICT", mapped.message, { slug: [mapped.message] });
    }
    return fail(mapped.code, mapped.message, mapped.fieldErrors);
  }

  redirect("/home");
}

/**
 * Cancel onboarding, revert the sign-up process, and return to the login page.
 *
 * Removes the Supabase Auth user record and any provisioned Profile row so
 * that no incomplete registration data is stored permanently. The user's
 * session is cleared, and ok(null) is returned so client can navigate cleanly.
 */
export async function cancelOnboardingAction(): Promise<ActionResult<null>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return ok(null);
    }

    const hasOrg = await userHasOrganization(user.id);
    if (hasOrg) {
      return ok(null);
    }

    // Sign out from Supabase Auth session first to clear cookies
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Continue even if session sign-out threw an error
    }

    // Delete profile and auth.users record
    await revertOnboardingForUser(user.id);
    return ok(null);
  } catch (error) {
    unstable_rethrow(error);
    return fail("UNEXPECTED", "Could not cancel onboarding. Please try again.");
  }
}

