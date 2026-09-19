import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Gate for the back-office.
 *
 * In Next 16 this file is `proxy.ts`, not `middleware.ts` — the middleware
 * convention is deprecated and renamed. It runs on the Node.js runtime, and
 * the `runtime` config option is not available here (setting it throws).
 *
 * Two jobs, and only these two:
 *
 *  1. Refresh the Supabase session and write the rotated cookies onto the
 *     response. Server Components cannot set cookies, so if this did not
 *     happen here the access token would expire and log the user out
 *     mid-session.
 *  2. Redirect an unauthenticated visitor to the login page, so they get a
 *     login form instead of an empty dashboard.
 *
 * It is NOT the security boundary. Server Functions are POST requests to the
 * route that uses them, so a matcher change or a moved action can silently
 * remove coverage. Every shop action and query re-checks the session through
 * `requireUser()` in the data access layer.
 */

const LOGIN_PATH = "/shop/login";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // Without configuration there is no session to check. Fail closed: send
  // everything to the login page, which reports the misconfiguration, rather
  // than leaving the back-office reachable.
  if (!url || !key) {
    if (request.nextUrl.pathname === LOGIN_PATH) return response;
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() validates the token with the auth server rather than trusting
  // the cookie's contents. getSession() would not.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && pathname !== LOGIN_PATH) {
    const target = new URL(LOGIN_PATH, request.url);
    // Come back to where they were headed once they are in.
    if (pathname !== "/shop") target.searchParams.set("next", pathname);
    return NextResponse.redirect(target);
  }

  if (user && pathname === LOGIN_PATH) {
    return NextResponse.redirect(new URL("/shop", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/shop", "/shop/:path*"],
};
