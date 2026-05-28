import { createDefaultProjectDoc } from "@hiveton-lvgl/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLvglWasmRuntime, loadRuntime, SimulatorRuntimeError } from "./index";

describe("lvgl wasm runtime wrapper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("mounts a canvas and renders the active project screen", async () => {
    const runtime = await loadRuntime();
    const canvas = document.createElement("canvas");
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });

    await runtime.mount(canvas);
    await runtime.renderProject(doc);

    expect(canvas.width).toBe(480);
    expect(canvas.height).toBe(480);
    expect(runtime.getRuntimeKind?.()).toBe("canvas");
    expect(runtime.getLastRenderedScreenName()).toBe("Screen_1");
    expect(canvas.dataset.lvglScreen).toBe("Screen_1");
  });

  it("resizes the mounted canvas", async () => {
    const runtime = await loadRuntime();
    const canvas = document.createElement("canvas");

    await runtime.mount(canvas);
    runtime.resize(320, 240);

    expect(canvas.width).toBe(320);
    expect(canvas.height).toBe(240);
  });

  it("can use an injected LVGL runtime bridge instead of the canvas fallback", async () => {
    const bridge = {
      mount: vi.fn(async () => undefined),
      renderProject: vi.fn(async () => undefined),
      resize: vi.fn(),
      destroy: vi.fn(),
      getLastRenderedScreenName: vi.fn(() => "Bridge_Screen"),
      getLastRenderedWidgetNames: vi.fn(() => ["Bridge_Label"])
    };

    const runtime = await loadRuntime({ bridge });
    const canvas = document.createElement("canvas");
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Bridge UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });

    await runtime.mount(canvas);
    await runtime.renderProject(doc);
    runtime.resize(240, 240);

    expect(bridge.mount).toHaveBeenCalledWith(canvas);
    expect(bridge.renderProject).toHaveBeenCalledWith(doc);
    expect(bridge.resize).toHaveBeenCalledWith(240, 240);
    expect(runtime.getLastRenderedScreenName()).toBe("Bridge_Screen");
  });

  it("adapts a low-level LVGL WASM bridge that renders ProjectDoc JSON", async () => {
    const renderProjectJson = vi.fn(async (_docJson: string) => undefined);
    const bridge = {
      init: vi.fn(async (_canvas: HTMLCanvasElement) => undefined),
      renderProjectJson,
      resize: vi.fn(),
      destroy: vi.fn()
    };
    const runtime = createLvglWasmRuntime(bridge);
    const canvas = document.createElement("canvas");
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "WASM Adapter UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });

    await runtime.mount(canvas);
    runtime.resize(320, 240);
    await runtime.renderProject(doc);

    expect(bridge.init).toHaveBeenCalledWith(canvas);
    expect(bridge.resize).toHaveBeenCalledWith(320, 240);
    expect(renderProjectJson).toHaveBeenCalledWith(JSON.stringify(doc));
    expect(runtime.getRuntimeKind?.()).toBe("wasm");
    expect(canvas.dataset.lvglScreen).toBe("Screen_1");
    expect(runtime.getLastRenderedScreenName()).toBe("Screen_1");
    runtime.destroy();
  });

  it("loads modules that expose createLvglWasmBridge", async () => {
    sessionStorage.clear();
    const moduleSource = `
      export function createLvglWasmBridge() {
        return {
          mount(canvas) {
            canvas.dataset.bridgeMounted = "true";
          },
          renderProjectJson(docJson) {
            const doc = JSON.parse(docJson);
            globalThis.sessionStorage.setItem("lvgl-wasm-bridge-last-screen", doc.screens?.[0]?.name ?? "");
          },
          resize(width, height) {
            globalThis.sessionStorage.setItem("lvgl-wasm-bridge-last-size", width + "x" + height);
          }
        };
      }
    `;
    const runtime = await loadRuntime({
      wasmModuleUrl: `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource)}`,
      fallbackToCanvas: false
    });
    const canvas = document.createElement("canvas");
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Bridge Module UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });

    await runtime.mount(canvas);
    runtime.resize(240, 240);
    await runtime.renderProject(doc);

    expect(canvas.dataset.bridgeMounted).toBe("true");
    expect(sessionStorage.getItem("lvgl-wasm-bridge-last-size")).toBe("240x240");
    expect(sessionStorage.getItem("lvgl-wasm-bridge-last-screen")).toBe("Screen_1");
  });

  it("loads Emscripten default factories and wraps the native ABI", async () => {
    const moduleSource = `
      export default async function createModule() {
        const memory = new Map();
        return {
          cwrap(name) {
            if (name === "lvgl_editor_init" || name === "lvgl_editor_render_project_json") {
              return () => 0;
            }
            if (name === "lvgl_editor_resize" || name === "lvgl_editor_destroy") {
              return () => undefined;
            }
            if (name === "lvgl_editor_last_screen_name") {
              return () => 200;
            }
            if (name === "lvgl_editor_last_widget_names") {
              return () => 300;
            }
            if (name === "lvgl_editor_framebuffer_rgba" || name === "lvgl_editor_framebuffer_width" || name === "lvgl_editor_framebuffer_height") {
              return () => 0;
            }
            throw new Error("unknown cwrap " + name);
          },
          HEAPU8: new Uint8Array(),
          UTF8ToString(pointer) {
            if (pointer === 200) return "Screen_1";
            if (pointer === 300) return "Label_1";
            return memory.get(pointer) || "";
          },
          stringToUTF8(value, pointer) {
            memory.set(pointer, value);
          },
          lengthBytesUTF8(value) {
            return value.length;
          },
          _malloc() {
            return 100;
          },
          _free() {}
        };
      }
    `;
    const runtime = await loadRuntime({
      wasmModuleUrl: `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource)}`,
      fallbackToCanvas: false
    });
    const canvas = document.createElement("canvas");

    await runtime.mount(canvas);
    await runtime.renderProject(createDefaultProjectDoc({
      id: "project-1",
      name: "Emscripten Module UI",
      updatedAt: "2026-05-08T00:00:00Z"
    }));

    expect(runtime.getLastRenderedScreenName()).toBe("Screen_1");
    expect(runtime.getLastRenderedWidgetNames()).toEqual(["Label_1"]);
  });

  it("surfaces LVGL runtime module load failures when fallback is disabled", async () => {
    await expect(loadRuntime({ wasmModuleUrl: "./missing-lvgl-runtime.js", fallbackToCanvas: false })).rejects.toThrow();
  });

  it("rejects image widgets that reference missing assets", async () => {
    const runtime = await loadRuntime();
    const canvas = document.createElement("canvas");
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Image UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "image-1",
      type: "image",
      name: "Image_1",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 0, y: 0, width: 96, height: 96 },
      props: { assetId: "missing-asset" },
      style: {},
      locked: false,
      hidden: false
    });

    await runtime.mount(canvas);

    await expect(runtime.renderProject(doc)).rejects.toMatchObject({
      code: "MISSING_ASSET",
      message: "Missing asset: missing-asset"
    });
  });

  it("draws image assets in the canvas fallback when an asset resolver provides a source", async () => {
    const drawImage = vi.fn();
    const context = {
      beginPath: vi.fn(),
      drawImage,
      fill: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      lineTo: vi.fn(),
      moveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      restore: vi.fn(),
      save: vi.fn(),
      stroke: vi.fn()
    } as unknown as CanvasRenderingContext2D;
    class TestImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = "";
      set src(_source: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("navigator", { userAgent: "Chrome" });
    vi.stubGlobal("Image", TestImage);

    const runtime = await loadRuntime({
      assetResolver: (asset) => asset.id === "asset-logo" ? "data:image/png;base64,logo" : null
    });
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(context);
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Image UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.assets = [{
      id: "asset-logo",
      projectId: doc.id,
      name: "logo.png",
      kind: "image",
      mimeType: "image/png",
      width: 16,
      height: 16,
      sizeBytes: 64,
      objectKey: "local://logo.png",
      createdAt: "2026-05-08T00:00:00Z"
    }];
    doc.screens[0].root.children = [{
      id: "image-1",
      type: "image",
      name: "Logo_Image",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 8, y: 12, width: 32, height: 24 },
      props: { assetId: "asset-logo" },
      style: {},
      locked: false,
      hidden: false
    }];

    await runtime.mount(canvas);
    await runtime.renderProject(doc);

    expect(drawImage).toHaveBeenCalledWith(expect.any(TestImage), 8, 12, 32, 24);
  });

  it("rejects unsupported widget types with a stable simulator error code", async () => {
    const runtime = await loadRuntime();
    const canvas = document.createElement("canvas");
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Unsupported UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "video-1",
      type: "video" as never,
      name: "Video_1",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 0, y: 0, width: 96, height: 96 },
      props: {},
      style: {},
      locked: false,
      hidden: false
    });

    await runtime.mount(canvas);

    await expect(runtime.renderProject(doc)).rejects.toMatchObject({
      code: "UNSUPPORTED_WIDGET_TYPE",
      message: "Unsupported widget type: video"
    });
  });

  it("rejects slow runtime bridge renders with a timeout error code", async () => {
    vi.useFakeTimers();
    const bridge = {
      mount: vi.fn(async () => undefined),
      renderProject: vi.fn(() => new Promise<void>(() => undefined)),
      resize: vi.fn(),
      destroy: vi.fn(),
      getLastRenderedScreenName: vi.fn(() => null),
      getLastRenderedWidgetNames: vi.fn(() => [])
    };
    const runtime = await loadRuntime({ bridge, renderTimeoutMs: 25 });
    await runtime.mount(document.createElement("canvas"));
    const render = runtime.renderProject(createDefaultProjectDoc({
      id: "project-1",
      name: "Slow UI",
      updatedAt: "2026-05-08T00:00:00Z"
    }));
    const rejection = render.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(25);

    const error = await rejection;
    expect(error).toBeInstanceOf(SimulatorRuntimeError);
    expect(error).toMatchObject({
      code: "RENDER_TIMEOUT",
      message: "Render timeout after 25ms"
    });
    vi.useRealTimers();
  });

  it("wraps runtime bridge render failures with a stable simulator error code", async () => {
    const bridge = {
      mount: vi.fn(async () => undefined),
      renderProject: vi.fn(async () => {
        throw new Error("bridge crashed");
      }),
      resize: vi.fn(),
      destroy: vi.fn(),
      getLastRenderedScreenName: vi.fn(() => null),
      getLastRenderedWidgetNames: vi.fn(() => [])
    };
    const runtime = await loadRuntime({ bridge });
    await runtime.mount(document.createElement("canvas"));

    await expect(runtime.renderProject(createDefaultProjectDoc({
      id: "project-1",
      name: "Crashed UI",
      updatedAt: "2026-05-08T00:00:00Z"
    }))).rejects.toMatchObject({
      code: "INTERNAL_RENDER_ERROR",
      message: "bridge crashed"
    });
  });

  it("tracks rendered nested widgets and skips hidden subtrees", async () => {
    const runtime = await loadRuntime();
    const canvas = document.createElement("canvas");
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Nested UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "container-1",
      type: "container",
      name: "Container_1",
      parentId: "root-screen-1",
      children: [
        {
          id: "label-1",
          type: "label",
          name: "Label_1",
          parentId: "container-1",
          children: [],
          layout: { x: 8, y: 8, width: 80, height: 24 },
          props: { text: "Nested" },
          style: {},
          locked: false,
          hidden: false
        },
        {
          id: "label-hidden",
          type: "label",
          name: "Hidden_Label",
          parentId: "container-1",
          children: [],
          layout: { x: 8, y: 40, width: 80, height: 24 },
          props: { text: "Hidden" },
          style: {},
          locked: false,
          hidden: true
        }
      ],
      layout: { x: 16, y: 24, width: 160, height: 120 },
      props: {},
      style: {},
      locked: false,
      hidden: false
    });

    await runtime.mount(canvas);
    await runtime.renderProject(doc);

    expect(runtime.getLastRenderedWidgetNames()).toEqual(["Container_1", "Label_1"]);
    expect(canvas.dataset.lvglWidgets).toBe("Container_1,Label_1");
  });

  it("resolves align and flex layout bounds for the canvas preview", async () => {
    const runtime = await loadRuntime();
    const canvas = document.createElement("canvas");
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Layout UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.layout.flex = { direction: "row", gap: 8, wrap: true };
    doc.screens[0].root.style.padding = { top: 10, right: 12, bottom: 10, left: 12 };
    doc.screens[0].root.children = [
      {
        id: "flex-a",
        type: "label",
        name: "Flex_A",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 99, y: 99, width: 260, height: 24, align: "bottom-right" },
        props: { text: "A" },
        style: {},
        locked: false,
        hidden: false
      },
      {
        id: "flex-b",
        type: "button",
        name: "Flex_B",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 0, width: 260, height: 40 },
        props: { text: "B" },
        style: {},
        locked: false,
        hidden: false
      },
      {
        id: "aligned-container",
        type: "container",
        name: "Aligned_Container",
        parentId: "root-screen-1",
        children: [
          {
            id: "center-child",
            type: "label",
            name: "Center_Child",
            parentId: "aligned-container",
            children: [],
            layout: { x: 4, y: 6, width: 40, height: 20, align: "center" },
            props: { text: "C" },
            style: {},
            locked: false,
            hidden: false
          }
        ],
        layout: { x: 0, y: 0, width: 120, height: 80 },
        props: {},
        style: {},
        locked: false,
        hidden: false
      }
    ];

    await runtime.mount(canvas);
    await runtime.renderProject(doc);

    const bounds = JSON.parse(canvas.dataset.lvglWidgetBounds ?? "[]") as Array<{
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    expect(bounds).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Flex_A", x: 12, y: 10, width: 260, height: 24 }),
      expect.objectContaining({ name: "Flex_B", x: 12, y: 42, width: 260, height: 40 }),
      expect.objectContaining({ name: "Aligned_Container", x: 280, y: 42, width: 120, height: 80 }),
      expect.objectContaining({ name: "Center_Child", x: 324, y: 78, width: 40, height: 20 })
    ]));
  });
});
