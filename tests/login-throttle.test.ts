import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class Redirect extends Error {
    constructor(readonly target: string) {
      super("NEXT_REDIRECT");
    }
  }

  return {
    Redirect,
    signInWithPassword: vi.fn(async () => ({ error: { status: 400 } })),
    requestHeaders: new Headers(),
  };
});

vi.mock("next/navigation", () => ({
  redirect: (target: string): never => {
    throw new mocks.Redirect(target);
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => mocks.requestHeaders,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { signInWithPassword: mocks.signInWithPassword },
  }),
}));

import { signIn } from "@/features/shop/auth/actions";

const GENERIC_FAILURE = "That email and password do not match.";

function credentials(): FormData {
  const form = new FormData();
  form.set("email", "owner@example.com");
  form.set("password", "not-the-password");
  return form;
}

describe("shop sign-in throttle", () => {
  it("counts a caller by the address the platform saw, not a leftmost hop it invents", async () => {
    // A unique platform-seen address so no other test shares this bucket.
    const platformAddress = "203.0.113.201";

    for (let attempt = 0; attempt < 8; attempt += 1) {
      // Each attempt claims a different first hop, as a script would.
      mocks.requestHeaders = new Headers({
        "x-forwarded-for": `10.9.8.${attempt + 1}, ${platformAddress}`,
      });
      const result = await signIn({}, credentials());
      expect(result.error).toBe(GENERIC_FAILURE);
    }

    mocks.requestHeaders = new Headers({
      "x-forwarded-for": `10.9.8.99, ${platformAddress}`,
    });
    const ninth = await signIn({}, credentials());

    expect(ninth.error).toMatch(/^Too many attempts/);
    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(8);
  });
});
