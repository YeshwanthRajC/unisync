"use server";

import { redirect } from "next/navigation";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { getPublicEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/server/result";

/**
 * Authentication actions.
 *
 * These deliberately do NOT use the `action()` wrapper from
 * `lib/server/action.ts`. That wrapper resolves a session and asserts a
 * permission before doing anything — which is exactly what cannot exist yet when
 * somebody is trying to sign in. Reusing it would mean inventing a "no permission
 * required" escape hatch in the one place where the permission check matters most.
 *
 * Supabase Auth owns credentials entirely. Nothing here touches a password beyond
 * handing it to the Supabase client, and no password is ever logged or stored in
 * our tables.
 */

const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .email("Enter a valid email address.");

/**
 * Minimum length only.
 *
 * Composition rules (a digit, a symbol, mixed case) measurably push people
 * towards predictable substitutions and password reuse. Supabase enforces its own
 * project-level minimum; this matches it and gets out of the way.
 */
const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.");

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(80),
  email: emailSchema,
  password: passwordSchema,
});

const resetRequestSchema = z.object({ email: emailSchema });

const newPasswordSchema = z.object({
  password: passwordSchema,
});

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

export async function signInAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return fail("VALIDATION", "Check the details below.", fieldErrors(parsed.error));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      /*
       * One message for both "no such account" and "wrong password".
       *
       * Distinguishing them turns the sign-in form into an account-enumeration
       * oracle: anyone could discover which email addresses are registered with
       * a clinic. Supabase's own message already conflates them; this makes the
       * intent explicit so nobody "improves" it later.
       */
      if (error.status === 400 || error.code === "invalid_credentials") {
        return fail("UNAUTHENTICATED", "That email or password is not correct.");
      }
      if (error.code === "email_not_confirmed") {
        return fail(
          "UNAUTHENTICATED",
          "Confirm your email address first — check your inbox for the link we sent.",
        );
      }
      return fail("UNEXPECTED", error.message);
    }
  } catch (error) {
    unstable_rethrow(error);
    return fail("UNEXPECTED", "Could not sign in. Please try again.");
  }

  // Outside the try: redirect() throws by design, and a catch would swallow it.
  redirect("/home");
}

export async function signUpAction(
  _previous: ActionResult<{ needsConfirmation: boolean }> | null,
  formData: FormData,
): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return fail("VALIDATION", "Check the details below.", fieldErrors(parsed.error));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const env = getPublicEnv();

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/onboarding`,
      },
    });

    if (error) {
      if (error.code === "user_already_exists" || error.status === 422) {
        return fail(
          "CONFLICT",
          "An account with that email already exists. Try signing in instead.",
        );
      }
      if (error.code === "weak_password") {
        return fail("VALIDATION", "Choose a stronger password.", {
          password: ["That password is too weak."],
        });
      }
      return fail("UNEXPECTED", error.message);
    }

    /*
     * With email confirmation enabled, Supabase returns a user but NO session.
     * Report that honestly rather than redirecting into the app, which would
     * bounce straight back to sign-in and look like a bug.
     */
    const needsConfirmation = data.session === null;
    if (needsConfirmation) return ok({ needsConfirmation: true });
  } catch (error) {
    unstable_rethrow(error);
    return fail("UNEXPECTED", "Could not create the account. Please try again.");
  }

  redirect("/onboarding");
}

export async function signOutAction(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function requestPasswordResetAction(
  _previous: ActionResult<{ sent: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ sent: true }>> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return fail("VALIDATION", "Check the details below.", fieldErrors(parsed.error));
  }

  const supabase = await createSupabaseServerClient();
  const env = getPublicEnv();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });

  /*
   * Report success even when Supabase reports a failure for an unknown address.
   *
   * Same reasoning as the sign-in message: a distinct "no such account" response
   * here lets anyone test whether an email is registered. Genuine errors (rate
   * limiting) are surfaced, because the user needs to know to wait.
   */
  if (error && error.status === 429) {
    return fail(
      "RATE_LIMITED",
      "Too many attempts. Wait a few minutes and try again.",
    );
  }

  return ok({ sent: true });
}

export async function updatePasswordAction(
  _previous: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return fail("VALIDATION", "Check the details below.", fieldErrors(parsed.error));
  }

  try {
    const supabase = await createSupabaseServerClient();

    // The recovery link established a session when it was exchanged at
    // /auth/callback, so this updates the signed-in user. Without that session
    // Supabase refuses, which is the correct outcome for a stale link.
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      if (error.code === "same_password") {
        return fail("VALIDATION", "Choose a password you have not used here before.", {
          password: ["This is already your current password."],
        });
      }
      return fail(
        "UNAUTHENTICATED",
        "That reset link has expired. Request a new one.",
      );
    }
  } catch (error) {
    unstable_rethrow(error);
    return fail("UNEXPECTED", "Could not update the password. Please try again.");
  }

  redirect("/home");
}
