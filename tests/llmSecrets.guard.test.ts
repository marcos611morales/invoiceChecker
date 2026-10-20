import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Source guard for ACC-04: the DeepSeek key is read in one server module, no
// variable of it is exposed to the browser, and every server module refuses to
// be imported by client code. Failures report the file path only.

const SRC = resolve(process.cwd(), "src");
const KEY_VARIABLE = "DEEPSEEK_API_KEY";

/** The one module that reads the key, plus the tests that stub it. */
const KEY_ALLOWED = new Set([
  "src/lib/server/deepseek.ts",
  // The end-to-end slice test drives the real route with a stubbed key.
  "src/features/products/ProductsTab.test.tsx",
]);
const KEY_ALLOWED_TEST_ROOTS = ["src/lib/server/", "src/app/api/llm/"];

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

function posixRelative(file: string): string {
  return relative(process.cwd(), file).split(sep).join("/");
}

function isTest(path: string): boolean {
  return /\.test\.tsx?$/.test(path);
}

const files = walk(SRC).filter((file) => /\.tsx?$/.test(file));

describe("llm secrets source guard (ACC-04)", () => {
  it("scans a plausible number of source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("no source file exposes a DeepSeek variable with a public prefix", () => {
    const offenders = files
      .filter((file) => /NEXT_PUBLIC_\w*DEEPSEEK/i.test(readFileSync(file, "utf8")))
      .map(posixRelative);
    expect(offenders).toEqual([]);
  });

  it("only the server module and the tests that stub it mention the key variable", () => {
    const offenders = files
      .filter((file) => readFileSync(file, "utf8").includes(KEY_VARIABLE))
      .map(posixRelative)
      .filter(
        (path) =>
          !KEY_ALLOWED.has(path) &&
          !(isTest(path) && KEY_ALLOWED_TEST_ROOTS.some((root) => path.startsWith(root))),
      );
    expect(offenders).toEqual([]);
  });

  it("every non-test module under src/lib/server starts with the server-only import", () => {
    const serverFiles = files
      .map(posixRelative)
      .filter((path) => path.startsWith("src/lib/server/") && !isTest(path));
    expect(serverFiles.length).toBeGreaterThan(0);
    const offenders = serverFiles.filter((path) => {
      const first = readFileSync(resolve(process.cwd(), path), "utf8").split("\n")[0]?.trim();
      return first !== 'import "server-only";';
    });
    expect(offenders).toEqual([]);
  });
});
