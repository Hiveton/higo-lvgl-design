import { spawnSync } from "node:child_process";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeDir = resolve(packageDir, "native");
const vendorDir = resolve(packageDir, ".cache", "lvgl");
const buildDir = resolve(packageDir, ".cache", "build");
const outputDir = resolve(packageDir, "dist", "wasm");
const webRuntimeDir = resolve(packageDir, "..", "..", "apps", "web", "public", "runtime");
const webSourceRuntimeDir = resolve(packageDir, "..", "..", "apps", "web", "src", "runtime");
const lvglTag = process.env.LVGL_TAG || "v8.3.11";
const lvglDir = process.env.LVGL_DIR ? resolve(process.env.LVGL_DIR) : vendorDir;

run("node", [resolve(packageDir, "scripts", "check-native-toolchain.mjs")]);

if (!existsSync(lvglDir)) {
  await mkdir(dirname(lvglDir), { recursive: true });
  run("git", ["clone", "--depth", "1", "--branch", lvglTag, "https://github.com/lvgl/lvgl.git", lvglDir]);
}

await rm(buildDir, { recursive: true, force: true });
await mkdir(buildDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

run("emcmake", [
  "cmake",
  "-S",
  nativeDir,
  "-B",
  buildDir,
  `-DLVGL_DIR=${lvglDir}`,
  `-DCMAKE_RUNTIME_OUTPUT_DIRECTORY=${outputDir}`
]);
run("cmake", ["--build", buildDir, "--target", "lvgl-editor-runtime"]);
await copyRuntimeArtifacts();

console.log(`LVGL WASM runtime written to ${outputDir}`);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: packageDir
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function copyRuntimeArtifacts() {
  await copyRuntimeArtifactPair(webRuntimeDir);
  await copyRuntimeArtifactPair(webSourceRuntimeDir);
  console.log(`LVGL WASM runtime copied to ${webRuntimeDir}`);
  console.log(`LVGL WASM runtime copied to ${webSourceRuntimeDir}`);
}

async function copyRuntimeArtifactPair(targetDir) {
  await mkdir(targetDir, { recursive: true });
  await copyFile(
    resolve(outputDir, "lvgl-editor-runtime.js"),
    resolve(targetDir, "lvgl-editor-runtime.js")
  );
  await copyFile(
    resolve(outputDir, "lvgl-editor-runtime.wasm"),
    resolve(targetDir, "lvgl-editor-runtime.wasm")
  );
}
