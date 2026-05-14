import type { ProjectDoc, WidgetNode } from "@hiveton-lvgl/schema";
import { createEmscriptenLvglBridge, type EmscriptenRuntimeModule } from "./emscriptenBridge";
export { createEmscriptenLvglBridge };

export type LvglRuntime = {
  mount(canvas: HTMLCanvasElement): Promise<void>;
  renderProject(doc: ProjectDoc): Promise<void>;
  resize(width: number, height: number): void;
  destroy(): void;
  getLastRenderedScreenName(): string | null;
  getLastRenderedWidgetNames(): string[];
};

export type LvglRuntimeModule = {
  createLvglRuntime?: () => LvglRuntime | Promise<LvglRuntime>;
  loadRuntime?: () => LvglRuntime | Promise<LvglRuntime>;
  createLvglWasmBridge?: () => LvglWasmBridge | Promise<LvglWasmBridge>;
  default?: (() => LvglRuntime | LvglWasmBridge | EmscriptenRuntimeModule | Promise<LvglRuntime | LvglWasmBridge | EmscriptenRuntimeModule>) | LvglRuntime;
};

export type LvglWasmBridge = {
  init?: (canvas: HTMLCanvasElement) => void | Promise<void>;
  mount?: (canvas: HTMLCanvasElement) => void | Promise<void>;
  renderProjectJson?: (docJson: string) => void | Promise<void>;
  renderProject?: (doc: ProjectDoc) => void | Promise<void>;
  resize?: (width: number, height: number) => void;
  destroy?: () => void;
  getLastRenderedScreenName?: () => string | null;
  getLastRenderedWidgetNames?: () => string[];
};

