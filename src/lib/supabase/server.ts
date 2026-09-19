import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "@/types/database";

/**
 * Per-request Supabase client for Server Components, Server Actions and Route
 * Handlers.
 *
 * Never share one across requests — it carries the caller's session. `cookies()`
 * is async in Next 16, so this function is too.
 */
export async function getSupabaseServerClient(): Promise<
  SupabaseClient<Database>
> {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
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
          // Server Components cannot set cookies. Harmless here: `proxy.ts`
          // refreshes the session on every /shop request, so the tokens are
          // already current by the time a component renders.
        }
      },
    },
  });
}
