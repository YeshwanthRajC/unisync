"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

/**
 * Supabase client for Client Components.
 *
 * Uses the anon/publishable key only. Every request it makes is subject to
 * Row Level Security in Postgres, so this client can never read another
 * tenant's rows even if the browser is tampered with. Authorization decisions
 * are still made on the server — this is defence in depth, not the fence.
 */
export function createSupabaseBrowserClient() {
  const env = getPublicEnv();

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
