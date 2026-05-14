import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";
import { useAssetsStore } from "./stores/assets";
import { useProjectStore } from "./stores/project";

function restoredProjectDoc() {
  return {
    schemaVersion: 1,
    id: "project-restored",
    name: "Restored UI",
    target: { lvglVersion: "8.3", deviceName: "ESP32-S3", width: 480, height: 480, dpi: 240, colorDepth: 16 },
    theme: "dark",
    screens: [{
      id: "screen-1",
      name: "Screen_1",
      root: {
        id: "root-screen-1",
        type: "screen",
        name: "Screen_1",
        parentId: null,
        children: [],
        layout: { x: 0, y: 0, width: 480, height: 480 },
        props: {},
        style: {},
        locked: false,
        hidden: false
      }
    }],
    assets: [{
      id: "asset-1",
      projectId: "project-restored",
      name: "icon.png",
      kind: "image",
      mimeType: "image/png",
      width: 1,
      height: 1,
      sizeBytes: 70,
      objectKey: "projects/project-restored/assets/asset-1/icon.png",
      createdAt: "2026-05-08T00:00:00Z"
    }],
    styles: [],
    events: [],
    updatedAt: "2026-05-08T00:00:00Z"
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("restores the last cloud project and loads its assets after session restore", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve(new Response(JSON.stringify({ id: "user-1", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }), { status: 200 }));
      }
      if (url === "/api/projects/project-restored") {
        return Promise.resolve(new Response(JSON.stringify({ project: { id: "project-restored", name: "Restored UI", doc: restoredProjectDoc() } }), { status: 200 }));
      }
      if (url === "/api/projects/project-restored/assets") {
        return Promise.resolve(new Response(JSON.stringify({ assets: restoredProjectDoc().assets }), { status: 200 }));
      }
      if (url === "/api/projects/project-restored/assets/asset-1/content") {
        return Promise.resolve(new Response(new Blob(["png"], { type: "image/png" }), { status: 200 }));
      }
      return Promise.reject(new Error(`unexpected request ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn().mockReturnValue("blob:icon") });
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key))
    });
    globalThis.localStorage.setItem("lvgl-editor-token", "demo-token");
    globalThis.localStorage.setItem("lvgl-editor-last-project-id", "project-restored");
    const pinia = createPinia();

    mount(App, {
      global: {
        plugins: [pinia],
        stubs: { RouterView: true }
      }
    });
    await flushPromises();
    await flushPromises();

    const projectStore = useProjectStore(pinia);
    const assetsStore = useAssetsStore(pinia);
    expect(projectStore.project.id).toBe("project-restored");
    expect(assetsStore.assets.map((asset) => asset.name)).toEqual(["icon.png"]);
    expect(assetsStore.previewUrls["asset-1"]).toBe("blob:icon");
  });

  it("does not load cloud assets for the seeded local project when no last project exists", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/auth/me") {
        return Promise.resolve(new Response(JSON.stringify({ id: "user-1", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }), { status: 200 }));
      }
      return Promise.reject(new Error(`unexpected request ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
      removeItem: vi.fn((key: string) => storage.delete(key))
    });
    globalThis.localStorage.setItem("lvgl-editor-token", "demo-token");
    const pinia = createPinia();

    mount(App, {
      global: {
        plugins: [pinia],
        stubs: { RouterView: true }
      }
    });
    await flushPromises();
    await flushPromises();

    const projectStore = useProjectStore(pinia);
    const assetsStore = useAssetsStore(pinia);
    expect(projectStore.project.id).toBe("project-watch-demo");
    expect(assetsStore.assets).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/me", expect.any(Object));
  });
});
