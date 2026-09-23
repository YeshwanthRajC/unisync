import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Exchanges the code from a confirmation or recovery email for a session.
 *
 * Email confirmation is enabled on the Supabase project, so `signUp` returns a
 * user with no session and the account is only usable once the link is clicked.
 * This is where that click lands.
 *
 * It is a Route Handler rather than a page because it must SET cookies. A Server
 * Component cannot, and the whole purpose here is to persist the session.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  /*
   * Only same-origin relative paths are honoured.
   *
   * `next` arrives in a link that was emailed, so it is attacker-influenced. An
   * absolute URL here would make this endpoint an open redirect: a crafted
   * confirmation link could bounce a freshly authenticated user to another site.
   * Requiring a single leading slash and rejecting "//" (protocol-relative)
   * confines it to this app.
   */
  const requested = url.searchParams.get("next") ?? "/home";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/home";

  if (!code) {
    return NextResponse.redirect(
      new URL("/sign-in?error=missing-code", url.origin),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Expired or already-used link. Say which, without echoing the provider's
    // message, which can include the raw code.
    return NextResponse.redirect(
      new URL("/sign-in?error=link-expired", url.origin),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
