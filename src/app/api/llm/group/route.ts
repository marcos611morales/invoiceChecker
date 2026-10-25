import { NextResponse, type NextRequest } from "next/server";
import {
  LLM_LIMITS,
  groupRequestSchema,
  isRetryable,
  type LlmErrorCode,
} from "@/domain/llm/contract";
import { groupWithDeepSeek, readDeepseekEnv } from "@/lib/server/deepseek";
import { requireSession } from "@/lib/server/requireSession";

/** Hobby with Fluid compute allows up to 300 s; the server deadline stays below this (D-28). */
export const maxDuration = 120;

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

function failure(code: LlmErrorCode): NextResponse {
  return NextResponse.json(
    { error: code, retryable: isRetryable(code) },
    { status: statusOf(code) },
  );
}

/**
 * Grouping route. The session is checked here, first, even though the proxy
 * (src/proxy.ts) already answers 401 to every /api/* request without one
 * (ACC-03). The key and the DeepSeek call live in src/lib/server/deepseek.ts.
 */
export async function POST(request: NextRequest) {
  const denied = await requireSession(request);
  if (denied) return denied;

  // The media type must be exactly application/json: a substring match would let a CORS-simple
  // «text/plain; application/json» request through.
  const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return failure("bad_request");
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > LLM_LIMITS.requestBytes) {
    return failure("payload_too_large");
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return failure("bad_request");
  }
  if (Buffer.byteLength(text, "utf8") > LLM_LIMITS.requestBytes) {
    return failure("payload_too_large");
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return failure("bad_request");
  }
  const parsed = groupRequestSchema.safeParse(json);
  if (!parsed.success) return failure("bad_request");

  const env = readDeepseekEnv();
  if (env === null) return failure("server_not_configured");

  const result = await groupWithDeepSeek(parsed.data, env, request.signal);
  if (!result.ok) return failure(result.error);
  return NextResponse.json({ groups: result.data, meta: result.meta });
}
