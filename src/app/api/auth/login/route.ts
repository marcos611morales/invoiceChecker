import { NextResponse } from "next/server";
import { z } from "zod";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  createSessionToken,
  passwordMatches,
  readAuthEnv,
} from "@/lib/server/session";

const Body = z.object({ password: z.string().min(1).max(512) }).strict();

export async function POST(request: Request) {
  const env = readAuthEnv();
  if (!env) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!passwordMatches(parsed.data.password, env)) {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // D-03
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(env), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
  return res;
}
