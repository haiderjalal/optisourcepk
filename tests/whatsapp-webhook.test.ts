import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST } from "@/app/api/whatsapp/webhook/route";

const APP_SECRET = "test-app-secret";

function signed(body: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(body, "utf8").digest("hex")}`;
}

function post(body: string, signature: string | null): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature !== null) headers.set("x-hub-signature-256", signature);
  return new Request("https://example.test/api/whatsapp/webhook", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/whatsapp/webhook", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("acknowledges a correctly signed batch", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", APP_SECRET);
    const body = JSON.stringify({ entry: [] });

    const response = await POST(post(body, signed(body)));

    expect(response.status).toBe(200);
  });

  it("refuses a batch whose signature does not match", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", APP_SECRET);
    const body = JSON.stringify({ entry: [] });

    const response = await POST(post(body, signed('{"entry":[1]}')));

    expect(response.status).toBe(403);
  });

  it("refuses an oversized body before it is read or checked", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", APP_SECRET);
    const body = "a".repeat(300 * 1024);

    const response = await POST(post(body, null));

    expect(response.status).toBe(413);
  });
});
