import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safeNext";

// D-05: open-redirect vectors for the post-login ?next= target.
const rejected: ReadonlyArray<readonly [string, string | null | undefined]> = [
  ["null", null],
  ["undefined", undefined],
  ["empty string", ""],
  ["relative path without slash", "foo"],
  ["protocol-relative URL", "//evil.com"],
  ["backslash after slash", "/\\evil.com"],
  ["absolute https URL", "https://evil.com"],
  ["the login page itself", "/login"],
  ["the logout endpoint", "/api/auth/logout"],
  ["control characters (CRLF)", "/a\r\nb"],
  ["tab between slashes", "/\t/evil.com"],
  ["dot segment collapsing to //", "/.//evil.com"],
  ["parent segments collapsing to //", "/a/../..//evil.com"],
];

describe("safeNextPath rejects unsafe targets", () => {
  it.each(rejected)("returns / for %s", (_label, raw) => {
    expect(safeNextPath(raw)).toBe("/");
  });
});

describe("safeNextPath keeps safe internal targets", () => {
  it.each([
    ["/", "/"],
    ["/foo?x=1#h", "/foo?x=1#h"],
  ])("keeps %s", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  it("keeps an encoded backslash literal", () => {
    expect(safeNextPath("/%5Cevil.com")).toBe("/%5Cevil.com");
  });
});
