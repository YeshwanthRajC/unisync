import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv, getServiceRoleKey } from "@/lib/env";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * Reads the session from the request cookies and refreshes it when needed.
 * Cookie writes are attempted but tolerated to fail: Server Components are not
 * allowed to mutate cookies, and in that case the refresh performed by
 * `middleware.ts` has already written them.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component; middleware owns the refresh.
          }
        },
      },
    },
  );
}

/**
 * Privileged client that BYPASSES Row Level Security.
 *
 * Reserved for genuine administrative tasks (provisioning a new organization,
 * back-office jobs). It must never be reachable from a user-supplied code
 * path, and the AI agent must never be given access to it.
 */
export function createSupabaseAdminClient() {
  const publicEnv = getPublicEnv();
  const serviceRoleKey = getServiceRoleKey();

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set; the admin client is unavailable.",
    );
  }

  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}
