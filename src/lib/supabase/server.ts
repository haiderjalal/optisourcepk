import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";
import { SESSION_COOKIE_OPTIONS } from "./cookies";
import type { Database } from "@/types/database";

/**
 * A database request that has not answered by then is abandoned, so a stuck
 * connection shows an error instead of a page that never finishes loading.
 * Longer than any single query the back-office makes, shorter than the
 * function time limit.
 */
const DATABASE_TIMEOUT_MS = 25_000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(DATABASE_TIMEOUT_MS),
  });
}

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
    global: { fetch: fetchWithTimeout },
    cookieOptions: SESSION_COOKIE_OPTIONS,
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
