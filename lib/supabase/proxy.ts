import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";

/**
 * Refreshes the Supabase auth session on every matched request.
 *
 * Supabase access tokens are short-lived. Without a refresh at the edge, a
 * Server Component can observe an expired session and log the user out
 * mid-navigation. This runs before the page and rewrites the auth cookies onto
 * the outgoing response.
 *
 * Note: it does NOT authorize anything. Route protection belongs in the
 * server-side code that actually reads data — see `lib/auth/session.ts`.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // During initial setup the project may have no Supabase credentials yet.
  // Skip silently rather than throwing on every request.
  if (!isSupabaseConfigured()) return response;

  const env = getPublicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // `getUser()` revalidates the token against Supabase Auth. Do not replace it
  // with `getSession()`, which trusts the cookie without verifying it.
  await supabase.auth.getUser();

  return response;
}
