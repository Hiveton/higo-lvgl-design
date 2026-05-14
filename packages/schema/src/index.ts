export type WidgetType =
  | "screen"
  | "container"
  | "button"
  | "label"
  | "image"
  | "arc"
  | "bar"
  | "line"
  | "switch"
  | "slider"
  | "checkbox"
  | "dropdown"
  | "spinner"
  | "chart";

export type TargetConfig = {
  lvglVersion: "8.3";
  deviceName: string;
  width: number;
  height: number;
  dpi: number;
  colorDepth: 16 | 32;
};

export type LayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  align?: "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right";
  flex?: {
    direction: "row" | "column";
    gap: number;
    wrap: boolean;
  };
};

export type WidgetStyle = {
  opacity?: number;
  bgColor?: string;
  textColor?: string;
  borderColor?: string;
  radius?: number;
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  font?: string;
  lineSpace?: number;
  letterSpace?: number;
  align?: "left" | "center" | "right";
};

export type WidgetNode = {
  id: string;
  type: WidgetType;
  name: string;
  parentId: string | null;
  children: WidgetNode[];
  layout: LayoutBox;
  props: Record<string, WidgetPropValue>;
  style: WidgetStyle;
  locked: boolean;
  hidden: boolean;
};

export type WidgetPropValue = string | number | boolean | number[];

export type ScreenNode = {
  id: string;
  name: string;
  root: WidgetNode;
};

export type AssetRef = {
  id: string;
  projectId: string;
  name: string;
  kind: "image" | "font";
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  objectKey: string;
  createdAt: string;
};

export type StyleDef = {
  id: string;
  name: string;
  style: WidgetStyle;
};

export type EventBinding = {
  id: string;
  widgetId: string;
  event: "LV_EVENT_CLICKED" | "LV_EVENT_VALUE_CHANGED" | "LV_EVENT_READY" | "LV_EVENT_CANCEL";
  handlerName: string;
};

export type ProjectDoc = {
  schemaVersion: 1;
  id: string;
  name: string;
  target: TargetConfig;
  theme: "dark" | "light";
  screens: ScreenNode[];
  assets: AssetRef[];
  styles: StyleDef[];
  events: EventBinding[];
  updatedAt: string;
};

