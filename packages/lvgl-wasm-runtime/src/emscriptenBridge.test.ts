import { createDefaultProjectDoc } from "@hiveton-lvgl/schema";
import { describe, expect, it, vi } from "vitest";
import { createEmscriptenLvglBridge } from "./emscriptenBridge";

describe("Emscripten LVGL bridge", () => {
  it("calls the native runtime ABI with ProjectDoc JSON", () => {
    const memory = new Map<number, string>();
    let nextPointer = 100;
    const native = {
      cwrap: vi.fn((name: string) => {
        switch (name) {
          case "lvgl_editor_init":
          case "lvgl_editor_render_project_json":
            return vi.fn(() => 0);
          case "lvgl_editor_resize":
          case "lvgl_editor_destroy":
            return vi.fn(() => undefined);
          case "lvgl_editor_last_screen_name":
            return vi.fn(() => 200);
          case "lvgl_editor_last_widget_names":
            return vi.fn(() => 300);
          case "lvgl_editor_framebuffer_rgba":
            return vi.fn(() => 0);
          case "lvgl_editor_framebuffer_width":
          case "lvgl_editor_framebuffer_height":
            return vi.fn(() => 0);
          default:
            throw new Error(`unknown cwrap: ${name}`);
        }
      }),
      HEAPU8: new Uint8Array(),
      UTF8ToString: vi.fn((pointer: number) => {
        if (pointer === 200) {
          return "Screen_1";
        }
        if (pointer === 300) {
          return "Time_Label,Start_Button";
        }
        return memory.get(pointer) ?? "";
      }),
      stringToUTF8: vi.fn((value: string, pointer: number) => {
        memory.set(pointer, value);
      }),
      lengthBytesUTF8: vi.fn((value: string) => value.length),
      _malloc: vi.fn((size: number) => {
        nextPointer += size;
        return nextPointer;
      }),
      _free: vi.fn()
    };
    const bridge = createEmscriptenLvglBridge(native);
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Native UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });

    bridge.mount?.(document.createElement("canvas"));
    bridge.resize?.(320, 240);
    bridge.renderProject?.(doc);
    bridge.destroy?.();

    expect(native.cwrap).toHaveBeenCalledWith("lvgl_editor_render_project_json", "number", ["number"]);
    expect(native.stringToUTF8).toHaveBeenCalledWith(JSON.stringify(doc), expect.any(Number), expect.any(Number));
    expect(native._free).toHaveBeenCalledWith(expect.any(Number));
    expect(bridge.getLastRenderedScreenName?.()).toBe("Screen_1");
    expect(bridge.getLastRenderedWidgetNames?.()).toEqual(["Time_Label", "Start_Button"]);
  });

  it("blits the native RGBA framebuffer into the mounted canvas", () => {
    const heap = new Uint8Array(128);
    heap.set([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255], 16);
    const putImageData = vi.fn();
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue({ putImageData } as unknown as CanvasRenderingContext2D);
    const originalImageData = globalThis.ImageData;
    class TestImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;

      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data;
        this.width = width;
        this.height = height;
      }
    }
    vi.stubGlobal("ImageData", TestImageData);
    const native = {
      cwrap: vi.fn((name: string) => {
        switch (name) {
          case "lvgl_editor_init":
          case "lvgl_editor_render_project_json":
            return vi.fn(() => 0);
          case "lvgl_editor_resize":
          case "lvgl_editor_destroy":
            return vi.fn(() => undefined);
          case "lvgl_editor_last_screen_name":
          case "lvgl_editor_last_widget_names":
            return vi.fn(() => 0);
          case "lvgl_editor_framebuffer_rgba":
            return vi.fn(() => 16);
          case "lvgl_editor_framebuffer_width":
          case "lvgl_editor_framebuffer_height":
            return vi.fn(() => 2);
          default:
            throw new Error(`unknown cwrap: ${name}`);
        }
      }),
      HEAPU8: heap,
      UTF8ToString: vi.fn(() => ""),
      stringToUTF8: vi.fn(),
      lengthBytesUTF8: vi.fn((value: string) => value.length),
      _malloc: vi.fn(() => 100),
      _free: vi.fn()
    };
    const bridge = createEmscriptenLvglBridge(native);

    bridge.mount?.(canvas);
    bridge.renderProject?.(createDefaultProjectDoc({
      id: "project-1",
      name: "Framebuffer UI",
      updatedAt: "2026-05-08T00:00:00Z"
    }));

    expect(canvas.width).toBe(2);
    expect(canvas.height).toBe(2);
    expect(putImageData).toHaveBeenCalledWith(expect.objectContaining({
      data: new Uint8ClampedArray(heap.slice(16, 32)),
      width: 2,
      height: 2
    }), 0, 0);
    vi.stubGlobal("ImageData", originalImageData);
  });

  it("throws when native render reports a non-zero status", () => {
    const native = {
      cwrap: vi.fn((name: string) => {
        if (name === "lvgl_editor_render_project_json") {
          return vi.fn(() => -1);
        }
        if (name === "lvgl_editor_last_screen_name" || name === "lvgl_editor_last_widget_names") {
          return vi.fn(() => 0);
        }
        if (name === "lvgl_editor_framebuffer_rgba" || name === "lvgl_editor_framebuffer_width" || name === "lvgl_editor_framebuffer_height") {
          return vi.fn(() => 0);
        }
        return vi.fn(() => 0);
      }),
      HEAPU8: new Uint8Array(),
      UTF8ToString: vi.fn(() => ""),
      stringToUTF8: vi.fn(),
      lengthBytesUTF8: vi.fn((value: string) => value.length),
      _malloc: vi.fn(() => 100),
      _free: vi.fn()
    };
    const bridge = createEmscriptenLvglBridge(native);

    expect(() => bridge.renderProject?.(createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Native UI",
      updatedAt: "2026-05-08T00:00:00Z"
    }))).toThrow("LVGL render failed with code -1");
    expect(native._free).toHaveBeenCalledWith(100);
  });
});
