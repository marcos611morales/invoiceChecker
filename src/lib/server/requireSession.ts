import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/**
 * Second layer of ACC-03: the handler checks the session itself, so a proxy
 * matcher that drifts or is bypassed cannot open the route. Returns null when the
 * session is valid, otherwise the exact 401 the proxy sends.
 */
export async function requireSession(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return null;
  }
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
