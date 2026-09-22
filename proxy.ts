import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Runs before every matched request. Next.js 16 renamed this convention from
 * `middleware.ts` to `proxy.ts`.
 *
 * Its only job is refreshing the Supabase auth session. It deliberately does
 * NOT gate routes: authorization is enforced where data is read, in
 * `lib/auth/session.ts`, so a missing matcher entry can never become a
 * security hole.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files, which never need a
     * session refresh and would only add latency.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
