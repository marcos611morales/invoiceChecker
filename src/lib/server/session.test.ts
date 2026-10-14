import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSessionToken,
  passwordMatches,
  readAuthEnv,
  verifySessionToken,
} from "./session";
import type { AuthEnv } from "./session";

const PASSWORD = "correct horse battery staple";
const SECRET = "s".repeat(48);

function stubAuthEnv(password: string = PASSWORD, secret: string = SECRET) {
  vi.stubEnv("APP_PASSWORD", password);
  vi.stubEnv("SESSION_SECRET", secret);
}

function requireEnv(): AuthEnv {
  const env = readAuthEnv();
  if (!env) throw new Error("Test env is not configured");
  return env;
}

function base64url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

beforeEach(() => {
  stubAuthEnv();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session token round-trip (D-01)", () => {
  it("verifies a token created under the same env", async () => {
    const token = await createSessionToken(requireEnv());
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rejects an undefined or empty token", async () => {
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("")).toBe(false);
  });
});

describe("password rotation (D-02, ACC-02)", () => {
  it("stops verifying the token after APP_PASSWORD changes", async () => {
    const token = await createSessionToken(requireEnv());
    expect(await verifySessionToken(token)).toBe(true);

    vi.stubEnv("APP_PASSWORD", "a different password");
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("stops verifying the token after SESSION_SECRET changes", async () => {
    const token = await createSessionToken(requireEnv());

    vi.stubEnv("SESSION_SECRET", "t".repeat(48));
    expect(await verifySessionToken(token)).toBe(false);
  });
});

describe("tampering and forged algorithms", () => {
  it("rejects a token with one payload character changed", async () => {
    const token = await createSessionToken(requireEnv());
    const [header, payload, signature] = token.split(".");
    if (header === undefined || payload === undefined || signature === undefined) {
      throw new Error("A JWT must have three segments");
    }
    const first = payload.charAt(0);
    const replacement = first === "A" ? "B" : "A";
    const tampered = [header, replacement + payload.slice(1), signature].join(".");

    expect(tampered).not.toBe(token);
    expect(await verifySessionToken(tampered)).toBe(false);
  });

  it("rejects a hand-built token with alg none and an empty signature", async () => {
    const header = base64url(JSON.stringify({ alg: "none", typ: "JWT" }));
    const payload = base64url(
      JSON.stringify({
        pwd: "anything",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    const forged = `${header}.${payload}.`;

    expect(await verifySessionToken(forged)).toBe(false);
  });
});

describe("missing or weak configuration fails closed", () => {
  it("readAuthEnv returns null when APP_PASSWORD is empty", () => {
    vi.stubEnv("APP_PASSWORD", "");
    expect(readAuthEnv()).toBeNull();
  });

  it("readAuthEnv returns null when SESSION_SECRET is shorter than 32 chars", () => {
    vi.stubEnv("SESSION_SECRET", "x".repeat(31));
    expect(readAuthEnv()).toBeNull();
  });

  it("verifySessionToken returns false when the env is not configured", async () => {
    const token = await createSessionToken(requireEnv());

    vi.stubEnv("SESSION_SECRET", "short");
    expect(await verifySessionToken(token)).toBe(false);

    vi.stubEnv("SESSION_SECRET", SECRET);
    vi.stubEnv("APP_PASSWORD", "");
    expect(await verifySessionToken(token)).toBe(false);
  });
});

describe("passwordMatches", () => {
  it("is true for the exact password", () => {
    expect(passwordMatches(PASSWORD, requireEnv())).toBe(true);
  });

  it("is false for a different password of another length", () => {
    expect(passwordMatches("short", requireEnv())).toBe(false);
    expect(passwordMatches(`${PASSWORD} and more`, requireEnv())).toBe(false);
  });
});
