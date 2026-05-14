import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"]
  }
});
