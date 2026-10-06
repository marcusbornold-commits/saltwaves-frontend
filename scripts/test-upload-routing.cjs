// Offline regression: paid uploads skip Mini; Free still depends on Mini health.
// Also covers Distans false-offline: per-request timeouts, one retry, consecutive UI gate.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");

const source = fs.readFileSync(
  path.join(__dirname, "../lib/backend-health.ts"),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

function load(fetchImpl, apiUrl = "https://offline-mini.invalid") {
  const context = {
    exports: {},
    require,
    process: { env: { NEXT_PUBLIC_API_URL: apiUrl } },
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: fetchImpl,
  };
  vm.runInNewContext(code, context);
  return context.exports;
}

async function runTransport(transport) {
  const calls = [];
  const { checkBackendHealth } = load(async (url) => {
    calls.push(url);
    if (url === "/api/queue/health") {
      return { ok: true, json: async () => ({ transport }) };
    }
    throw new Error("Mini offline");
  });
  return { result: await checkBackendHealth(), calls };
}

(async () => {
  const paid = await runTransport("storage");
  assert.equal(paid.result, "up");
  assert.equal(paid.calls.length, 1);

  const free = await runTransport("mini");
  assert.equal(free.result, "down");
  // One retry → two full probes (queue + Mini each time).
  assert.equal(free.calls.length, 4);
  assert.equal(
    free.calls.filter((u) => u === "/api/queue/health").length,
    2,
  );

  // Per-request budgets: a slow Mini after a quick queue check must still succeed.
  let miniHits = 0;
  const { checkBackendHealth: checkSlow } = load(async (url) => {
    if (url === "/api/queue/health") {
      return { ok: true, json: async () => ({ transport: "mini" }) };
    }
    miniHits += 1;
    await new Promise((r) => setTimeout(r, 4500));
    return { ok: true };
  });
  assert.equal(await checkSlow(), "up");
  assert.equal(miniHits, 1);

  // Retry recovers when the first Mini probe fails.
  let miniAttempts = 0;
  const { checkBackendHealth: checkRetry } = load(async (url) => {
    if (url === "/api/queue/health") {
      return { ok: true, json: async () => ({ transport: "mini" }) };
    }
    miniAttempts += 1;
    if (miniAttempts === 1) throw new Error("transient");
    return { ok: true };
  });
  assert.equal(await checkRetry(), "up");
  assert.equal(miniAttempts, 2);

  const {
    reduceBackendHealth,
    CONSECUTIVE_FAILURES_TO_MARK_DOWN,
  } = load(async () => {
    throw new Error("unused");
  });
  assert.equal(CONSECUTIVE_FAILURES_TO_MARK_DOWN, 2);

  let state = reduceBackendHealth("unknown", 0, "down");
  assert.equal(state.health, "unknown");
  assert.equal(state.consecutiveFailures, 1);

  state = reduceBackendHealth(state.health, state.consecutiveFailures, "down");
  assert.equal(state.health, "down");
  assert.equal(state.consecutiveFailures, 2);

  state = reduceBackendHealth("up", 0, "down");
  assert.equal(state.health, "up", "single failure must not disable dropzone");
  state = reduceBackendHealth(state.health, state.consecutiveFailures, "up");
  assert.equal(state.health, "up");
  assert.equal(state.consecutiveFailures, 0);

  console.log(
    "PASS: paid path, Free Mini dependency, per-request timeout, retry, consecutive UI gate",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
