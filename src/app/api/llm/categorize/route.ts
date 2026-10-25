import { NextResponse, type NextRequest } from "next/server";
import { categorizeRequestSchema } from "@/domain/llm/contract";
import { categorizeWithDeepSeek, readDeepseekEnv } from "@/lib/server/deepseek";
import { failure, readJsonBody } from "@/lib/server/llmRoute";

/** The same literal as the grouping route: the server deadline stays below it (D-28, Plan 04-06). */
export const maxDuration = 120;

/**
 * Category suggestion route (LLM-02). Same order as the grouping route: readJsonBody
 * (src/lib/server/llmRoute.ts) checks the session first, even though the proxy (src/proxy.ts)
 * already answers 401 to every /api/* request without one (ACC-03), then the content type, the
 * size and the JSON; then the strict body. Only supplier names, product names with their member
 * descriptions and the user's category names can pass the schema (LLM-03). The key and the
 * DeepSeek call live in src/lib/server/deepseek.ts.
 */
export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = categorizeRequestSchema.safeParse(body.json);
  if (!parsed.success) return failure("bad_request");

  const env = readDeepseekEnv();
  if (env === null) return failure("server_not_configured");

  const result = await categorizeWithDeepSeek(parsed.data, env, request.signal);
  if (!result.ok) return failure(result.error);
  return NextResponse.json({ answers: result.data, meta: result.meta });
}
