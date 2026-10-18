import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

async function contentSecurityPolicy(): Promise<string> {
  const rules = (await nextConfig.headers?.()) ?? [];
  for (const rule of rules) {
    for (const header of rule.headers) {
      if (header.key === "Content-Security-Policy") return header.value;
    }
  }
  return "";
}

function directive(policy: string, name: string): string | undefined {
  return policy.split("; ").find((part) => part === name || part.startsWith(`${name} `));
}

describe("Content-Security-Policy (D-24)", () => {
  it("lets same-origin and blob: workers run for the compression of large sheets", async () => {
    const policy = await contentSecurityPolicy();
    expect(directive(policy, "worker-src")).toBe("worker-src 'self' blob:");
  });

  it("keeps connect-src limited to 'self' so invoice data cannot leave the browser", async () => {
    const policy = await contentSecurityPolicy();
    expect(directive(policy, "connect-src")).toBe("connect-src 'self'");
  });

  it("does not allow blob: scripts", async () => {
    const policy = await contentSecurityPolicy();
    const scriptSrc = directive(policy, "script-src");
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("blob:");
  });
});
