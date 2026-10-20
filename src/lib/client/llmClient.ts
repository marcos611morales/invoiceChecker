/**
 * Browser call to the LLM routes. Plain fetch, no store: the run store decides
 * what to do with the outcome. The answer is validated with the shared zod
 * schemas before it is typed, and every failure is one of our own codes.
 */
import {
  groupResponseSchema,
  llmErrorBodySchema,
  type GroupRequest,
  type GroupResponse,
  type LlmErrorCode,
} from "@/domain/llm/contract";

/** Slightly above the route's maxDuration (180 s), so the server's own error arrives first. */
export const CLIENT_TIMEOUT_MS = 190000;

export type LlmFailure = LlmErrorCode | "offline" | "aborted";

export type LlmCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: LlmFailure };

const GROUP_URL = "/api/llm/group";

function failed(error: LlmFailure): LlmCallResult<never> {
  return { ok: false, error };
}

/**
 * POSTs one grouping body. `cancel` aborts the call ("aborted"); the client
 * deadline gives "upstream_timeout"; a network failure gives "offline".
 */
export async function postGroup(
  body: GroupRequest,
  cancel: AbortSignal,
): Promise<LlmCallResult<GroupResponse>> {
  const deadline = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  let status = 0;
  let ok = false;
  let payload: unknown;
  try {
    const response = await fetch(GROUP_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      signal: AbortSignal.any([cancel, deadline]),
    });
    status = response.status;
    ok = response.status === 200;
    payload = await response.json();
  } catch (error) {
    if (cancel.aborted) return failed("aborted");
    if (deadline.aborted) return failed("upstream_timeout");
    // Vercel's own 504 page is not JSON: it reads as «no payload», not as a lost connection.
    if (error instanceof SyntaxError) {
      payload = undefined;
    } else {
      return failed("offline");
    }
  }

  if (ok) {
    const parsed = groupResponseSchema.safeParse(payload);
    return parsed.success ? { ok: true, data: parsed.data } : failed("invalid_response");
  }
  const errorBody = llmErrorBodySchema.safeParse(payload);
  if (errorBody.success) return failed(errorBody.data.error);
  if (status === 401) return failed("unauthorized");
  // JSON that is not ours is unusable; anything else (a platform page) is a timeout.
  return payload === undefined ? failed("upstream_timeout") : failed("invalid_response");
}
