# WASM 模拟器

## 目标

定义浏览器内 LVGL 预览 runtime 的职责、API、触发时机、错误处理和验收标准。

## 适用范围

适用于 `packages/lvgl-wasm-runtime` 和前端 `SimulatorPanel`、Preview 模式。

## 非目标

第一版不要求在浏览器中编译用户生成的 C 代码，不要求模拟真实硬件外设，不要求云端固件编译。

## 定位

WASM simulator 是快速预览层，用于让用户在编辑过程中看到接近 LVGL 运行效果的设备输出。它不负责保存项目、不负责导出代码、不承担编辑态交互。

## Runtime API

```ts
type LvglRuntime = {
  mount(canvas: HTMLCanvasElement): Promise<void>
  renderProject(doc: ProjectDoc): Promise<void>
  resize(width: number, height: number): void
  destroy(): void
  getLastRenderedScreenName(): string | null
  getLastRenderedWidgetNames(): string[]
}
```

加载入口：

```ts
type LoadRuntimeOptions = {
  bridge?: LvglRuntime
  wasmModuleUrl?: string
  fallbackToCanvas?: boolean
  renderTimeoutMs?: number
}

async function loadRuntime(options?: LoadRuntimeOptions): Promise<LvglRuntime>
```

## 生命周期

```txt
SimulatorPanel mounted
  -> loadRuntime()
  -> runtime.mount(canvas)
  -> runtime.renderProject(currentDoc)
  -> ProjectDoc changes
  -> debounce 500ms
  -> runtime.renderProject(currentDoc)
  -> SimulatorPanel unmounted
  -> runtime.destroy()
```

## 预览触发

- ProjectDoc 修改后 debounce `500ms` 刷新 simulator。
- 点击 `Preview` 立即刷新并打开完整预览。
- 切换 screen 后立即刷新。
- 上传资源成功后，如果当前 screen 引用该资源，刷新 simulator。
- Build 不依赖 simulator 成功。

## 渲染输入

第一版 runtime 接收 `ProjectDoc`。如果底层 LVGL WASM 需要更简单的结构，runtime wrapper 内部负责转换，外部 API 不暴露内部格式。

当前实现提供两层运行时：

- `CanvasPreviewRuntime`：浏览器 Canvas fallback，用于本地开发、单元测试和真实 WASM 尚未加载时的预览。
- 可注入 `LvglRuntime` bridge：真实 LVGL WASM 模块接入后，必须实现同一套 `mount/renderProject/resize/destroy` API。`loadRuntime({ bridge })` 直接使用注入实例；`loadRuntime({ wasmModuleUrl, fallbackToCanvas: false })` 在模块加载失败时抛错；默认允许回退到 Canvas fallback。
- 低级 `LvglWasmBridge` 适配器：WASM/Emscripten 模块只要暴露 `mount(canvas)` 或 `init(canvas)`，以及 `renderProject(doc)` 或 `renderProjectJson(json)`，即可通过 `createLvglWasmRuntime(bridge)` 包装成统一 `LvglRuntime`。
- WASM 像素输出：Emscripten native runtime 的 `flush_cb` 写入 RGBA framebuffer，并导出 `lvgl_editor_framebuffer_rgba`、`lvgl_editor_framebuffer_width`、`lvgl_editor_framebuffer_height`；`createEmscriptenLvglBridge()` 在 `renderProject` 后读取 `HEAPU8`，用 `putImageData` 写回浏览器 Canvas。
- WASM 可视兜底：低级 WASM bridge 执行 native ABI 前，adapter 仍会先使用 `CanvasPreviewRuntime` 绘制同一份 `ProjectDoc`；如果 bridge 没有 native framebuffer 或浏览器没有可用 2D context，编辑器仍保留可见预览。
- `TimedRuntime` wrapper：所有 fallback、bridge 和 WASM 模块 runtime 都通过统一包装层执行 `renderProject`，默认 `3000ms` 超时，超时抛出 `RENDER_TIMEOUT`。

