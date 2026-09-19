"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { headers } from "next/headers";

/**
 * Sign in and out of the back-office.
 *
 * Kept as Server Actions rather than route handlers so the login form works
 * without client-side JavaScript.
 */

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase().max(160),
  password: z.string().min(1, "Enter your password.").max(200),
});

export interface LoginState {
  error?: string;
}

/** A failed sign-in must never say which half was wrong. */
const GENERIC_FAILURE = "That email and password do not match.";

export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: GENERIC_FAILURE };
  }

  // Throttle credential stuffing. The limiter is process-local, which is
  // coarse but enough to stop a script hammering a single instance.
  const headerList = await headers();
  const client =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown";
  const limit = rateLimit(`shop-login:${client}`, {
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });

  if (!limit.allowed) {
    return {
      error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`,
    };
  }

  let supabase;
  try {
    supabase = await getSupabaseServerClient();
  } catch (error) {
    logger.error("Shop login attempted without Supabase configuration", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { error: "The back office is not configured yet." };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Log that it failed, never the credentials that failed.
    logger.warn("Shop login rejected", { status: error.status });
    return { error: GENERIC_FAILURE };
  }

  logger.info("Shop login succeeded");

  const next = formData.get("next");
  const target =
    typeof next === "string" && next.startsWith("/shop") ? next : "/shop";

  redirect(target);
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/shop/login");
}
