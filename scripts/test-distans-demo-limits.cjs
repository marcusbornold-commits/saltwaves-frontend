// Distans demo limit constants + English error copy.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ts = require("typescript");

const limitsSource = fs.readFileSync(
  path.join(__dirname, "../lib/distans-demo-limits.ts"),
  "utf8",
);
const accessSource = fs.readFileSync(
  path.join(__dirname, "../lib/access-limits.ts"),
  "utf8",
);

function loadModule(source) {
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const context = {
    exports: module.exports,
    module,
    require: (id) => {
      if (id === "@/lib/access-limits") return accessExports;
      throw new Error(`unexpected require: ${id}`);
    },
  };
  vm.runInNewContext(code, context);
  return context.module.exports;
}

const accessCode = ts.transpileModule(accessSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const accessModule = { exports: {} };
vm.runInNewContext(accessCode, {
  exports: accessModule.exports,
  module: accessModule,
  require,
});
const accessExports = accessModule.exports;

const {
  DISTANS_DEMO_ACCESS,
  distansDemoFileSizeError,
  distansDemoDurationError,
  distansDemoMaxSizeLabel,
} = loadModule(limitsSource);

const { exceedsFileSize, exceedsDuration, maxFileSizeBytes } = accessExports;

assert.equal(DISTANS_DEMO_ACCESS.maxFileSizeMB, 1024);
assert.equal(DISTANS_DEMO_ACCESS.maxDurationMinutes, 60);
assert.equal(distansDemoMaxSizeLabel(), "1 GB");
assert.equal(maxFileSizeBytes(DISTANS_DEMO_ACCESS), 1024 * 1024 * 1024);

assert.equal(exceedsFileSize(DISTANS_DEMO_ACCESS, 1024 * 1024 * 1024), false);
assert.equal(
  exceedsFileSize(DISTANS_DEMO_ACCESS, 1024 * 1024 * 1024 + 1),
  true,
);
assert.equal(exceedsDuration(DISTANS_DEMO_ACCESS, 3600), false);
assert.equal(exceedsDuration(DISTANS_DEMO_ACCESS, 3601), true);

assert.match(
  distansDemoFileSizeError(1500 * 1024 * 1024),
  /1\.5 GB.*1 GB/,
);
assert.match(distansDemoDurationError(4000), /67 minutes.*1 hour/);

// Old 2 GB ceiling must no longer be accepted as within limit.
assert.equal(
  exceedsFileSize(DISTANS_DEMO_ACCESS, 2048 * 1024 * 1024),
  true,
);

console.log("PASS: Distans demo limits are 1024 MB / 60 minutes");
