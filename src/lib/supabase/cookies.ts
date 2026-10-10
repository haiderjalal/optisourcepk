import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Attributes for the Supabase session cookies.
 *
 * `httpOnly` keeps the session token away from page scripts, so a script
 * injected by any future change cannot read it. `secure` stops it travelling
 * over plain HTTP in production. Local development runs on http://localhost,
 * where a Secure cookie would be dropped, so that flag is production-only.
 */
export const SESSION_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};
