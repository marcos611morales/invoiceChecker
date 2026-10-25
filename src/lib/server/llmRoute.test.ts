import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { LLM_LIMITS } from "@/domain/llm/contract";
import { failure, readJsonBody } from "./llmRoute";
import { createSessionToken } from "./session";

const PASSWORD = "correct horse battery staple";
const SECRET = "s".repeat(48);

let token = "";

interface Options {
  cookie?: string | null;
  contentType?: string | null;
  contentLength?: string;
}

function request(body: string, options: Options = {}): NextRequest {
  const headers = new Headers();
  const contentType = options.contentType === undefined ? "application/json" : options.contentType;
  if (contentType !== null) headers.set("content-type", contentType);
  const cookie = options.cookie === undefined ? token : options.cookie;
  if (cookie !== null) headers.set("cookie", `session=${cookie}`);
  if (options.contentLength !== undefined) headers.set("content-length", options.contentLength);
  return new NextRequest("http://localhost/api/llm/x", { method: "POST", headers, body });
}

async function bodyOf(response: Response): Promise<{ status: number; json: unknown }> {
  return { status: response.status, json: (await response.json()) as unknown };
}

beforeEach(async () => {
  vi.stubEnv("APP_PASSWORD", PASSWORD);
  vi.stubEnv("SESSION_SECRET", SECRET);
  token = await createSessionToken({ APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("failure", () => {
  it("answers our own status and the retryable flag, never an upstream status", async () => {
    expect(await bodyOf(failure("bad_request"))).toEqual({
      status: 400,
      json: { error: "bad_request", retryable: false },
    });
    expect(await bodyOf(failure("upstream_rate_limited"))).toEqual({
      status: 503,
      json: { error: "upstream_rate_limited", retryable: true },
    });
    expect(failure("upstream_balance").status).toBe(502);
    expect(failure("payload_too_large").status).toBe(413);
  });
});

describe("readJsonBody", () => {
  it("returns the parsed JSON for a valid session, media type and body", async () => {
    const result = await readJsonBody(request(JSON.stringify({ a: 1 })));
    expect(result).toEqual({ ok: true, json: { a: 1 } });
  });

  it("accepts the media type in any case with a charset", async () => {
    const result = await readJsonBody(
      request("[]", { contentType: "Application/JSON; charset=utf-8" }),
    );
    expect(result).toEqual({ ok: true, json: [] });
  });

  it("checks the session first, with the proxy's exact 401", async () => {
    const result = await readJsonBody(request("not json", { cookie: null, contentType: "text/plain" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(await bodyOf(result.response)).toEqual({ status: 401, json: { error: "unauthorized" } });
  });

  it("rejects a media type that only contains application/json", async () => {
    const result = await readJsonBody(
      request("{}", { contentType: "text/plain; application/json" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
  });

  it("rejects a missing content type", async () => {
    const result = await readJsonBody(request("{}", { contentType: null }));
    expect(result.ok).toBe(false);
  });

  it("answers 413 for a declared size over the limit", async () => {
    const result = await readJsonBody(
      request("{}", { contentLength: String(LLM_LIMITS.requestBytes + 1) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(await bodyOf(result.response)).toEqual({
      status: 413,
      json: { error: "payload_too_large", retryable: false },
    });
  });

  it("answers 413 for a real text over the limit even when the header lies", async () => {
    const big = JSON.stringify({ pad: "x".repeat(LLM_LIMITS.requestBytes) });
    const result = await readJsonBody(request(big, { contentLength: "10" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(413);
  });

  it("answers 400 for text that is not JSON", async () => {
    const result = await readJsonBody(request("not json"));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
  });
});
