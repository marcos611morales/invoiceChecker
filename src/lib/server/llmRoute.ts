import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { LLM_LIMITS, isRetryable, type LlmErrorCode } from "@/domain/llm/contract";
import { requireSession } from "./requireSession";

/** Our own status for each of our own codes: an upstream status is never forwarded. */
function statusOf(code: LlmErrorCode): number {
  switch (code) {
    case "unauthorized":
      return 401;
    case "bad_request":
      return 400;
    case "payload_too_large":
      return 413;
    case "server_not_configured":
      return 500;
    case "upstream_rate_limited":
      return 503;
    case "upstream_timeout":
      return 504;
    case "upstream_auth":
    case "upstream_balance":
    case "upstream_rejected":
    case "upstream_unavailable":
    case "invalid_response":
    case "incomplete_response":
      return 502;
  }
}

/** The JSON error answer of the LLM routes: our own code, its retryable flag, our own status. */
export function failure(code: LlmErrorCode): NextResponse {
  return NextResponse.json(
    { error: code, retryable: isRetryable(code) },
    { status: statusOf(code) },
  );
}

export type JsonBodyResult =
  { ok: true; json: unknown } | { ok: false; response: NextResponse };

/**
 * The shared front of both LLM routes, in this order: the session (even though the proxy already
 * answers 401 to every /api/* request without one, ACC-03), the exact media type, the declared
 * size, the real text size and the JSON parse. The route then only parses the body with its own
 * strict schema and makes its own DeepSeek call. Keeping the sequence in one place stops the two
 * routes from drifting apart on a security-relevant check.
 */
export async function readJsonBody(request: NextRequest): Promise<JsonBodyResult> {
  const denied = await requireSession(request);
  if (denied) return { ok: false, response: denied };

  // The media type must be exactly application/json: a substring match would let a CORS-simple
  // «text/plain; application/json» request through.
  const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return { ok: false, response: failure("bad_request") };
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > LLM_LIMITS.requestBytes) {
    return { ok: false, response: failure("payload_too_large") };
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: failure("bad_request") };
  }
  if (Buffer.byteLength(text, "utf8") > LLM_LIMITS.requestBytes) {
    return { ok: false, response: failure("payload_too_large") };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, response: failure("bad_request") };
  }
  return { ok: true, json };
}
