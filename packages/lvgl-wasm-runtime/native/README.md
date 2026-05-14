# LVGL WASM Native Runtime

This directory contains the native Emscripten build entry for the browser LVGL runtime.

## Requirements

- Emscripten: `emcc` and `emcmake`
- CMake
- Git

On macOS with Homebrew:

```bash
brew install emscripten
```

## Build

From the repository root:

```bash
npm run wasm:check
npm run wasm:build
```

`npm run wasm:build` uses LVGL `v8.3.11` by default and writes artifacts to:

```txt
packages/lvgl-wasm-runtime/dist/wasm/lvgl-editor-runtime.js
packages/lvgl-wasm-runtime/dist/wasm/lvgl-editor-runtime.wasm
```

To use an existing LVGL checkout:

```bash
LVGL_DIR=/absolute/path/to/lvgl npm run wasm:build
```

To choose another LVGL 8.3 patch tag:

```bash
LVGL_TAG=v8.3.9 npm run wasm:build
```

The JavaScript wrapper for this ABI is `createEmscriptenLvglBridge()` in `src/emscriptenBridge.ts`.
