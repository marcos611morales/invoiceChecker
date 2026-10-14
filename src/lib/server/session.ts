import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // D-01: 30 days

const EnvSchema = z.object({
  APP_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
});
export type AuthEnv = z.infer<typeof EnvSchema>;

/** null means the server is not configured; every caller must fail closed. */
export function readAuthEnv(): AuthEnv | null {
  const parsed = EnvSchema.safeParse({
    APP_PASSWORD: process.env.APP_PASSWORD,
    SESSION_SECRET: process.env.SESSION_SECRET,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * D-02: keyed hash of the current password. Keyed with SESSION_SECRET so the
 * (readable) JWT payload cannot be used to brute-force the password offline.
 */
function passwordClaim(env: AuthEnv): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(`pwd-v1:${env.APP_PASSWORD}`)
    .digest("hex");
}

export function passwordMatches(submitted: string, env: AuthEnv): boolean {
  const a = createHash("sha256").update(submitted).digest();
  const b = createHash("sha256").update(env.APP_PASSWORD).digest();
  return timingSafeEqual(a, b); // equal length by construction (SHA-256 digests)
}

export async function createSessionToken(env: AuthEnv): Promise<string> {
  const key = new TextEncoder().encode(env.SESSION_SECRET);
  return new SignJWT({ pwd: passwordClaim(env) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(key);
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const env = readAuthEnv();
  if (!env) return false;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(env.SESSION_SECRET),
      { algorithms: ["HS256"] },
    );
    const a = Buffer.from(typeof payload.pwd === "string" ? payload.pwd : "");
    const b = Buffer.from(passwordClaim(env));
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
