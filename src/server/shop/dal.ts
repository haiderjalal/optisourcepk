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

export interface ShopSession {
  user: User;
  supabase: SupabaseClient<Database>;
}

/**
 * The signed-in user, or a redirect to the login page.
 *
 * `cache` dedupes this across a single render pass, so a layout and three
 * components asking for the session make one call to the auth server, not four.
 */
export const requireUser = cache(async (): Promise<ShopSession> => {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/shop/login");

  return { user, supabase };
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