export type ValidationError = {
  path: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export type WidgetCatalogItem = {
  type: Exclude<WidgetType, "screen">;
  label: string;
  category: "Basic" | "Containers" | "Charts" | "Indicators" | "Inputs" | "Advanced";
  defaultSize: {
    width: number;
    height: number;
  };
};

export const projectDocJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://hiveton.dev/schemas/lvgl-online-editor/project-doc.schema.json",
  title: "ProjectDoc",
  type: "object",
  required: ["schemaVersion", "id", "name", "target", "theme", "screens", "assets", "styles", "events", "updatedAt"],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 },
    id: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    target: { $ref: "#/$defs/TargetConfig" },
    theme: { enum: ["dark", "light"] },
    screens: {
      type: "array",
      minItems: 1,
      items: { $ref: "#/$defs/ScreenNode" }
    },
    assets: {
      type: "array",
      items: { $ref: "#/$defs/AssetRef" }
    },
    styles: {
      type: "array",
      items: { $ref: "#/$defs/StyleDef" }
    },
    events: {
      type: "array",
      items: { $ref: "#/$defs/EventBinding" }
    },
    updatedAt: { type: "string", minLength: 1 }
  },
  $defs: {
    TargetConfig: {
      type: "object",
      required: ["lvglVersion", "deviceName", "width", "height", "dpi", "colorDepth"],
      additionalProperties: false,
      properties: {
        lvglVersion: { const: "8.3" },
        deviceName: { type: "string", minLength: 1 },
        width: { type: "number", exclusiveMinimum: 0 },
        height: { type: "number", exclusiveMinimum: 0 },
        dpi: { type: "number", exclusiveMinimum: 0 },
        colorDepth: { enum: [16, 32] }
      }
    },
    LayoutBox: {
      type: "object",
      required: ["x", "y", "width", "height"],
      additionalProperties: false,
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number", exclusiveMinimum: 0 },
        height: { type: "number", exclusiveMinimum: 0 },
        align: { enum: ["top-left", "top-right", "center", "bottom-left", "bottom-right"] },
        flex: { $ref: "#/$defs/FlexLayout" }
      }
    },
    FlexLayout: {
      type: "object",
      required: ["direction", "gap", "wrap"],
      additionalProperties: false,
      properties: {
        direction: { enum: ["row", "column"] },
        gap: { type: "number", minimum: 0 },
        wrap: { type: "boolean" }
      }
    },
    WidgetStyle: {
      type: "object",
      additionalProperties: false,
      properties: {
        opacity: { type: "number", minimum: 0, maximum: 100 },
        bgColor: { type: "string" },
        textColor: { type: "string" },
        borderColor: { type: "string" },
        radius: { type: "number", minimum: 0 },
        padding: { $ref: "#/$defs/PaddingBox" },
        font: { type: "string" },
        lineSpace: { type: "number" },
        letterSpace: { type: "number" },
        align: { enum: ["left", "center", "right"] }
      }
    },
    PaddingBox: {
      type: "object",
      required: ["top", "right", "bottom", "left"],
      additionalProperties: false,
      properties: {
        top: { type: "number", minimum: 0 },
        right: { type: "number", minimum: 0 },
        bottom: { type: "number", minimum: 0 },
        left: { type: "number", minimum: 0 }
      }
    },
    WidgetNode: {
      type: "object",
      required: ["id", "type", "name", "parentId", "children", "layout", "props", "style", "locked", "hidden"],
      additionalProperties: false,
      properties: {
        id: { type: "string", minLength: 1 },
        type: { enum: ["screen", "container", "button", "label", "image", "arc", "bar", "line", "switch", "slider", "checkbox", "dropdown", "spinner", "chart"] },
        name: { type: "string", minLength: 1 },
        parentId: { type: ["string", "null"] },
        children: {
          type: "array",
          items: { $ref: "#/$defs/WidgetNode" }
        },
        layout: { $ref: "#/$defs/LayoutBox" },
        props: {
          type: "object",
          additionalProperties: {
            anyOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "array", items: { type: "number" } }
            ]
          }
        },
        style: { $ref: "#/$defs/WidgetStyle" },
        locked: { type: "boolean" },
        hidden: { type: "boolean" }
      }
    },
    ScreenNode: {
      type: "object",
      required: ["id", "name", "root"],
      additionalProperties: false,
      properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        root: { $ref: "#/$defs/WidgetNode" }
      }
    },
    AssetRef: {
      type: "object",
      required: ["id", "projectId", "name", "kind", "mimeType", "sizeBytes", "objectKey", "createdAt"],
      additionalProperties: false,
      properties: {
        id: { type: "string", minLength: 1 },
        projectId: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        kind: { enum: ["image", "font"] },
        mimeType: { type: "string", minLength: 1 },
        width: { type: "number", minimum: 0 },
        height: { type: "number", minimum: 0 },
        sizeBytes: { type: "number", minimum: 0 },
        objectKey: { type: "string", minLength: 1 },
        createdAt: { type: "string", minLength: 1 }
      }
    },
    StyleDef: {
      type: "object",
      required: ["id", "name", "style"],
      additionalProperties: false,
      properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        style: { $ref: "#/$defs/WidgetStyle" }
      }
    },
    EventBinding: {
      type: "object",
      required: ["id", "widgetId", "event", "handlerName"],
      additionalProperties: false,
      properties: {
        id: { type: "string", minLength: 1 },
        widgetId: { type: "string", minLength: 1 },
        event: { enum: ["LV_EVENT_CLICKED", "LV_EVENT_VALUE_CHANGED", "LV_EVENT_READY", "LV_EVENT_CANCEL"] },
        handlerName: { type: "string", minLength: 1 }
      }
    }
  }
} as const;

