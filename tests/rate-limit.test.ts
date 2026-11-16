import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clientAddressFrom,
  clientKey,
  isRateLimited,
  rateLimit,
} from "@/lib/rateLimit";

/** A key no other test shares, because the limiter is process-wide. */
function freshKey(label: string): string {
  return `test:${label}:${crypto.randomUUID()}`;
}

describe("clientAddressFrom", () => {
  it("reads the hop the platform appended, not the first one the client sent", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.7, 203.0.113.9",
    });

    expect(clientAddressFrom(headers)).toBe("203.0.113.9");
  });

  it("gives the same address however a caller rotates its own leftmost hop", () => {
    const first = new Headers({ "x-forwarded-for": "10.0.0.1, 203.0.113.9" });
    const second = new Headers({ "x-forwarded-for": "10.0.0.2, 203.0.113.9" });

    expect(clientAddressFrom(first)).toBe(clientAddressFrom(second));
  });

  it("falls back to x-real-ip, then to a fixed label when neither is present", () => {
    expect(clientAddressFrom(new Headers({ "x-real-ip": " 192.0.2.4 " }))).toBe(
      "192.0.2.4",
    );
    expect(clientAddressFrom(new Headers())).toBe("unknown");
  });
});

describe("clientKey", () => {
  it("reads the address from a route handler's request", () => {
    const request = new Request("https://example.test/api/inquiries", {
      method: "POST",
      headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" },
    });

    expect(clientKey(request)).toBe("2.2.2.2");
  });
});

describe("rateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit in a window, then refuses", () => {
    const key = freshKey("window");

    expect(rateLimit(key, { limit: 2 }).allowed).toBe(true);
    expect(rateLimit(key, { limit: 2 }).allowed).toBe(true);
    expect(rateLimit(key, { limit: 2 }).allowed).toBe(false);
  });

  it("opens again once the window has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const key = freshKey("reset");

    rateLimit(key, { limit: 1, windowMs: 60_000 });
    expect(rateLimit(key, { limit: 1, windowMs: 60_000 }).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    expect(rateLimit(key, { limit: 1, windowMs: 60_000 }).allowed).toBe(true);
  });
});

describe("isRateLimited", () => {
  it("reports the state without spending the budget", () => {
    const key = freshKey("peek");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(isRateLimited(key, { limit: 2 }).allowed).toBe(true);
    }

    rateLimit(key, { limit: 2 });
    rateLimit(key, { limit: 2 });

    expect(isRateLimited(key, { limit: 2 }).allowed).toBe(false);
  });
});
