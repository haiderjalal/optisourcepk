import { describe, expect, it } from "vitest";
import { readRawBody } from "@/lib/request-body";

/** A request whose body is a stream of the given chunks, with no declared length. */
function streamedRequest(chunks: string[]): Request {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

  return new Request("https://example.test/webhook", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
}

describe("readRawBody", () => {
  it("returns the exact text of a body within the limit", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      body: '{"entry":[]}',
    });

    expect(await readRawBody(request, 1024)).toEqual({
      ok: true,
      text: '{"entry":[]}',
    });
  });

  it("accepts a body exactly at the limit", async () => {
    const result = await readRawBody(streamedRequest(["abcd"]), 4);

    expect(result).toEqual({ ok: true, text: "abcd" });
  });

  it("refuses a body that streams past the limit without a declared length", async () => {
    const result = await readRawBody(
      streamedRequest(["aaaaaa", "bbbbbb", "cccccc"]),
      10,
    );

    expect(result).toEqual({ ok: false, status: 413 });
  });

  it("refuses from the declared length alone, before reading the body", async () => {
    const request = {
      headers: new Headers({ "content-length": "5000000" }),
      body: null,
    } as unknown as Request;

    expect(await readRawBody(request, 1024)).toEqual({
      ok: false,
      status: 413,
    });
  });

  it("treats a missing body as empty", async () => {
    const request = {
      headers: new Headers(),
      body: null,
    } as unknown as Request;

    expect(await readRawBody(request, 1024)).toEqual({ ok: true, text: "" });
  });
});