export const widgetCatalog: WidgetCatalogItem[] = [
  { type: "button", label: "Button", category: "Basic", defaultSize: { width: 120, height: 44 } },
  { type: "label", label: "Label", category: "Basic", defaultSize: { width: 120, height: 32 } },
  { type: "image", label: "Image", category: "Basic", defaultSize: { width: 96, height: 96 } },
  { type: "container", label: "Container", category: "Containers", defaultSize: { width: 200, height: 160 } },
  { type: "chart", label: "Chart", category: "Charts", defaultSize: { width: 200, height: 120 } },
  { type: "arc", label: "Arc", category: "Indicators", defaultSize: { width: 120, height: 120 } },
  { type: "bar", label: "Bar", category: "Indicators", defaultSize: { width: 160, height: 20 } },
  { type: "spinner", label: "Spinner", category: "Indicators", defaultSize: { width: 64, height: 64 } },
  { type: "switch", label: "Switch", category: "Inputs", defaultSize: { width: 64, height: 32 } },
  { type: "slider", label: "Slider", category: "Inputs", defaultSize: { width: 160, height: 24 } },
  { type: "checkbox", label: "Checkbox", category: "Inputs", defaultSize: { width: 120, height: 32 } },
  { type: "dropdown", label: "Dropdown", category: "Inputs", defaultSize: { width: 160, height: 40 } },
  { type: "line", label: "Line", category: "Advanced", defaultSize: { width: 120, height: 2 } }
];

const supportedWidgetTypes = new Set<WidgetType>([
  "screen",
  ...widgetCatalog.map((widget) => widget.type)
]);

export function createDefaultProjectDoc(input: {
  id: string;
  name: string;
  updatedAt: string;
  target?: Partial<TargetConfig>;
}): ProjectDoc {
  const target: TargetConfig = {
    lvglVersion: "8.3",
    deviceName: "ESP32-S3",
    width: 480,
    height: 480,
    dpi: 240,
    colorDepth: 16,
    ...input.target
  };

  return {
    schemaVersion: 1,
    id: input.id,
    name: input.name,
    target,
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
          children: [],
          layout: { x: 0, y: 0, width: target.width, height: target.height },
          props: {},
          style: { bgColor: "#101010" },
          locked: false,
          hidden: false
        }
      }
    ],
    assets: [],
    styles: [],
    events: [],
    updatedAt: input.updatedAt
  };
}

export function getActiveScreen(doc: ProjectDoc, activeScreenId: string | null): ScreenNode | undefined {
  return doc.screens.find((screen) => screen.id === activeScreenId) ?? doc.screens[0];
}

