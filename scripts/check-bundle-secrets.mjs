// Proves the secrets stay out of the client bundle.
// Usage: node scripts/check-bundle-secrets.mjs
// Builds with unique sentinel values for APP_PASSWORD and SESSION_SECRET, then
// scans every file under .next/static for the sentinels and the variable names.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const STATIC_DIR = ".next/static";
const passwordSentinel = `sentinel-pw-${randomBytes(18).toString("hex")}`;
const secretSentinel = `sentinel-sec-${randomBytes(30).toString("hex")}`;
const needles = [passwordSentinel, secretSentinel, "APP_PASSWORD", "SESSION_SECRET"];

function fail(file, detail) {
  console.error(`check-bundle-secrets: FAIL ${file}${detail ? ` (${detail})` : ""}`);
  process.exit(1);
}

const build = spawnSync("node_modules/.bin/next", ["build"], {
  env: {
    ...process.env,
    APP_PASSWORD: passwordSentinel,
    SESSION_SECRET: secretSentinel,
    NODE_ENV: "production",
  },
  stdio: ["ignore", "ignore", "inherit"],
});
if (build.status !== 0) {
  fail("next build", `exit ${String(build.status)}`);
}

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

let files;
try {
  files = walk(STATIC_DIR);
} catch {
  fail(STATIC_DIR, "directory not found after the build");
}
if (files.length === 0) {
  fail(STATIC_DIR, "no files to scan");
}

for (const file of files) {
  const text = readFileSync(file, "latin1");
  for (const needle of needles) {
    if (text.includes(needle)) {
      // Report the file and the kind of match, never the sentinel value itself.
      const kind = needle.startsWith("sentinel-") ? "sentinel value" : `variable name ${needle}`;
      fail(file, kind);
    }
  }
}

console.log(`check-bundle-secrets: OK (${files.length} files scanned)`);
