import { spawnSync } from "node:child_process";

const required = ["emcc", "emcmake", "cmake", "git"];
const missing = required.filter((command) => !commandExists(command));

if (missing.length > 0) {
  console.error(`Missing native LVGL WASM toolchain command(s): ${missing.join(", ")}`);
  console.error("Install Emscripten before building the real runtime, for example with Homebrew: brew install emscripten");
  process.exit(1);
}

console.log("LVGL WASM native toolchain is available.");

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    stdio: "ignore"
  });
  return result.status === 0;
}
