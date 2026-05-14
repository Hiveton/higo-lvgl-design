import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("vite config", () => {
  it("proxies API calls to the Go backend during local development", () => {
    const source = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");

    expect(source).toContain('"/api"');
    expect(source).toContain('"http://127.0.0.1:8080"');
    expect(source).toContain("changeOrigin: true");
  });
});
