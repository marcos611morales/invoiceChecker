import { NextResponse, type NextRequest } from "next/server";
import { groupRequestSchema } from "@/domain/llm/contract";
import { groupWithDeepSeek, readDeepseekEnv } from "@/lib/server/deepseek";
import { failure, readJsonBody } from "@/lib/server/llmRoute";

/** Hobby with Fluid compute allows up to 300 s; the server deadline stays below this (D-28). */
export const maxDuration = 120;

/**
 * Grouping route. readJsonBody (src/lib/server/llmRoute.ts) checks the session first, even though
 * the proxy (src/proxy.ts) already answers 401 to every /api/* request without one (ACC-03), then
 * the content type, the size and the JSON. The key and the DeepSeek call live in
 * src/lib/server/deepseek.ts.
 */
export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = groupRequestSchema.safeParse(body.json);
  if (!parsed.success) return failure("bad_request");

  const env = readDeepseekEnv();
  if (env === null) return failure("server_not_configured");

  const result = await groupWithDeepSeek(parsed.data, env, request.signal);
  if (!result.ok) return failure(result.error);
  return NextResponse.json({ groups: result.data, meta: result.meta });
}
