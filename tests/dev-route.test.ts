import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/dev/invoice-preview/route";

describe("GET /api/dev/invoice-preview", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["production", "test"])(
    "is a plain 404 when NODE_ENV is %s",
    async (environment) => {
      vi.stubEnv("NODE_ENV", environment);

      const response = await GET();

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).not.toBe("application/pdf");
    },
  );

  it("renders the sample invoice under the development server", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