type WidgetBounds = {
  widget: WidgetNode;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LoadRuntimeOptions = {
  bridge?: LvglRuntime;
  wasmModuleUrl?: string;
  fallbackToCanvas?: boolean;
  renderTimeoutMs?: number;
};

export type SimulatorErrorCode =
  | "RUNTIME_LOAD_FAILED"
  | "UNSUPPORTED_WIDGET_TYPE"
  | "MISSING_ASSET"
  | "RENDER_TIMEOUT"
  | "INTERNAL_RENDER_ERROR";

export class SimulatorRuntimeError extends Error {
  readonly code: SimulatorErrorCode;
  readonly cause?: unknown;

  constructor(code: SimulatorErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "SimulatorRuntimeError";
    this.code = code;
    this.cause = cause;
  }
}

const defaultRenderTimeoutMs = 3000;

export async function loadRuntime(options: LoadRuntimeOptions = {}): Promise<LvglRuntime> {
  if (options.bridge) {
    return withRenderTimeout(options.bridge, options.renderTimeoutMs);
  }
  if (options.wasmModuleUrl) {
    try {
      return withRenderTimeout(
        await runtimeFromModule(await import(/* @vite-ignore */ options.wasmModuleUrl) as LvglRuntimeModule),
        options.renderTimeoutMs
      );
    } catch (error) {
      if (options.fallbackToCanvas === false) {
        throw error instanceof SimulatorRuntimeError
          ? error
          : new SimulatorRuntimeError("RUNTIME_LOAD_FAILED", "Runtime load failed", error);
      }
    }
  }
  return withRenderTimeout(new CanvasPreviewRuntime(), options.renderTimeoutMs);
}

async function runtimeFromModule(module: LvglRuntimeModule): Promise<LvglRuntime> {
  if (module.createLvglRuntime) {
    return module.createLvglRuntime();
  }
  if (module.loadRuntime) {
    return module.loadRuntime();
  }
  if (module.createLvglWasmBridge) {
    return createLvglWasmRuntime(await module.createLvglWasmBridge());
  }
  if (typeof module.default === "function") {
    return runtimeFromDefaultExport(await module.default());
  }
  if (isLvglRuntime(module.default)) {
    return module.default;
  }
  throw new Error("LVGL WASM module does not export a runtime factory");
}

export function createLvglWasmRuntime(bridge: LvglWasmBridge): LvglRuntime {
  return new LvglWasmRuntimeAdapter(bridge);
}

function runtimeFromDefaultExport(value: LvglRuntime | LvglWasmBridge | EmscriptenRuntimeModule): LvglRuntime {
  if (isLvglRuntime(value)) {
    return value;
  }
  if (isEmscriptenRuntimeModule(value)) {
    return createLvglWasmRuntime(createEmscriptenLvglBridge(value));
  }
  return createLvglWasmRuntime(value as LvglWasmBridge);
}

function isLvglRuntime(value: unknown): value is LvglRuntime {
  return typeof value === "object"
    && value !== null
    && typeof (value as LvglRuntime).mount === "function"
    && typeof (value as LvglRuntime).renderProject === "function"
    && typeof (value as LvglRuntime).resize === "function"
    && typeof (value as LvglRuntime).destroy === "function"
    && typeof (value as LvglRuntime).getLastRenderedScreenName === "function"
    && typeof (value as LvglRuntime).getLastRenderedWidgetNames === "function";
}

function isEmscriptenRuntimeModule(value: unknown): value is EmscriptenRuntimeModule {
  return typeof value === "object"
    && value !== null
    && typeof (value as EmscriptenRuntimeModule).cwrap === "function"
    && typeof (value as EmscriptenRuntimeModule).UTF8ToString === "function"
    && typeof (value as EmscriptenRuntimeModule).stringToUTF8 === "function"
    && typeof (value as EmscriptenRuntimeModule).lengthBytesUTF8 === "function"
    && typeof (value as EmscriptenRuntimeModule)._malloc === "function"
    && typeof (value as EmscriptenRuntimeModule)._free === "function";
}

function withRenderTimeout(runtime: LvglRuntime, renderTimeoutMs = defaultRenderTimeoutMs): LvglRuntime {
  return new TimedRuntime(runtime, renderTimeoutMs);
}

class TimedRuntime implements LvglRuntime {
  constructor(private readonly inner: LvglRuntime, private readonly renderTimeoutMs: number) {}

  mount(canvas: HTMLCanvasElement): Promise<void> {
    return this.inner.mount(canvas);
  }

  async renderProject(doc: ProjectDoc): Promise<void> {
    try {
      await withTimeout(this.inner.renderProject(doc), this.renderTimeoutMs);
    } catch (error) {
      if (error instanceof SimulatorRuntimeError) {
        throw error;
      }
      throw new SimulatorRuntimeError("INTERNAL_RENDER_ERROR", error instanceof Error ? error.message : "Preview failed", error);
    }
  }

  resize(width: number, height: number): void {
    this.inner.resize(width, height);
  }

  destroy(): void {
    this.inner.destroy();
  }

  getLastRenderedScreenName(): string | null {
    return this.inner.getLastRenderedScreenName();
  }

  getLastRenderedWidgetNames(): string[] {
    return this.inner.getLastRenderedWidgetNames();
  }
}

class LvglWasmRuntimeAdapter implements LvglRuntime {
  private canvas: HTMLCanvasElement | null = null;
  private lastRenderedScreenName: string | null = null;
  private lastRenderedWidgetNames: string[] = [];
  private readonly visualRuntime = new CanvasPreviewRuntime();

  constructor(private readonly bridge: LvglWasmBridge) {}

  async mount(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;
    await this.visualRuntime.mount(canvas);
    if (this.bridge.mount) {
      await this.bridge.mount(canvas);
      return;
    }
    if (this.bridge.init) {
      await this.bridge.init(canvas);
      return;
    }
    throw new SimulatorRuntimeError("RUNTIME_LOAD_FAILED", "LVGL WASM bridge must expose mount(canvas) or init(canvas)");
  }

  async renderProject(doc: ProjectDoc): Promise<void> {
    if (!this.canvas) {
      throw new Error("runtime must be mounted before rendering");
    }
    await this.visualRuntime.renderProject(doc);
    const screen = doc.screens[0];
    this.lastRenderedScreenName = screen?.name ?? null;
    this.lastRenderedWidgetNames = screen ? collectRenderableWidgetNames(screen.root.children) : [];
    this.canvas.dataset.lvglScreen = this.lastRenderedScreenName ?? "";
    this.canvas.dataset.lvglWidgets = this.lastRenderedWidgetNames.join(",");

    if (this.bridge.renderProject) {
      await this.bridge.renderProject(doc);
      return;
    }
    if (this.bridge.renderProjectJson) {
      await this.bridge.renderProjectJson(JSON.stringify(doc));
      return;
    }
    throw new SimulatorRuntimeError("RUNTIME_LOAD_FAILED", "LVGL WASM bridge must expose renderProject(doc) or renderProjectJson(json)");
  }

  resize(width: number, height: number): void {
    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.visualRuntime.resize(width, height);
    this.bridge.resize?.(width, height);
  }

  destroy(): void {
    this.visualRuntime.destroy();
    this.bridge.destroy?.();
    this.canvas = null;
    this.lastRenderedScreenName = null;
    this.lastRenderedWidgetNames = [];
  }

  getLastRenderedScreenName(): string | null {
    return this.bridge.getLastRenderedScreenName?.() ?? this.lastRenderedScreenName;
  }

  getLastRenderedWidgetNames(): string[] {
    return this.bridge.getLastRenderedWidgetNames?.() ?? [...this.lastRenderedWidgetNames];
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new SimulatorRuntimeError("RENDER_TIMEOUT", `Render timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

class CanvasPreviewRuntime implements LvglRuntime {
  private canvas: HTMLCanvasElement | null = null;
  private lastRenderedScreenName: string | null = null;
  private lastRenderedWidgetNames: string[] = [];

  async mount(canvas: HTMLCanvasElement): Promise<void> {
    this.canvas = canvas;
  }

  async renderProject(doc: ProjectDoc): Promise<void> {
    if (!this.canvas) {
      throw new Error("runtime must be mounted before rendering");
    }

    const screen = doc.screens[0];
    this.lastRenderedScreenName = screen?.name ?? null;
    this.lastRenderedWidgetNames = screen ? collectRenderableWidgetNames(screen.root.children) : [];
    this.canvas.dataset.lvglScreen = this.lastRenderedScreenName ?? "";
    this.canvas.dataset.lvglWidgets = this.lastRenderedWidgetNames.join(",");
    const rootBounds = { x: 0, y: 0, width: doc.target.width, height: doc.target.height };
    const widgetBounds = screen ? collectRenderableWidgetBounds(screen.root, rootBounds) : [];
    this.canvas.dataset.lvglWidgetBounds = JSON.stringify(widgetBounds.map(({ widget, x, y, width, height }) => ({
      id: widget.id,
      name: widget.name,
      type: widget.type,
      x,
      y,
      width,
      height
    })));
    this.resize(doc.target.width, doc.target.height);
    validateRenderableAssets(doc);
    validateRenderableWidgetTypes(doc);

    if (isJsdom()) {
      return;
    }

    const context = this.canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.fillStyle = screen?.root.style.bgColor ?? "#101010";
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!screen) {
      context.fillStyle = "#ffffff";
      context.font = "24px sans-serif";
      context.textAlign = "center";
      context.fillText("No screen", this.canvas.width / 2, this.canvas.height / 2);
      return;
    }
    for (const bounds of resolveChildrenBounds(screen.root, rootBounds)) {
      this.drawWidget(context, doc, bounds);
    }
  }

  resize(width: number, height: number): void {
    if (!this.canvas) {
      return;
    }
    this.canvas.width = width;
    this.canvas.height = height;
  }

  destroy(): void {
    this.canvas = null;
    this.lastRenderedScreenName = null;
    this.lastRenderedWidgetNames = [];
  }

  getLastRenderedScreenName(): string | null {
    return this.lastRenderedScreenName;
  }

  getLastRenderedWidgetNames(): string[] {
    return [...this.lastRenderedWidgetNames];
  }

  private drawWidget(context: CanvasRenderingContext2D, doc: ProjectDoc, bounds: WidgetBounds): void {
    const { widget, x, y, width, height } = bounds;
    if (widget.hidden) {
      return;
    }
    context.save();
    context.globalAlpha = widget.style.opacity === undefined ? 1 : Math.max(0, Math.min(1, widget.style.opacity / 100));
    context.fillStyle = widget.style.bgColor || defaultFillFor(widget.type);
    context.strokeStyle = widget.style.borderColor || "#2f9bff";
    context.lineWidth = selectedStrokeWidth(widget.type);
    drawRoundedRect(context, x, y, width, height, widget.style.radius ?? 4);
    if (shouldFillWidget(widget.type)) {
      context.fill();
    }
    context.stroke();
    context.fillStyle = widget.style.textColor || "#ffffff";
    context.font = fontFor(widget);
    context.textAlign = canvasTextAlignFor(widget);
    context.textBaseline = "middle";
    drawWidgetContent(context, doc, widget, x, y, width, height);
    context.restore();

    for (const childBounds of resolveChildrenBounds(widget, bounds)) {
      this.drawWidget(context, doc, childBounds);
    }
  }
}

function isJsdom(): boolean {
  return globalThis.navigator?.userAgent.includes("jsdom") ?? false;
}

function validateRenderableAssets(doc: ProjectDoc): void {
  const assetIds = new Set(doc.assets.map((asset) => asset.id));
  for (const screen of doc.screens) {
    validateWidgetAssets(screen.root, assetIds);
  }
}

function validateRenderableWidgetTypes(doc: ProjectDoc): void {
  for (const screen of doc.screens) {
    validateWidgetType(screen.root);
  }
}

const supportedWidgetTypes = new Set<WidgetNode["type"]>([
  "screen",
  "container",
  "button",
  "label",
  "image",
  "arc",
  "bar",
  "line",
  "switch",
  "slider",
  "checkbox",
  "dropdown",
  "spinner",
  "chart"
]);

function validateWidgetType(widget: WidgetNode): void {
  if (!supportedWidgetTypes.has(widget.type)) {
    throw new SimulatorRuntimeError("UNSUPPORTED_WIDGET_TYPE", `Unsupported widget type: ${widget.type}`);
  }
  for (const child of widget.children) {
    validateWidgetType(child);
  }
}

function validateWidgetAssets(widget: WidgetNode, assetIds: Set<string>): void {
  const assetId = widget.props.assetId;
  if (widget.type === "image" && typeof assetId === "string" && assetId && !assetIds.has(assetId)) {
    throw new SimulatorRuntimeError("MISSING_ASSET", `Missing asset: ${assetId}`);
  }
  for (const child of widget.children) {
    validateWidgetAssets(child, assetIds);
  }
}

function collectRenderableWidgetNames(widgets: WidgetNode[]): string[] {
  return widgets.flatMap((widget) => {
    if (widget.hidden) {
      return [];
    }
    return [widget.name, ...collectRenderableWidgetNames(widget.children)];
  });
}

function collectRenderableWidgetBounds(parent: WidgetNode, parentBounds: Rect): WidgetBounds[] {
  return resolveChildrenBounds(parent, parentBounds).flatMap((bounds) => {
    if (bounds.widget.hidden) {
      return [];
    }
    return [bounds, ...collectRenderableWidgetBounds(bounds.widget, bounds)];
  });
}

function resolveChildrenBounds(parent: WidgetNode, parentBounds: Rect): WidgetBounds[] {
  if (parent.layout.flex) {
    return resolveFlexChildrenBounds(parent, parentBounds);
  }
  return parent.children.map((child) => ({
    widget: child,
    ...resolveAlignedBounds(child, parentBounds)
  }));
}

function resolveFlexChildrenBounds(parent: WidgetNode, parentBounds: Rect): WidgetBounds[] {
  const flex = parent.layout.flex;
  if (!flex) {
    return [];
  }
  const content = contentRectFor(parent, parentBounds);
  const isRow = flex.direction === "row";
  const mainLimit = isRow ? content.width : content.height;
  let cursorMain = 0;
  let cursorCross = 0;
  let lineCross = 0;

  return parent.children.map((child) => {
    const childWidth = child.layout.width;
    const childHeight = child.layout.height;
    const childMain = isRow ? childWidth : childHeight;
    const childCross = isRow ? childHeight : childWidth;
    if (flex.wrap && cursorMain > 0 && cursorMain + childMain > mainLimit) {
      cursorMain = 0;
      cursorCross += lineCross + flex.gap;
      lineCross = 0;
    }
    const x = isRow ? content.x + cursorMain : content.x + cursorCross;
    const y = isRow ? content.y + cursorCross : content.y + cursorMain;
    cursorMain += childMain + flex.gap;
    lineCross = Math.max(lineCross, childCross);
    return {
      widget: child,
      x,
      y,
      width: childWidth,
      height: childHeight
    };
  });
}

function resolveAlignedBounds(widget: WidgetNode, parentBounds: Rect): Rect {
  const { width, height } = widget.layout;
  const offsetX = widget.layout.x;
  const offsetY = widget.layout.y;
  switch (widget.layout.align) {
    case "top-right":
      return { x: parentBounds.x + parentBounds.width - width - offsetX, y: parentBounds.y + offsetY, width, height };
    case "center":
      return {
        x: parentBounds.x + (parentBounds.width - width) / 2 + offsetX,
        y: parentBounds.y + (parentBounds.height - height) / 2 + offsetY,
        width,
        height
      };
    case "bottom-left":
      return { x: parentBounds.x + offsetX, y: parentBounds.y + parentBounds.height - height - offsetY, width, height };
    case "bottom-right":
      return {
        x: parentBounds.x + parentBounds.width - width - offsetX,
        y: parentBounds.y + parentBounds.height - height - offsetY,
        width,
        height
      };
    case "top-left":
    default:
      return { x: parentBounds.x + offsetX, y: parentBounds.y + offsetY, width, height };
  }
}

function contentRectFor(widget: WidgetNode, bounds: Rect): Rect {
  const padding = widget.style.padding;
  if (!padding) {
    return bounds;
  }
  return {
    x: bounds.x + padding.left,
    y: bounds.y + padding.top,
    width: Math.max(0, bounds.width - padding.left - padding.right),
    height: Math.max(0, bounds.height - padding.top - padding.bottom)
  };
}

function defaultFillFor(type: WidgetNode["type"]): string {
  switch (type) {
    case "button":
      return "#252a2e";
    case "container":
      return "rgba(47, 155, 255, 0.08)";
    case "bar":
    case "slider":
      return "#2f9bff";
    case "switch":
      return "#2fbf71";
    case "checkbox":
    case "dropdown":
      return "#1b242c";
    default:
      return "transparent";
  }
}

function selectedStrokeWidth(type: WidgetNode["type"]): number {
  return type === "label" ? 0 : 1;
}

function shouldFillWidget(type: WidgetNode["type"]): boolean {
  return !["label", "line", "arc"].includes(type);
}

function fontFor(widget: WidgetNode): string {
  if (widget.style.font?.includes("48")) {
    return "48px sans-serif";
  }
  if (widget.type === "label") {
    return "20px sans-serif";
  }
  return "14px sans-serif";
}

function canvasTextAlignFor(widget: WidgetNode): CanvasTextAlign {
  if (widget.style.align === "left" || widget.style.align === "right" || widget.style.align === "center") {
    return widget.style.align;
  }
  return "center";
}

function textXFor(widget: WidgetNode, x: number, width: number): number {
  if (widget.style.align === "left") {
    return x + 4;
  }
  if (widget.style.align === "right") {
    return x + width - 4;
  }
  return x + width / 2;
}

function drawWidgetContent(
  context: CanvasRenderingContext2D,
  doc: ProjectDoc,
  widget: WidgetNode,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  switch (widget.type) {
    case "label":
    case "button":
    case "checkbox":
    case "dropdown":
      context.fillText(String(widget.props.text ?? widget.props.options ?? widget.name), textXFor(widget, x, width), y + height / 2, width - 8);
      break;
    case "image": {
      const asset = doc.assets.find((item) => item.id === widget.props.assetId);
      context.fillText(asset?.name ?? widget.name, textXFor(widget, x, width), y + height / 2, width - 8);
      break;
    }
    case "bar":
    case "slider": {
      const value = numericProp(widget, "value", 0);
      const min = numericProp(widget, "min", 0);
      const max = numericProp(widget, "max", 100);
      const ratio = Math.max(0, Math.min(1, (value - min) / Math.max(1, max - min)));
      context.fillStyle = "#2fbf71";
      context.fillRect(x, y, width * ratio, height);
      break;
    }
    case "arc":
      context.beginPath();
      context.arc(x + width / 2, y + height / 2, Math.max(4, Math.min(width, height) / 2 - 4), 0, Math.PI * 1.5);
      context.stroke();
      break;
    case "line":
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + width, y + height);
      context.stroke();
      break;
    case "spinner":
      context.beginPath();
      context.arc(x + width / 2, y + height / 2, Math.max(4, Math.min(width, height) / 2 - 6), 0, Math.PI * 1.4);
      context.stroke();
      break;
    case "chart":
      drawChartPreview(context, widget, x, y, width, height);
      break;
    case "switch":
      if (widget.props.checked === true) {
        context.fillStyle = "#2fbf71";
        context.beginPath();
        context.arc(x + width - height / 2, y + height / 2, Math.max(4, height / 2 - 4), 0, Math.PI * 2);
        context.fill();
      }
      break;
  }
}

function drawChartPreview(context: CanvasRenderingContext2D, widget: WidgetNode, x: number, y: number, width: number, height: number): void {
  context.strokeStyle = "#2f9bff";
  context.beginPath();
  const values = chartValues(widget);
  const min = numericProp(widget, "min", 0);
  const max = numericProp(widget, "max", 100);
  const span = Math.max(1, max - min);
  for (const [index, value] of values.entries()) {
    const ratioX = values.length <= 1 ? 0 : index / (values.length - 1);
    const ratioY = 1 - Math.max(0, Math.min(1, (value - min) / span));
    const px = x + ratioX * width;
    const py = y + ratioY * height;
    if (index === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }
  context.stroke();
}

function chartValues(widget: WidgetNode): number[] {
  const rawValues = widget.props.values;
  if (Array.isArray(rawValues)) {
    const values = rawValues.filter((value) => typeof value === "number" && Number.isFinite(value));
    if (values.length) {
      return values;
    }
  }
  const min = numericProp(widget, "min", 0);
  const max = numericProp(widget, "max", 100);
  const pointCount = Math.max(1, Math.floor(numericProp(widget, "pointCount", 8)));
  const span = Math.max(0, max - min);
  return Array.from({ length: pointCount }, (_unused, index) => min + ((index * 37 + 20) % (span + 1)));
}

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const nextRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + nextRadius, y);
  context.lineTo(x + width - nextRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  context.lineTo(x + width, y + height - nextRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
  context.lineTo(x + nextRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  context.lineTo(x, y + nextRadius);
  context.quadraticCurveTo(x, y, x + nextRadius, y);
}

function numericProp(widget: WidgetNode, key: string, fallback: number): number {
  const value = widget.props[key];
  return typeof value === "number" ? value : fallback;
}