export function validateProjectDoc(doc: ProjectDoc): ValidationResult {
  const errors: ValidationError[] = [];
  const assetIds = new Set<string>();
  const styleIds = new Set<string>();
  const widgetIds = new Set<string>();
  const screenIds = new Set<string>();

  if (!doc.id?.trim()) {
    errors.push({
      path: "id",
      message: "ProjectDoc id is required"
    });
  }
  if (!doc.name?.trim()) {
    errors.push({
      path: "name",
      message: "ProjectDoc name is required"
    });
  }
  validateTargetConfig(doc.target, errors);
  doc.assets?.forEach((asset, index) => {
    validateAssetRef(asset, `assets[${index}]`, doc.id, assetIds, errors);
  });

  if (!doc.screens || doc.screens.length === 0) {
    errors.push({
      path: "screens",
      message: "ProjectDoc must contain at least one screen"
    });
  }

  doc.screens?.forEach((screen, index) => {
    validateScreenNode(screen, `screens[${index}]`, screenIds, errors);
    if (screen.root?.type !== "screen") {
      errors.push({
        path: `screens[${index}].root.type`,
        message: "Screen root widget type must be screen"
      });
    }
    const screenNames = new Set<string>();
    const widgetIdsInScreen = new Set<string>();
    validateWidgetNode(screen.root, `screens[${index}].root`, screenNames, widgetIdsInScreen, widgetIds, assetIds, errors, null);
  });

  doc.events?.forEach((event, index) => {
    validateEventBinding(event, `events[${index}]`, widgetIds, errors);
  });

  doc.styles?.forEach((style, index) => {
    validateStyleDef(style, `styles[${index}]`, styleIds, errors);
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateTargetConfig(target: TargetConfig | undefined, errors: ValidationError[]): void {
  if (!target) {
    return;
  }
  if (target.lvglVersion !== "8.3") {
    errors.push({
      path: "target.lvglVersion",
      message: `Unsupported LVGL version: ${target.lvglVersion}`
    });
  }
  if (!target.deviceName?.trim()) {
    errors.push({
      path: "target.deviceName",
      message: "Target deviceName is required"
    });
  }
  if (target.width <= 0) {
    errors.push({
      path: "target.width",
      message: "Target width must be greater than 0"
    });
  }
  if (target.height <= 0) {
    errors.push({
      path: "target.height",
      message: "Target height must be greater than 0"
    });
  }
  if (target.dpi <= 0) {
    errors.push({
      path: "target.dpi",
      message: "Target dpi must be greater than 0"
    });
  }
  if (target.colorDepth !== 16 && target.colorDepth !== 32) {
    errors.push({
      path: "target.colorDepth",
      message: "Target colorDepth must be 16 or 32"
    });
  }
}

function validateAssetRef(
  asset: AssetRef | undefined,
  path: string,
  projectId: string,
  assetIds: Set<string>,
  errors: ValidationError[]
): void {
  if (!asset) {
    return;
  }
  if (!asset.id?.trim()) {
    errors.push({
      path: `${path}.id`,
      message: "Asset id is required"
    });
  } else if (assetIds.has(asset.id)) {
    errors.push({
      path: `${path}.id`,
      message: `Asset id must be unique: ${asset.id}`
    });
  } else {
    assetIds.add(asset.id);
  }
  if (!asset.projectId?.trim()) {
    errors.push({
      path: `${path}.projectId`,
      message: `Asset projectId is required: ${asset.id || path}`
    });
  } else if (asset.projectId !== projectId) {
    errors.push({
      path: `${path}.projectId`,
      message: `Asset projectId must match project id: ${asset.id || path}`
    });
  }
  if (!asset.name?.trim()) {
    errors.push({
      path: `${path}.name`,
      message: `Asset name is required: ${asset.id || path}`
    });
  }
  if (asset.kind !== "image" && asset.kind !== "font") {
    errors.push({
      path: `${path}.kind`,
      message: `Unsupported asset kind: ${asset.kind}`
    });
  }
  if (!asset.mimeType?.trim()) {
    errors.push({
      path: `${path}.mimeType`,
      message: `Asset mimeType is required: ${asset.id || path}`
    });
  }
  if (asset.width !== undefined && asset.width < 0) {
    errors.push({
      path: `${path}.width`,
      message: `Asset width must be non-negative: ${asset.id || path}`
    });
  }
  if (asset.height !== undefined && asset.height < 0) {
    errors.push({
      path: `${path}.height`,
      message: `Asset height must be non-negative: ${asset.id || path}`
    });
  }
  if (asset.sizeBytes < 0) {
    errors.push({
      path: `${path}.sizeBytes`,
      message: `Asset sizeBytes must be non-negative: ${asset.id || path}`
    });
  }
  if (!asset.objectKey?.trim()) {
    errors.push({
      path: `${path}.objectKey`,
      message: `Asset objectKey is required: ${asset.id || path}`
    });
  }
  if (!asset.createdAt?.trim()) {
    errors.push({
      path: `${path}.createdAt`,
      message: `Asset createdAt is required: ${asset.id || path}`
    });
  }
}

function validateScreenNode(
  screen: ScreenNode | undefined,
  path: string,
  screenIds: Set<string>,
  errors: ValidationError[]
): void {
  if (!screen) {
    return;
  }
  if (!screen.id?.trim()) {
    errors.push({
      path: `${path}.id`,
      message: "Screen id is required"
    });
  } else if (screenIds.has(screen.id)) {
    errors.push({
      path: `${path}.id`,
      message: `Screen id must be unique: ${screen.id}`
    });
  } else {
    screenIds.add(screen.id);
  }
  if (!screen.name?.trim()) {
    errors.push({
      path: `${path}.name`,
      message: `Screen name is required: ${screen.id || path}`
    });
  }
}

function validateEventBinding(
  event: EventBinding | undefined,
  path: string,
  widgetIds: Set<string>,
  errors: ValidationError[]
): void {
  if (!event) {
    return;
  }
  if (!event.id?.trim()) {
    errors.push({
      path: `${path}.id`,
      message: "Event id is required"
    });
  }
  if (!event.widgetId?.trim()) {
    errors.push({
      path: `${path}.widgetId`,
      message: `Event widgetId is required: ${event.id || path}`
    });
  } else if (!widgetIds.has(event.widgetId)) {
    errors.push({
      path: `${path}.widgetId`,
      message: `Event binding references missing widget: ${event.widgetId}`
    });
  }
  if (!["LV_EVENT_CLICKED", "LV_EVENT_VALUE_CHANGED", "LV_EVENT_READY", "LV_EVENT_CANCEL"].includes(event.event)) {
    errors.push({
      path: `${path}.event`,
      message: `Unsupported event type: ${event.event}`
    });
  }
  if (!event.handlerName?.trim()) {
    errors.push({
      path: `${path}.handlerName`,
      message: `Event handlerName is required: ${event.id || path}`
    });
  }
}

function validateWidgetNode(
  widget: WidgetNode | undefined,
  path: string,
  screenNames: Set<string>,
  screenIds: Set<string>,
  widgetIds: Set<string>,
  assetIds: Set<string>,
  errors: ValidationError[],
  expectedParentId: string | null
): void {
  if (!widget) {
    return;
  }
  if (!widget.id) {
    errors.push({
      path: `${path}.id`,
      message: "Widget id is required"
    });
  } else if (screenIds.has(widget.id)) {
    errors.push({
      path: `${path}.id`,
      message: `Widget id must be unique within a screen: ${widget.id}`
    });
  } else {
    screenIds.add(widget.id);
    widgetIds.add(widget.id);
  }
  if (widget.parentId !== expectedParentId) {
    errors.push({
      path: `${path}.parentId`,
      message: `Widget parentId must be ${expectedParentId ?? "null"}`
    });
  }
  if (!supportedWidgetTypes.has(widget.type)) {
    errors.push({
      path: `${path}.type`,
      message: `Unsupported widget type: ${widget.type}`
    });
  }
  if (!widget.name?.trim()) {
    errors.push({
      path: `${path}.name`,
      message: `Widget name is required: ${widget.id || path}`
    });
  } else if (screenNames.has(widget.name)) {
    errors.push({
      path: `${path}.name`,
      message: `Widget name must be unique within a screen: ${widget.name}`
    });
  } else {
    screenNames.add(widget.name);
  }
  const assetId = widget.props?.assetId;
  if (widget.type === "image" && typeof assetId === "string" && assetId && !assetIds.has(assetId)) {
    errors.push({
      path: `${path}.props.assetId`,
      message: `Image widget references missing asset: ${assetId}`
    });
  }
  const font = widget.style?.font;
  if (typeof font === "string" && font && !isBuiltInLvglFont(font) && !assetIds.has(font)) {
    errors.push({
      path: `${path}.style.font`,
      message: `Font style references missing asset: ${font}`
    });
  }
  validateWidgetProps(widget, `${path}.props`, errors);
  validateLayoutBox(widget.layout, `${path}.layout`, widget.id, errors);
  validateWidgetStyle(widget.style, `${path}.style`, widget.id, errors);
  widget.children?.forEach((child, index) => {
    validateWidgetNode(child, `${path}.children[${index}]`, screenNames, screenIds, widgetIds, assetIds, errors, widget.id);
  });
}

function isBuiltInLvglFont(font: string): boolean {
  return /^lv_font_montserrat_\d+$/.test(font);
}

function validateWidgetProps(widget: WidgetNode, path: string, errors: ValidationError[]): void {
  if (widget.type === "spinner") {
    validatePositiveNumberProp(widget, path, "spinTime", errors);
    validatePositiveNumberProp(widget, path, "arcLength", errors);
  }
  if (widget.type === "chart") {
    validatePositiveNumberProp(widget, path, "pointCount", errors);
    validateChartValuesProp(widget, path, errors);
  }
  if (widget.type === "dropdown") {
    validateNonNegativeNumberProp(widget, path, "selected", errors);
  }
  if (widget.type === "slider" || widget.type === "bar" || widget.type === "arc") {
    validateNonNegativeNumberProp(widget, path, "value", errors);
  }
}

function validateChartValuesProp(widget: WidgetNode, path: string, errors: ValidationError[]): void {
  const values = widget.props?.values;
  if (values === undefined) {
    return;
  }
  if (!Array.isArray(values)) {
    errors.push({
      path: `${path}.values`,
      message: `Widget prop values must be an array of finite numbers: ${widget.id || path}`
    });
    return;
  }
  values.forEach((value, index) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push({
        path: `${path}.values[${index}]`,
        message: `Widget prop values must contain only finite numbers: ${widget.id || path}`
      });
    }
  });
}

function validatePositiveNumberProp(
  widget: WidgetNode,
  path: string,
  propName: string,
  errors: ValidationError[]
): void {
  const value = widget.props?.[propName];
  if (typeof value === "number" && value <= 0) {
    errors.push({
      path: `${path}.${propName}`,
      message: `Widget prop ${propName} must be greater than 0: ${widget.id || path}`
    });
  }
}

function validateNonNegativeNumberProp(
  widget: WidgetNode,
  path: string,
  propName: string,
  errors: ValidationError[]
): void {
  const value = widget.props?.[propName];
  if (typeof value === "number" && value < 0) {
    errors.push({
      path: `${path}.${propName}`,
      message: `Widget prop ${propName} must be non-negative: ${widget.id || path}`
    });
  }
}

function validateLayoutBox(
  layout: LayoutBox | undefined,
  path: string,
  widgetId: string,
  errors: ValidationError[]
): void {
  if (!layout) {
    return;
  }
  if (layout.width <= 0) {
    errors.push({
      path: `${path}.width`,
      message: `Widget width must be greater than 0: ${widgetId}`
    });
  }
  if (layout.height <= 0) {
    errors.push({
      path: `${path}.height`,
      message: `Widget height must be greater than 0: ${widgetId}`
    });
  }
  if (layout.align !== undefined && !["top-left", "top-right", "center", "bottom-left", "bottom-right"].includes(layout.align)) {
    errors.push({
      path: `${path}.align`,
      message: `Unsupported widget align: ${layout.align}`
    });
  }
  if (layout.flex) {
    if (!["row", "column"].includes(layout.flex.direction)) {
      errors.push({
        path: `${path}.flex.direction`,
        message: `Unsupported flex direction: ${layout.flex.direction}`
      });
    }
    if (layout.flex.gap < 0) {
      errors.push({
        path: `${path}.flex.gap`,
        message: `Flex gap must be non-negative: ${widgetId}`
      });
    }
  }
}

function validateStyleDef(
  styleDef: StyleDef | undefined,
  path: string,
  styleIds: Set<string>,
  errors: ValidationError[]
): void {
  if (!styleDef) {
    return;
  }
  if (!styleDef.id) {
    errors.push({
      path: `${path}.id`,
      message: "Style id is required"
    });
  } else if (styleIds.has(styleDef.id)) {
    errors.push({
      path: `${path}.id`,
      message: `Style id must be unique: ${styleDef.id}`
    });
  } else {
    styleIds.add(styleDef.id);
  }
  validateWidgetStyle(styleDef.style, `${path}.style`, styleDef.id || path, errors);
}

function validateWidgetStyle(
  style: WidgetStyle | undefined,
  path: string,
  ownerId: string,
  errors: ValidationError[]
): void {
  if (!style) {
    return;
  }
  if (style.opacity !== undefined && (style.opacity < 0 || style.opacity > 100)) {
    errors.push({
      path: `${path}.opacity`,
      message: `Style opacity must be between 0 and 100: ${ownerId}`
    });
  }
  if (style.radius !== undefined && style.radius < 0) {
    errors.push({
      path: `${path}.radius`,
      message: `Style radius must be non-negative: ${ownerId}`
    });
  }
  const padding = style.padding;
  if (padding) {
    (["top", "right", "bottom", "left"] as const).forEach((side) => {
      if (padding[side] < 0) {
        errors.push({
          path: `${path}.padding.${side}`,
          message: `Style padding must be non-negative: ${ownerId}`
        });
      }
    });
  }
  if (style.align !== undefined && !["left", "center", "right"].includes(style.align)) {
    errors.push({
      path: `${path}.align`,
      message: `Unsupported text align: ${style.align}`
    });
  }
}
