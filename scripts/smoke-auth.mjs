// End-to-end gate check against a production server (`next start`).
// Usage: pnpm build && pnpm smoke:auth
import { spawn } from "node:child_process";

const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "smoke-test-password-0123456789";
const SECRET = "smoke-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz-0123456789";
let checks = 0;
let server = null;

function stop() {
  if (server && server.exitCode === null) {
    server.kill("SIGKILL");
  }
  server = null;
}

function fail(name, detail) {
  console.error(`smoke-auth: FAIL ${name}${detail ? ` (${detail})` : ""}`);
  stop();
  process.exit(1);
}

function check(name, condition, detail) {
  if (!condition) fail(name, detail);
  checks += 1;
}

async function startServer(env) {
  stop();
  server = spawn("node_modules/.bin/next", ["start", "-p", String(PORT)], {
    env: { ...process.env, ...env, NODE_ENV: "production" },
    stdio: "ignore",
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) fail("server-start", "next start exited early");
    try {
      const res = await fetch(`${BASE}/login`, { redirect: "manual" });
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  fail("server-start", "timeout waiting for /login");
}

const get = (path, cookie) =>
  fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie: `session=${cookie}` } : {},
  });

const login = (password, contentType = "application/json") =>
  fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": contentType },
    body: contentType === "application/json" ? JSON.stringify({ password }) : password,
  });

function sessionValue(res) {
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = /(?:^|,\s*)session=([^;]*)/.exec(setCookie);
  return match ? match[1] : "";
}

try {
  const goodEnv = { APP_PASSWORD: PASSWORD, SESSION_SECRET: SECRET };
  await startServer(goodEnv);

  let res = await get("/");
  check(
    "unauth / redirects to /login",
    res.status === 307 && new URL(res.headers.get("location") ?? "", BASE).pathname === "/login" &&
      !new URL(res.headers.get("location") ?? "", BASE).searchParams.has("next"),
    `status ${res.status} location ${res.headers.get("location")}`,
  );

  res = await get("/foo?x=1");
  const loc = res.headers.get("location") ?? "";
  check(
    "unauth /foo?x=1 keeps next",
    res.status === 307 && loc.endsWith("/login?next=%2Ffoo%3Fx%3D1"),
    `status ${res.status} location ${loc}`,
  );

  res = await get("/login");
  check("GET /login is 200", res.status === 200, `status ${res.status}`);

  res = await fetch(`${BASE}/api/llm/group`, { method: "POST", redirect: "manual" });
  const body401 = await res.json().catch(() => null);
  check(
    "unauth /api/llm/group is 401 unauthorized",
    res.status === 401 && body401 && body401.error === "unauthorized",
    `status ${res.status}`,
  );

  res = await login("anything", "text/plain");
  check("text/plain login is 400", res.status === 400, `status ${res.status}`);

  let t0 = Date.now();
  res = await login("wrong-password");
  const elapsed = Date.now() - t0;
  const bodyWrong = await res.json().catch(() => null);
  check(
    "wrong password is 401 invalid_password after >= 900 ms",
    res.status === 401 && bodyWrong && bodyWrong.error === "invalid_password" && elapsed >= 900,
    `status ${res.status} elapsed ${elapsed}ms`,
  );

  res = await login(PASSWORD);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const token = sessionValue(res);
  check(
    "right password sets a hardened session cookie",
    res.status === 200 &&
      token.length > 0 &&
      /httponly/i.test(setCookie) &&
      /samesite=lax/i.test(setCookie) &&
      /path=\//i.test(setCookie) &&
      /max-age=2592000/i.test(setCookie) &&
      /secure/i.test(setCookie),
    `status ${res.status} set-cookie ${setCookie.replace(token, "<token>")}`,
  );

  res = await get("/", token);
  const html = await res.text();
  check(
    "authenticated / is 200 with the folder picker",
    res.status === 200 && html.includes("Seleccionar carpeta"),
    `status ${res.status}`,
  );

  // Open Question 2: an authenticated visit to /login must stay reachable (no bounce).
  res = await get("/login", token);
  check("authenticated /login stays 200", res.status === 200, `status ${res.status}`);

  // Flip the FIRST character of the signature: the last base64url character of an HS256
  // signature carries 2 unused bits, so changing only it can leave the signature valid (flaky).
  const sigStart = token.lastIndexOf(".") + 1;
  const tampered =
    token.slice(0, sigStart) +
    (token.charAt(sigStart) === "A" ? "B" : "A") +
    token.slice(sigStart + 1);
  res = await get("/", tampered);
  check("tampered cookie is redirected", res.status === 307, `status ${res.status}`);

  res = await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    redirect: "manual",
    headers: { cookie: `session=${token}` },
  });
  check(
    "logout is 204 and clears the cookie",
    res.status === 204 && /max-age=0/i.test(res.headers.get("set-cookie") ?? ""),
    `status ${res.status} set-cookie ${res.headers.get("set-cookie")}`,
  );

  // D-02: a cookie signed under another password must be rejected after rotation.
  await startServer({ APP_PASSWORD: `${PASSWORD}-rotated`, SESSION_SECRET: SECRET });
  res = await get("/", token);
  check("old cookie rejected after APP_PASSWORD rotation", res.status === 307, `status ${res.status}`);

  // Fail closed: empty (not unset) so a local .env.local cannot fill them in.
  await startServer({ APP_PASSWORD: "", SESSION_SECRET: "" });
  res = await login(PASSWORD);
  const bodyCfg = await res.json().catch(() => null);
  check(
    "missing env: login is 500 server_not_configured",
    res.status === 500 && bodyCfg && bodyCfg.error === "server_not_configured",
    `status ${res.status}`,
  );
  res = await get("/", token);
  check("missing env: old cookie is redirected", res.status === 307, `status ${res.status}`);

  stop();
  console.log(`smoke-auth: OK (${checks} checks)`);
} catch (error) {
  console.error(error);
  fail("unexpected-error", error instanceof Error ? error.message : String(error));
}
