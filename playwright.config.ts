import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: "http://127.0.0.1:5191",
    trace: "on-first-retry"
  },
  webServer: {
    command: "VITE_LVGL_WASM_MODULE_URL=/src/runtime/lvgl-editor-runtime.js npm run dev -w @hiveton-lvgl/web -- --host 127.0.0.1 --port 5191",
    url: "http://127.0.0.1:5191",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ]
});
