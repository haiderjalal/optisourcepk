"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client.
 *
 * Only the login form needs this — every other shop read and write goes
 * through the server. Memoised because `createBrowserClient` sets up auth
 * listeners, and one per render would leak them.
 */
let client: SupabaseClient<Database> | undefined;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
  return client;
}
