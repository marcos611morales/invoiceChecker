// Proves the secrets stay out of everything that reaches a browser.
// Usage: node scripts/check-bundle-secrets.mjs
// Builds with unique sentinel values for APP_PASSWORD, SESSION_SECRET and
// DEEPSEEK_API_KEY, then scans every file under .next/static and the prerendered
// .html and .rsc files under .next/server/app for the sentinels and the variable
// names. Route-handler chunks legitimately contain the variable names and are not scanned.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const STATIC_DIR = ".next/static";
const PRERENDERED_DIR = ".next/server/app";
const passwordSentinel = `sentinel-pw-${randomBytes(18).toString("hex")}`;
const secretSentinel = `sentinel-sec-${randomBytes(30).toString("hex")}`;
const deepseekSentinel = `sentinel-ds-${randomBytes(30).toString("hex")}`;
const needles = [
  passwordSentinel,
  secretSentinel,
  deepseekSentinel,
  "APP_PASSWORD",
  "SESSION_SECRET",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
];

function fail(file, detail) {
  console.error(`check-bundle-secrets: FAIL ${file}${detail ? ` (${detail})` : ""}`);
  process.exit(1);
}

const build = spawnSync("node_modules/.bin/next", ["build"], {
  env: {
    ...process.env,
    APP_PASSWORD: passwordSentinel,
    SESSION_SECRET: secretSentinel,
    DEEPSEEK_API_KEY: deepseekSentinel,
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

// Prerendered pages reach browsers too; only their .html and .rsc output is scanned.
try {
  files.push(...walk(PRERENDERED_DIR).filter((file) => file.endsWith(".html") || file.endsWith(".rsc")));
} catch {
  fail(PRERENDERED_DIR, "directory not found after the build");
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
