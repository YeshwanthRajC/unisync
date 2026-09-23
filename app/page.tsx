import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

/**
 * Root route: a signpost, not a page.
 *
 * UniSync is an internal tool, so there is no marketing landing page to show. A
 * signed-in user goes to their workspace; anyone else goes to sign in.
 *
 * `getCurrentUser()` verifies the token with Supabase rather than trusting the
 * cookie, so a stale or forged cookie lands on sign-in rather than being waved
 * through to a page that would then fail deeper in the stack.
 */
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? "/home" : "/sign-in");
}
