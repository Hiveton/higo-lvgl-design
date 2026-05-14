import { existsSync } from "node:fs";
import { resolve } from "node:path";

const packageDir = resolve(import.meta.dirname, "..");
const jsPath = resolve(packageDir, "dist", "wasm", "lvgl-editor-runtime.js");
const wasmPath = resolve(packageDir, "dist", "wasm", "lvgl-editor-runtime.wasm");

if (!existsSync(jsPath) || !existsSync(wasmPath)) {
  console.error("LVGL WASM runtime artifacts are missing. Run npm run wasm:build first.");
  process.exit(1);
}

const { default: createModule } = await import(jsPath);
const mod = await createModule({
  locateFile: (path) => path.endsWith(".wasm") ? wasmPath : path
});

const init = mod.cwrap("lvgl_editor_init", "number", ["number", "number"]);
const renderProjectJson = mod.cwrap("lvgl_editor_render_project_json", "number", ["number"]);
const lastScreenName = mod.cwrap("lvgl_editor_last_screen_name", "number", []);
const lastWidgetNames = mod.cwrap("lvgl_editor_last_widget_names", "number", []);
const lastWidgetParentNames = mod.cwrap("lvgl_editor_last_widget_parent_names", "number", []);
const framebufferRgba = mod.cwrap("lvgl_editor_framebuffer_rgba", "number", []);
const framebufferWidth = mod.cwrap("lvgl_editor_framebuffer_width", "number", []);
const framebufferHeight = mod.cwrap("lvgl_editor_framebuffer_height", "number", []);
const destroy = mod.cwrap("lvgl_editor_destroy", null, []);

const doc = {
  schemaVersion: 1,
  id: "native-runtime-smoke",
  name: "Runtime Smoke",
  target: { lvglVersion: "8.3", deviceName: "Watch 480", width: 480, height: 480, dpi: 240, colorDepth: 16 },
  theme: "dark",
  screens: [
    {
      id: "screen-1",
      name: "Screen_1",
      root: {
        id: "root-screen-1",
        type: "screen",
        name: "Screen_1",
        parentId: null,
        children: [
          {
            id: "label-1",
            type: "label",
            name: "Label_1",
            parentId: "root-screen-1",
            children: [],
            layout: { x: 10, y: 20, width: 120, height: 40 },
            props: { text: "Hello" },
            style: {},
            locked: false,
            hidden: false
          },
          {
            id: "panel-1",
            type: "container",
            name: "Panel_1",
            parentId: "root-screen-1",
            children: [
              {
                id: "nested-label-1",
                type: "label",
                name: "Nested_Label",
                parentId: "panel-1",
                children: [],
                layout: { x: 8, y: 8, width: 120, height: 28 },
                props: { text: "Inside" },
                style: { textColor: "#00A3FF" },
                locked: false,
                hidden: false
              }
            ],
            layout: { x: 180, y: 20, width: 180, height: 88 },
            props: {},
            style: { bgColor: "#1E293B", borderColor: "#2563EB", radius: 8, opacity: 92 },
            locked: false,
            hidden: false
          },
          {
            id: "button-1",
            type: "button",
            name: "Button_1",
            parentId: "root-screen-1",
            children: [],
            layout: { x: 10, y: 80, width: 120, height: 48 },
            props: { text: "Start" },
            style: {},
            locked: false,
            hidden: false
          },
          {
            id: "slider-1",
            type: "slider",
            name: "Slider_1",
            parentId: "root-screen-1",
            children: [],
            layout: { x: 10, y: 150, width: 160, height: 32 },
            props: { min: 0, max: 100, value: 42 },
            style: {},
            locked: false,
            hidden: false
          },
          {
            id: "dropdown-1",
            type: "dropdown",
            name: "Mode_Dropdown",
            parentId: "root-screen-1",
            children: [],
            layout: { x: 10, y: 200, width: 160, height: 36 },
            props: { options: "Auto\nManual\nOff", selected: 1 },
            style: {},
            locked: false,
            hidden: false
          },
          {
            id: "chart-1",
            type: "chart",
            name: "Chart_1",
            parentId: "root-screen-1",
            children: [],
            layout: { x: 190, y: 140, width: 160, height: 96 },
            props: { min: 0, max: 100, pointCount: 3, values: [10, 40, 90] },
            style: {},
            locked: false,
            hidden: false
          },
          {
            id: "hidden-label-1",
            type: "label",
            name: "Hidden_Label",
            parentId: "root-screen-1",
            children: [],
            layout: { x: 10, y: 250, width: 120, height: 32 },
            props: { text: "Hidden" },
            style: {},
            locked: false,
            hidden: true
          }
        ],
        layout: { x: 0, y: 0, width: 480, height: 480 },
        props: {},
        style: {},
        locked: false,
        hidden: false
      }
    }
  ],
  assets: [],
  styles: [],
  events: [],
  updatedAt: "2026-05-08T00:00:00.000Z"
};

const json = JSON.stringify(doc);
const bytes = mod.lengthBytesUTF8(json) + 1;
const pointer = mod._malloc(bytes);

try {
  mod.stringToUTF8(json, pointer, bytes);
  const initResult = init(480, 480);
  const renderResult = renderProjectJson(pointer);
  const screen = mod.UTF8ToString(lastScreenName());
  const widgets = mod.UTF8ToString(lastWidgetNames());
  const widgetParents = mod.UTF8ToString(lastWidgetParentNames());
  const framebufferPointer = framebufferRgba();
  const width = framebufferWidth();
  const height = framebufferHeight();
  const alphaSample = framebufferPointer > 0 ? mod.HEAPU8[framebufferPointer + 3] : 0;

  const expectedWidgets = "Label_1,Panel_1,Nested_Label,Button_1,Slider_1,Mode_Dropdown,Chart_1";
  const expectedParents = "Label_1:Screen_1,Panel_1:Screen_1,Nested_Label:Panel_1,Button_1:Screen_1,Slider_1:Screen_1,Mode_Dropdown:Screen_1,Chart_1:Screen_1";

  if (
    initResult !== 0 ||
    renderResult !== 0 ||
    screen !== "Screen_1" ||
    widgets !== expectedWidgets ||
    widgetParents !== expectedParents ||
    framebufferPointer <= 0 ||
    width !== 480 ||
    height !== 480 ||
    alphaSample === 0
  ) {
    console.error(JSON.stringify({ initResult, renderResult, screen, widgets, widgetParents, framebufferPointer, width, height, alphaSample }));
    process.exit(1);
  }

  console.log(JSON.stringify({ initResult, renderResult, screen, widgets, widgetParents, framebufferPointer, width, height, alphaSample }));
} finally {
  mod._free(pointer);
  destroy();
}
