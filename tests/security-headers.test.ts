import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

interface HeaderPair {
  key: string;
  value: string;
}

async function headersForEveryRoute(): Promise<Map<string, string>> {
  const groups = await nextConfig.headers?.();
  const pairs = (groups ?? []).flatMap(
    (group) => group.headers as HeaderPair[],
  );
  return new Map(pairs.map((pair) => [pair.key, pair.value]));
}

describe("security headers", () => {
  it("applies to every route, not only the back office", async () => {
    const groups = await nextConfig.headers?.();

    expect(groups).toEqual([expect.objectContaining({ source: "/:path*" })]);
  });

  it.each([
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["Content-Security-Policy", "frame-ancestors 'none'"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["X-Permitted-Cross-Domain-Policies", "none"],
    ["Cross-Origin-Opener-Policy", "same-origin-allow-popups"],
  ])("sends %s: %s", async (key, value) => {
    const headers = await headersForEveryRoute();

    expect(headers.get(key)).toBe(value);
  });

  it("forces HTTPS for two years on this host only", async () => {
    const headers = await headersForEveryRoute();
    const hsts = headers.get("Strict-Transport-Security") ?? "";

    expect(hsts).toMatch(/max-age=63072000/);
    expect(hsts).not.toMatch(/includeSubDomains/i);
  });

  it("turns off the camera, microphone, location and payment APIs", async () => {
    const headers = await headersForEveryRoute();

    expect(headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
  });

  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
