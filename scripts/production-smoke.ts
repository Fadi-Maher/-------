import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const port = process.env.SMOKE_PORT || "3197";
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["dist/index.js"], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: "production", PORT: port },
  stdio: ["ignore", "pipe", "pipe"],
});
let startupOutput = "";
child.stdout.on("data", data => { startupOutput += String(data); });
child.stderr.on("data", data => { startupOutput += String(data); });
const passed: string[] = [];
const record = (name: string) => { passed.push(name); console.log(`PASS ${name}`); };
async function rpc(path: string, input?: unknown, mutation = false) {
  const payload = { json: input ?? null };
  const url = `${base}/api/trpc/${path}${mutation ? "" : `?input=${encodeURIComponent(JSON.stringify(payload))}`}`;
  const response = await fetch(url, {
    method: mutation ? "POST" : "GET",
    headers: mutation ? { "Content-Type": "application/json" } : {},
    body: mutation ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(5000),
  });
  return { status: response.status, body: await response.json() as any };
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error("Production server failed to start; review local server configuration.");
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* bounded startup wait */ }
    await delay(250);
  }
  assert(ready, "Production server startup timeout");
  record("production startup and liveness");
  const readiness = await fetch(`${base}/api/ready`, { signal: AbortSignal.timeout(5000) });
  assert.equal(readiness.status, 200);
  assert.equal((await readiness.json() as any).database, "connected");
  record("real database readiness (read-only SELECT 1)");
  for (const route of ["/", "/owner-login", "/login", "/track", "/contact", "/customer-signup"]) {
    const response = await fetch(`${base}${route}`);
    assert.equal(response.status, 200, route);
    assert((await response.text()).includes("<div id=\"root\"></div>"), route);
    assert.equal(response.headers.get("cache-control"), "no-cache");
  }
  record("production page routes and HTML cache policy");
  const config = await rpc("phoneAuth.config");
  assert.equal(config.body.result.data.json.mode, "disabled");
  assert.equal(config.body.result.data.json.realMessagesSent, false);
  record("production reports phone verification disabled, not fake delivery");
  for (const [path, input] of [
    ["phoneAuth.requestCode", { phone: "0500000000", language: "ar" }],
    ["requests.verifyPhoneDemo", { phone: "0500000000", code: "123456" }],
    ["auth.agentPhoneDemo", { phone: "0500000000", code: "123456" }],
  ] as const) {
    const result = await rpc(path, input, true);
    assert.equal(result.body.error.json.data.code, "PRECONDITION_FAILED", path);
  }
  record("all legacy and new demo phone-auth entry points reject production access");
  for (const [path, input] of [
    ["requests.list", null],
    ["requests.track", { reference: "SE-PRODUCTION-SMOKE-NONEXISTENT" }],
  ] as const) {
    const result = await rpc(path, input);
    assert.equal(result.body.error.json.data.code, "UNAUTHORIZED", path);
  }
  record("anonymous admin and reference-only request tracking are rejected");
  const api = await fetch(`${base}/api/nonexistent`);
  assert.equal(api.status, 404);
  assert(api.headers.get("content-type")?.includes("application/json"));
  assert.equal(api.headers.get("cache-control"), "no-store");
  assert.equal(api.headers.get("x-content-type-options"), "nosniff");
  assert.equal(api.headers.get("x-powered-by"), null);
  assert.equal((await fetch(`${base}/assets/nonexistent.js`)).status, 404);
  record("API privacy headers and missing asset/API 404 responses");
  const root = await (await fetch(`${base}/`)).text();
  const asset = root.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert(asset, "Built JS asset was not found");
  const assetResponse = await fetch(`${base}${asset}`);
  assert.equal(assetResponse.status, 200);
  assert.equal(assetResponse.headers.get("cache-control"), "public, max-age=31536000, immutable");
  record("built JavaScript asset and immutable cache policy");
  await writeFile("/tmp/maalamati-production-smoke.json", JSON.stringify({ checkedAt: new Date().toISOString(), status: "passed", checks: passed }, null, 2));
  console.log(`Production smoke passed: ${passed.length} groups. No customer records were created.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Production smoke failed");
  // Deliberately do not dump server output: upstream errors may contain secrets.
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  await Promise.race([new Promise<void>(resolve => child.once("exit", () => resolve())), delay(3000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
