import type { ProjectDoc } from "@hiveton-lvgl/schema";
import type { LvglWasmBridge } from "./index";

export type EmscriptenRuntimeModule = {
  cwrap(name: string, returnType: string | null, argTypes: string[]): (...args: unknown[]) => unknown;
  HEAPU8?: Uint8Array;
  UTF8ToString(pointer: number): string;
  stringToUTF8(value: string, pointer: number, maxBytes: number): void;
  lengthBytesUTF8(value: string): number;
  _malloc(size: number): number;
  _free(pointer: number): void;
};

export function createEmscriptenLvglBridge(module: EmscriptenRuntimeModule): LvglWasmBridge {
  const init = module.cwrap("lvgl_editor_init", "number", ["number", "number"]);
  const resize = module.cwrap("lvgl_editor_resize", null, ["number", "number"]);
  const renderProjectJson = module.cwrap("lvgl_editor_render_project_json", "number", ["number"]);
  const destroy = module.cwrap("lvgl_editor_destroy", null, []);
  const lastScreenName = module.cwrap("lvgl_editor_last_screen_name", "number", []);
  const lastWidgetNames = module.cwrap("lvgl_editor_last_widget_names", "number", []);
  const framebufferRgba = module.cwrap("lvgl_editor_framebuffer_rgba", "number", []);
  const framebufferWidth = module.cwrap("lvgl_editor_framebuffer_width", "number", []);
  const framebufferHeight = module.cwrap("lvgl_editor_framebuffer_height", "number", []);
  let mountedCanvas: HTMLCanvasElement | null = null;

  return {
    mount(canvas: HTMLCanvasElement) {
      mountedCanvas = canvas;
      const width = canvas.width || 480;
      const height = canvas.height || 480;
      const result = init(width, height);
      if (result !== 0) {
        throw new Error(`LVGL runtime init failed with code ${result}`);
      }
    },
    resize(width: number, height: number) {
      resize(width, height);
    },
    renderProject(doc: ProjectDoc) {
      const json = JSON.stringify(doc);
      const bytes = module.lengthBytesUTF8(json) + 1;
      const pointer = module._malloc(bytes);
      try {
        module.stringToUTF8(json, pointer, bytes);
        const result = renderProjectJson(pointer);
        if (result !== 0) {
          throw new Error(`LVGL render failed with code ${result}`);
        }
        blitFramebufferToCanvas(module, mountedCanvas, framebufferRgba, framebufferWidth, framebufferHeight);
      } finally {
        module._free(pointer);
      }
    },
    destroy() {
      destroy();
    },
    getLastRenderedScreenName() {
      return module.UTF8ToString(lastScreenName() as number) || null;
    },
    getLastRenderedWidgetNames() {
      const raw = module.UTF8ToString(lastWidgetNames() as number);
      return raw ? raw.split(",").filter(Boolean) : [];
    }
  };
}

function blitFramebufferToCanvas(
  module: EmscriptenRuntimeModule,
  canvas: HTMLCanvasElement | null,
  framebufferRgba: () => unknown,
  framebufferWidth: () => unknown,
  framebufferHeight: () => unknown
): void {
  if (!canvas || !module.HEAPU8 || typeof ImageData === "undefined") {
    return;
  }
  const pointer = framebufferRgba();
  const width = framebufferWidth();
  const height = framebufferHeight();
  if (typeof pointer !== "number" || typeof width !== "number" || typeof height !== "number" || pointer <= 0 || width <= 0 || height <= 0) {
    return;
  }
  const byteLength = width * height * 4;
  const pixels = module.HEAPU8.slice(pointer, pointer + byteLength);
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  canvas.width = width;
  canvas.height = height;
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
}
