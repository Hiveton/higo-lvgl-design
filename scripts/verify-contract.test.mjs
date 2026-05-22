import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const scripts = pkg.scripts ?? {};

assert.equal(typeof scripts.verify, "string", "package.json must define scripts.verify");
assert.equal(typeof scripts["verify:native"], "string", "package.json must define scripts.verify:native");
assert.ok(
  !scripts.verify.includes("wasm:check") && !scripts.verify.includes("wasm:smoke") && !scripts.verify.includes("wasm:build"),
  "npm run verify should not require the optional native WASM toolchain"
);
assert.match(
  scripts["verify:native"],
  /wasm:check.*wasm:build.*wasm:smoke/,
  "npm run verify:native must check, build, then smoke-test the real WASM runtime"
);

console.log("verify script contract ok");