前端可通过环境变量接入真实 WASM 模块：

```bash
VITE_LVGL_WASM_MODULE_URL=/src/runtime/lvgl-editor-runtime.js npm run dev:web
```

该模块需要导出 `createLvglRuntime()`、`loadRuntime()` 或 `createLvglWasmBridge()` 之一，也可以直接使用 Emscripten 生成的默认 `createModule()` factory。未设置该变量时，编辑器使用 Canvas fallback；设置后如果模块加载失败，默认仍回退到 Canvas fallback，避免阻塞编辑。

native runtime 构建入口位于 `packages/lvgl-wasm-runtime/native`：

```bash
npm run wasm:check
npm run wasm:build
npm run wasm:smoke
```

`wasm:check` 校验 `emcc`、`emcmake`、`cmake` 和 `git`。`wasm:build` 默认拉取 LVGL `v8.3.11`，输出 `packages/lvgl-wasm-runtime/dist/wasm/lvgl-editor-runtime.js` 与 `.wasm`，并复制到 `apps/web/src/runtime/` 和 `apps/web/public/runtime/`。Vite dev 从 `/src/runtime/lvgl-editor-runtime.js` 动态导入真实模块；生产静态部署从 `/runtime/lvgl-editor-runtime.js` 加载 public artifact。`wasm:smoke` 在 Node 中加载同一份 artifact，调用 native ABI，断言返回 `Screen_1`、`Label_1,Panel_1,Nested_Label,Button_1,Slider_1`，并校验 `Nested_Label:Panel_1` 父子关系、RGBA framebuffer 指针、`480x480` 尺寸和非零 alpha。生成模块通过 `createEmscriptenLvglBridge()` 适配为 `LvglWasmBridge`。

转换职责：

- 找到当前 active screen。
- 按 tree 顺序创建运行时对象，容器内子控件必须使用容器对象作为 LVGL parent。
- 映射基础控件属性。
- 加载 image asset。
- 应用基础 style：`bgColor`、`textColor`、`borderColor`、`radius`、`opacity`。
- 处理 hidden 状态。

## 错误类型

```ts
type SimulatorErrorCode =
  | "RUNTIME_LOAD_FAILED"
  | "UNSUPPORTED_WIDGET_TYPE"
  | "MISSING_ASSET"
  | "RENDER_TIMEOUT"
  | "INTERNAL_RENDER_ERROR"
```

错误必须写入 Log，例如：

```txt
[error] Missing asset: icon_heart.png
```

runtime 抛出的错误使用稳定结构：

```ts
class SimulatorRuntimeError extends Error {
  code: SimulatorErrorCode
  message: string
  cause?: unknown
}
```

## 日志

正常日志：

- `Simulator loaded`
- `Rendering Screen_1`
- `Preview updated`

警告日志：

- `Unsupported style ignored: blendMode`
- `Missing optional font: lv_font_montserrat_48`

错误日志：

- `Runtime load failed`
- `Missing asset: icon_heart.png`
- `Render timeout after 3000ms`

## Preview 模式

Preview 模式隐藏编辑 chrome，仅显示设备预览和最少控制：

- 返回编辑器。
- 当前 screen 名。
- 设备尺寸。
- 刷新。
- 截图。

Preview 模式不能修改 `ProjectDoc`。

## 性能目标

- runtime 首次加载后，普通 `480x480` 项目刷新在 `300ms` 内完成。
- 单 screen 100 个 widget 内保持可交互。
- render 超过 `3000ms` 视为 timeout 并恢复 UI 控制权。

## 验收标准

- SimulatorPanel 挂载后显示当前 screen。
- 修改 label 文本后，预览在 debounce 后更新。
- 切换 screen 后，预览立即更新。
- 缺失 asset 时 Log 显示错误，不导致编辑器崩溃。
- Preview 模式打开和返回后，ProjectDoc 不发生变化。
