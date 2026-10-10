import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Data access layer for the back-office.
 *
 * `server-only` makes importing this from a Client Component a build error, so
 * the session check cannot be bundled to the browser and quietly skipped.
 *
 * This — not `proxy.ts` — is the security boundary. Next's own guidance is
 * explicit that a proxy matcher can be bypassed by moving a Server Function to
 * another route, so every entry point re-verifies here.
 */

/** The signed-in user, as read from their verified session token. */
export interface SessionUser {
  id: string;
  email: string | null;
}

export interface ShopSession {
  user: SessionUser;
  supabase: SupabaseClient<Database>;
}

/**
 * The signed-in user, or a redirect to the login page.
 *
 * `getClaims()` verifies the session token's signature against the project's
 * published signing key (ES256), so a page no longer waits on a round trip to
 * the auth server — that call was made on every page, twice counting the
 * proxy. The key is fetched once and cached. A tampered or expired token
 * fails verification exactly as before.
 *
 * `cache` dedupes this across a single render pass.
 */
export const requireUser = cache(async (): Promise<ShopSession> => {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  // An anonymous session has a `sub` too. The back-office is for the owner's
  // account only, so an anonymous one is treated as signed out.
  if (!claims?.sub || claims.is_anonymous === true) redirect("/shop/login");

  return {
    user: {
      id: claims.sub,
      email: typeof claims.email === "string" ? claims.email : null,
    },
    supabase,
  };
});

/**
 * The signed-in user, or `null`.
 *
 * For the few places that render differently when signed out rather than
 * refusing outright. Anything that reads or writes business data uses
 * `requireUser` instead.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
