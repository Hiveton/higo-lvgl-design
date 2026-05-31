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
  blendMode?: "normal" | "additive" | "subtractive" | "multiply" | "replace";
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

const supportedImageMimeTypes = ["image/png", "image/jpeg"] as const;
const supportedFontMimeTypes = ["font/ttf", "font/otf", "font/woff", "font/woff2"] as const;

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
    updatedAt: { type: "string", minLength: 1, format: "date-time" }
  },
  $defs: {
    TargetConfig: {
      type: "object",
      required: ["lvglVersion", "deviceName", "width", "height", "dpi", "colorDepth"],
      additionalProperties: false,
      properties: {
        lvglVersion: { const: "8.3" },
        deviceName: { type: "string", minLength: 1 },
        width: { type: "integer", exclusiveMinimum: 0 },
        height: { type: "integer", exclusiveMinimum: 0 },
        dpi: { type: "integer", exclusiveMinimum: 0 },
        colorDepth: { enum: [16, 32] }
      }
    },
    LayoutBox: {
      type: "object",
      required: ["x", "y", "width", "height"],
      additionalProperties: false,
      properties: {
        x: { type: "integer" },
        y: { type: "integer" },
        width: { type: "integer", exclusiveMinimum: 0 },
        height: { type: "integer", exclusiveMinimum: 0 },
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
        gap: { type: "integer", minimum: 0 },
        wrap: { type: "boolean" }
      }
    },
    WidgetStyle: {
      type: "object",
      additionalProperties: false,
      properties: {
        opacity: { type: "integer", minimum: 0, maximum: 100 },
        blendMode: { enum: ["normal", "additive", "subtractive", "multiply", "replace"] },
        bgColor: { type: "string", pattern: "^$|^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" },
        textColor: { type: "string", pattern: "^$|^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" },
        borderColor: { type: "string", pattern: "^$|^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" },
        radius: { type: "integer", minimum: 0 },
        padding: { $ref: "#/$defs/PaddingBox" },
        font: { type: "string" },
        lineSpace: { type: "integer", minimum: 0 },
        letterSpace: { type: "integer", minimum: 0 },
        align: { enum: ["left", "center", "right"] }
      }
    },
    PaddingBox: {
      type: "object",
      required: ["top", "right", "bottom", "left"],
      additionalProperties: false,
      properties: {
        top: { type: "integer", minimum: 0 },
        right: { type: "integer", minimum: 0 },
        bottom: { type: "integer", minimum: 0 },
        left: { type: "integer", minimum: 0 }
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
              { type: "integer" },
              { type: "boolean" },
              { type: "array", items: { type: "integer" } }
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
      allOf: [
        {
          if: {
            properties: { kind: { const: "image" } },
            required: ["kind"]
          },
          then: {
            properties: { mimeType: { enum: supportedImageMimeTypes } }
          }
        },
        {
          if: {
            properties: { kind: { const: "font" } },
            required: ["kind"]
          },
          then: {
            properties: { mimeType: { enum: supportedFontMimeTypes } }
          }
        }
      ],
      properties: {
        id: { type: "string", minLength: 1 },
        projectId: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        kind: { enum: ["image", "font"] },
        mimeType: { type: "string", minLength: 1 },
        width: { type: "integer", minimum: 0 },
        height: { type: "integer", minimum: 0 },
        sizeBytes: { type: "integer", minimum: 0 },
        objectKey: { type: "string", minLength: 1, pattern: "^(local://.+|projects/[^/]+/assets/.+)$" },
        createdAt: { type: "string", minLength: 1, format: "date-time" }
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

export function validateProjectDoc(doc: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  if (!isRecord(doc)) {
    return {
      valid: false,
      errors: [{
        path: "",
        message: "ProjectDoc must be an object"
      }]
    };
  }
  const projectDoc = doc as ProjectDoc;
  validateAllowedObjectFields(
    doc,
    "",
    ["schemaVersion", "id", "name", "target", "theme", "screens", "assets", "styles", "events", "updatedAt"],
    "Unsupported ProjectDoc field",
    errors
  );
  const assetIds = new Set<string>();
  const assetKinds = new Map<string, AssetRef["kind"]>();
  const eventIds = new Set<string>();
  const eventCallbackSymbols = new Map<string, string>();
  const styleIds = new Set<string>();
  const widgetIds = new Set<string>();
  const screenIds = new Set<string>();

  if (projectDoc.schemaVersion !== 1) {
    errors.push({
      path: "schemaVersion",
      message: `Unsupported ProjectDoc schemaVersion: ${projectDoc.schemaVersion}`
    });
  }
  validateRequiredStringField(projectDoc.id, "id", "ProjectDoc id", errors);
  validateRequiredStringField(projectDoc.name, "name", "ProjectDoc name", errors);
  if (projectDoc.theme !== "dark" && projectDoc.theme !== "light") {
    errors.push({
      path: "theme",
      message: `Unsupported ProjectDoc theme: ${projectDoc.theme}`
    });
  }
  validateRequiredDateTimeField(projectDoc.updatedAt, "updatedAt", "ProjectDoc updatedAt", errors);
  validateTargetConfig(projectDoc.target, errors);
  const assets = validateArrayField(projectDoc.assets, "assets", errors);
  const screens = validateArrayField(projectDoc.screens, "screens", errors);
  const events = validateArrayField(projectDoc.events, "events", errors);
  const styles = validateArrayField(projectDoc.styles, "styles", errors);

  assets.forEach((asset, index) => {
    validateAssetRef(asset, `assets[${index}]`, projectDoc.id, assetIds, assetKinds, errors);
  });

  if (screens.length === 0) {
    errors.push({
      path: "screens",
      message: "ProjectDoc must contain at least one screen"
    });
  }

  screens.forEach((screen, index) => {
    validateScreenNode(screen, `screens[${index}]`, screenIds, errors);
    if (screen.root?.type !== "screen") {
      errors.push({
        path: `screens[${index}].root.type`,
        message: "Screen root widget type must be screen"
      });
    }
    const widgetIdsInScreen = new Set<string>();
    validateWidgetNode(screen.root, `screens[${index}].root`, widgetIdsInScreen, widgetIds, assetKinds, errors, null);
  });

  const reservedCSymbols = generatedCSymbols(projectDoc);
  events.forEach((event, index) => {
    validateEventBinding(event, `events[${index}]`, widgetIds, eventIds, eventCallbackSymbols, reservedCSymbols, errors);
  });

  styles.forEach((style, index) => {
    validateStyleDef(style, `styles[${index}]`, styleIds, assetKinds, errors);
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateArrayField<T>(value: T[] | undefined, path: string, errors: ValidationError[]): T[] {
  return validateArrayFieldWithMessage(value, path, `ProjectDoc ${path} must be an array`, errors);
}

function validateArrayFieldWithMessage<T>(value: T[] | undefined, path: string, message: string, errors: ValidationError[]): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  errors.push({
    path,
    message
  });
  return [];
}

function validateObjectField<T extends Record<string, unknown>>(
  value: T | undefined,
  path: string,
  label: string,
  ownerId: string,
  errors: ValidationError[]
): T {
  if (isRecord(value)) {
    return value as T;
  }
  errors.push({
    path,
    message: `${label} must be an object: ${ownerId}`
  });
  return {} as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateAllowedObjectFields(
  record: Record<string, unknown>,
  pathPrefix: string,
  allowedFields: readonly string[],
  messagePrefix: string,
  errors: ValidationError[]
): void {
  const allowed = new Set(allowedFields);
  Object.keys(record).forEach((field) => {
    if (!allowed.has(field)) {
      errors.push({
        path: `${pathPrefix}${field}`,
        message: `${messagePrefix}: ${field}`
      });
    }
  });
}

function validateTargetConfig(target: TargetConfig | undefined, errors: ValidationError[]): void {
  if (!target) {
    errors.push({
      path: "target",
      message: "ProjectDoc target is required"
    });
    return;
  }
  if (!isRecord(target)) {
    errors.push({
      path: "target",
      message: "ProjectDoc target must be an object"
    });
    return;
  }
  validateAllowedObjectFields(
    target,
    "target.",
    ["lvglVersion", "deviceName", "width", "height", "dpi", "colorDepth"],
    "Unsupported target field",
    errors
  );
  if (target.lvglVersion !== "8.3") {
    errors.push({
      path: "target.lvglVersion",
      message: `Unsupported LVGL version: ${target.lvglVersion}`
    });
  }
  validateRequiredStringField(target.deviceName, "target.deviceName", "Target deviceName", errors);
  const validWidth = validateIntegerNumberField(target.width, "target.width", "Target width", "", errors);
  const validHeight = validateIntegerNumberField(target.height, "target.height", "Target height", "", errors);
  const validDpi = validateIntegerNumberField(target.dpi, "target.dpi", "Target dpi", "", errors);
  if (validWidth && target.width <= 0) {
    errors.push({
      path: "target.width",
      message: "Target width must be greater than 0"
    });
  }
  if (validHeight && target.height <= 0) {
    errors.push({
      path: "target.height",
      message: "Target height must be greater than 0"
    });
  }
  if (validDpi && target.dpi <= 0) {
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
  assetKinds: Map<string, AssetRef["kind"]>,
  errors: ValidationError[]
): void {
  if (!isRecord(asset)) {
    errors.push({
      path,
      message: "Asset entry is required"
    });
    return;
  }
  validateAllowedObjectFields(
    asset,
    `${path}.`,
    ["id", "projectId", "name", "kind", "mimeType", "width", "height", "sizeBytes", "objectKey", "createdAt"],
    "Unsupported asset field",
    errors
  );
  const assetId = validateRequiredStringField(asset.id, `${path}.id`, "Asset id", errors) ? asset.id : "";
  if (assetId && assetIds.has(assetId)) {
    errors.push({
      path: `${path}.id`,
      message: `Asset id must be unique: ${assetId}`
    });
  } else if (assetId) {
    assetIds.add(assetId);
    if (asset.kind === "image" || asset.kind === "font") {
      assetKinds.set(assetId, asset.kind);
    }
  }
  const assetOwner = assetId || path;
  if (validateRequiredStringField(asset.projectId, `${path}.projectId`, "Asset projectId", errors, assetOwner) && asset.projectId !== projectId) {
    errors.push({
      path: `${path}.projectId`,
      message: `Asset projectId must match project id: ${assetOwner}`
    });
  }
  validateRequiredStringField(asset.name, `${path}.name`, "Asset name", errors, assetOwner);
  if (asset.kind !== "image" && asset.kind !== "font") {
    errors.push({
      path: `${path}.kind`,
      message: `Unsupported asset kind: ${asset.kind}`
    });
  }
  if (validateRequiredStringField(asset.mimeType, `${path}.mimeType`, "Asset mimeType", errors, assetOwner)
    && asset.kind === "image"
    && !isSupportedImageMimeType(asset.mimeType)) {
    errors.push({
      path: `${path}.mimeType`,
      message: `Unsupported image asset mimeType: ${assetOwner}`
    });
  }
  if (typeof asset.mimeType === "string"
    && asset.kind === "font"
    && !isSupportedFontMimeType(asset.mimeType)) {
    errors.push({
      path: `${path}.mimeType`,
      message: `Unsupported font asset mimeType: ${assetOwner}`
    });
  }
  if (asset.width !== undefined) {
    const validWidth = validateIntegerNumberField(asset.width, `${path}.width`, "Asset width", assetOwner, errors);
    if (validWidth && asset.width < 0) {
      errors.push({
        path: `${path}.width`,
        message: `Asset width must be non-negative: ${assetOwner}`
      });
    }
  }
  if (asset.height !== undefined) {
    const validHeight = validateIntegerNumberField(asset.height, `${path}.height`, "Asset height", assetOwner, errors);
    if (validHeight && asset.height < 0) {
      errors.push({
        path: `${path}.height`,
        message: `Asset height must be non-negative: ${assetOwner}`
      });
    }
  }
  const validSizeBytes = validateIntegerNumberField(asset.sizeBytes, `${path}.sizeBytes`, "Asset sizeBytes", assetOwner, errors);
  if (validSizeBytes && asset.sizeBytes < 0) {
    errors.push({
      path: `${path}.sizeBytes`,
      message: `Asset sizeBytes must be non-negative: ${assetOwner}`
    });
  }
  if (validateRequiredStringField(asset.objectKey, `${path}.objectKey`, "Asset objectKey", errors, assetOwner)
    && !asset.objectKey.startsWith("local://")
    && !asset.objectKey.startsWith(`projects/${projectId}/assets/`)) {
    errors.push({
      path: `${path}.objectKey`,
      message: `Asset objectKey must be under project asset scope: ${assetOwner}`
    });
  }
  validateRequiredDateTimeField(asset.createdAt, `${path}.createdAt`, "Asset createdAt", errors, assetOwner);
}

function isSupportedImageMimeType(mimeType: unknown): mimeType is (typeof supportedImageMimeTypes)[number] {
  return typeof mimeType === "string" && supportedImageMimeTypes.includes(mimeType as (typeof supportedImageMimeTypes)[number]);
}

function isSupportedFontMimeType(mimeType: unknown): mimeType is (typeof supportedFontMimeTypes)[number] {
  return typeof mimeType === "string" && supportedFontMimeTypes.includes(mimeType as (typeof supportedFontMimeTypes)[number]);
}

function validateScreenNode(
  screen: ScreenNode | undefined,
  path: string,
  screenIds: Set<string>,
  errors: ValidationError[]
): void {
  if (!isRecord(screen)) {
    errors.push({
      path,
      message: "Screen entry is required"
    });
    return;
  }
  validateAllowedObjectFields(
    screen,
    `${path}.`,
    ["id", "name", "root"],
    "Unsupported screen field",
    errors
  );
  const screenId = validateRequiredStringField(screen.id, `${path}.id`, "Screen id", errors) ? screen.id : "";
  if (screenId && screenIds.has(screenId)) {
    errors.push({
      path: `${path}.id`,
      message: `Screen id must be unique: ${screenId}`
    });
  } else if (screenId) {
    screenIds.add(screenId);
  }
  validateRequiredStringField(screen.name, `${path}.name`, "Screen name", errors, screenId || path);
}

function validateEventBinding(
  event: EventBinding | undefined,
  path: string,
  widgetIds: Set<string>,
  eventIds: Set<string>,
  eventCallbackSymbols: Map<string, string>,
  reservedCSymbols: Set<string>,
  errors: ValidationError[]
): void {
  if (!isRecord(event)) {
    errors.push({
      path,
      message: "Event entry is required"
    });
    return;
  }
  validateAllowedObjectFields(
    event,
    `${path}.`,
    ["id", "widgetId", "event", "handlerName"],
    "Unsupported event field",
    errors
  );
  const eventId = validateRequiredStringField(event.id, `${path}.id`, "Event id", errors) ? event.id : "";
  if (eventId && eventIds.has(eventId)) {
    errors.push({
      path: `${path}.id`,
      message: `Event id must be unique: ${eventId}`
    });
  } else if (eventId) {
    eventIds.add(eventId);
  }
  if (validateRequiredStringField(event.widgetId, `${path}.widgetId`, "Event widgetId", errors, eventId || path) && !widgetIds.has(event.widgetId)) {
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
  if (validateRequiredStringField(event.handlerName, `${path}.handlerName`, "Event handlerName", errors, eventId || path)) {
    const handlerName = event.handlerName.trim();
    const callbackSymbol = cCallbackSymbol(handlerName);
    const existingHandler = eventCallbackSymbols.get(callbackSymbol);
    if (reservedCSymbols.has(callbackSymbol)) {
      errors.push({
        path: `${path}.handlerName`,
        message: `Event handlerName collides with generated C symbol: ${callbackSymbol}`
      });
    } else if (existingHandler && existingHandler !== handlerName) {
      errors.push({
        path: `${path}.handlerName`,
        message: `Event handlerName must generate a unique C callback symbol: ${callbackSymbol}`
      });
    } else {
      eventCallbackSymbols.set(callbackSymbol, handlerName);
    }
  }
}

function generatedCSymbols(doc: ProjectDoc): Set<string> {
  const reserved = new Set<string>(["ui_init_styles"]);
  const assetNames = new Map<string, number>();
  for (const asset of Array.isArray(doc.assets) ? doc.assets : []) {
    if (isRecord(asset)) {
      const symbol = nameRegistrySymbol(`img_${String(asset.name ?? "")}`, assetNames);
      reserved.add(symbol);
      reserved.add(`${symbol}_data`);
    }
  }
  const styleNames = new Map<string, number>();
  for (const style of Array.isArray(doc.styles) ? doc.styles : []) {
    if (isRecord(style)) {
      reserved.add(nameRegistrySymbol(`style_${String(style.name ?? "")}`, styleNames));
    }
  }
  const used = new Map<string, number>();
  for (const screen of Array.isArray(doc.screens) ? doc.screens : []) {
    if (!isRecord(screen)) {
      continue;
    }
    const screenSymbol = nameRegistrySymbol(String(screen.name ?? ""), used);
    reserved.add(screenSymbol);
    reserved.add(`${screenSymbol}_screen_init`);
    const children = isRecord(screen.root) && Array.isArray(screen.root.children) ? screen.root.children : [];
    for (const child of children) {
      collectWidgetCSymbols(child as WidgetNode, used, reserved);
    }
  }
  return reserved;
}

function collectWidgetCSymbols(widget: WidgetNode | undefined, used: Map<string, number>, reserved: Set<string>): void {
  if (!isRecord(widget)) {
    return;
  }
  const symbol = nameRegistrySymbol(String(widget.name ?? ""), used);
  reserved.add(symbol);
  if (widget.type === "button" && isRecord(widget.props) && typeof widget.props.text === "string") {
    reserved.add(nameRegistrySymbol(`${String(widget.name ?? "")}_Label`, used));
  }
  if (widget.type === "line") {
    reserved.add(`${symbol}_points`);
  }
  if (widget.type === "chart") {
    reserved.add(`${symbol}_series`);
  }
  const children = Array.isArray(widget.children) ? widget.children : [];
  for (const child of children) {
    collectWidgetCSymbols(child, used, reserved);
  }
}

function nameRegistrySymbol(name: string, used = new Map<string, number>()): string {
  const base = `ui_${cCallbackSymbol(name)}`;
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}_${count + 1}`;
}

function cCallbackSymbol(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!cleaned) {
    return "Widget";
  }
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
}

function validateWidgetNode(
  widget: WidgetNode | undefined,
  path: string,
  screenIds: Set<string>,
  widgetIds: Set<string>,
  assetKinds: Map<string, AssetRef["kind"]>,
  errors: ValidationError[],
  expectedParentId: string | null
): void {
  if (!isRecord(widget)) {
    errors.push({
      path,
      message: "Widget entry is required"
    });
    return;
  }
  validateAllowedObjectFields(
    widget,
    `${path}.`,
    ["id", "type", "name", "parentId", "children", "layout", "props", "style", "locked", "hidden"],
    "Unsupported widget field",
    errors
  );
  const widgetId = validateRequiredStringField(widget.id, `${path}.id`, "Widget id", errors) ? widget.id : path;
  if (widgetId !== path && screenIds.has(widgetId)) {
    errors.push({
      path: `${path}.id`,
      message: `Widget id must be unique within a screen: ${widgetId}`
    });
  } else if (widgetId !== path && widgetIds.has(widgetId)) {
    errors.push({
      path: `${path}.id`,
      message: `Widget id must be unique across project: ${widgetId}`
    });
  } else if (widgetId !== path) {
    screenIds.add(widgetId);
    widgetIds.add(widgetId);
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
  if (typeof widget.locked !== "boolean") {
    errors.push({
      path: `${path}.locked`,
      message: `Widget locked must be a boolean: ${widget.id || path}`
    });
  }
  if (typeof widget.hidden !== "boolean") {
    errors.push({
      path: `${path}.hidden`,
      message: `Widget hidden must be a boolean: ${widget.id || path}`
    });
  }
  validateRequiredStringField(widget.name, `${path}.name`, "Widget name", errors, widgetId);
  const props = validateObjectField<WidgetNode["props"]>(widget.props, `${path}.props`, "Widget props", widgetId, errors);
  const style = validateObjectField<WidgetStyle>(widget.style, `${path}.style`, "Widget style", widgetId, errors);
  const children = validateArrayFieldWithMessage<WidgetNode>(
    widget.children,
    `${path}.children`,
    `Widget children must be an array: ${widgetId}`,
    errors
  );
  const assetId = props.assetId;
  if (widget.type === "image" && typeof assetId === "string" && assetId) {
    const kind = assetKinds.get(assetId);
    if (!kind) {
      errors.push({
        path: `${path}.props.assetId`,
        message: `Image widget references missing asset: ${assetId}`
      });
    } else if (kind !== "image") {
      errors.push({
        path: `${path}.props.assetId`,
        message: `Image widget must reference an image asset: ${assetId}`
      });
    }
  }
  const font = style.font;
  if (typeof font === "string" && font && !isBuiltInLvglFont(font)) {
    validateFontAssetKind(font, `${path}.style.font`, assetKinds, errors);
  }
  validateWidgetProps({ ...widget, props }, `${path}.props`, errors);
  validateLayoutBox(widget.layout, `${path}.layout`, widgetId, widget.type, errors);
  validateWidgetStyle(style, `${path}.style`, widgetId, errors);
  children.forEach((child, index) => {
    validateWidgetNode(child, `${path}.children[${index}]`, screenIds, widgetIds, assetKinds, errors, widgetId);
  });
}

function isBuiltInLvglFont(font: string): boolean {
  return /^lv_font_montserrat_\d+$/.test(font);
}

function validateWidgetProps(widget: WidgetNode, path: string, errors: ValidationError[]): void {
  validateWidgetPropTypes(widget, path, errors);
  if (widget.type === "spinner") {
    validatePositiveNumberProp(widget, path, "spinTime", errors);
    validatePositiveNumberProp(widget, path, "arcLength", errors);
  }
  if (widget.type === "chart") {
    validatePositiveNumberProp(widget, path, "pointCount", errors);
    validateRangeBounds(widget, path, errors);
    validateChartValuesProp(widget, path, errors);
  }
  if (widget.type === "dropdown") {
    validateNonNegativeNumberProp(widget, path, "selected", errors);
    validateDropdownSelectedProp(widget, path, errors);
  }
  if (widget.type === "slider" || widget.type === "bar" || widget.type === "arc") {
    validateNonNegativeNumberProp(widget, path, "value", errors);
    validateRangeBounds(widget, path, errors);
    validateRangeValue(widget, path, errors);
  }
}

function validateWidgetPropTypes(widget: WidgetNode, path: string, errors: ValidationError[]): void {
  if (widget.type === "label" || widget.type === "button" || widget.type === "checkbox" || widget.type === "dropdown") {
    validateStringProp(widget, path, "text", errors);
  }
  if (widget.type === "checkbox" || widget.type === "switch") {
    validateBooleanProp(widget, path, "checked", errors);
  }
  if (widget.type === "image") {
    validateStringProp(widget, path, "assetId", errors);
  }
  if (widget.type === "dropdown") {
    validateStringProp(widget, path, "options", errors);
    validateIntegerProp(widget, path, "selected", errors);
  }
  if (widget.type === "spinner") {
    validateIntegerProp(widget, path, "spinTime", errors);
    validateIntegerProp(widget, path, "arcLength", errors);
  }
  if (widget.type === "chart") {
    validateIntegerProp(widget, path, "min", errors);
    validateIntegerProp(widget, path, "max", errors);
    validateIntegerProp(widget, path, "pointCount", errors);
  }
  if (widget.type === "slider" || widget.type === "bar" || widget.type === "arc") {
    validateIntegerProp(widget, path, "min", errors);
    validateIntegerProp(widget, path, "max", errors);
    validateIntegerProp(widget, path, "value", errors);
  }
}

function validateNumberProp(widget: WidgetNode, path: string, propName: string, errors: ValidationError[]): void {
  const value = widget.props?.[propName];
  if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) {
    errors.push({
      path: `${path}.${propName}`,
      message: `Widget prop ${propName} must be a number: ${widget.id || path}`
    });
  }
}

function validateIntegerProp(widget: WidgetNode, path: string, propName: string, errors: ValidationError[]): void {
  const value = widget.props?.[propName];
  if (value === undefined) {
    return;
  }
  validateNumberProp(widget, path, propName, errors);
  if (typeof value === "number" && Number.isFinite(value) && !Number.isInteger(value)) {
    errors.push({
      path: `${path}.${propName}`,
      message: `Widget prop ${propName} must be an integer: ${widget.id || path}`
    });
  }
}

function validateStringProp(widget: WidgetNode, path: string, propName: string, errors: ValidationError[]): void {
  const value = widget.props?.[propName];
  if (value !== undefined && typeof value !== "string") {
    errors.push({
      path: `${path}.${propName}`,
      message: `Widget prop ${propName} must be a string: ${widget.id || path}`
    });
  }
}

function validateBooleanProp(widget: WidgetNode, path: string, propName: string, errors: ValidationError[]): void {
  const value = widget.props?.[propName];
  if (value !== undefined && typeof value !== "boolean") {
    errors.push({
      path: `${path}.${propName}`,
      message: `Widget prop ${propName} must be a boolean: ${widget.id || path}`
    });
  }
}

function validateDropdownSelectedProp(widget: WidgetNode, path: string, errors: ValidationError[]): void {
  const selected = widget.props?.selected;
  if (typeof selected !== "number" || !Number.isFinite(selected) || selected < 0) {
    return;
  }
  const options = dropdownOptionList(widget.props?.options);
  if (options.length > 0 && selected >= options.length) {
    errors.push({
      path: `${path}.selected`,
      message: `Widget prop selected must reference an available option: ${widget.id || path}`
    });
  }
}

function dropdownOptionList(value: WidgetPropValue | undefined): string[] {
  return typeof value === "string"
    ? value.split(/\r?\n/).map((option) => option.trim()).filter(Boolean)
    : [];
}

function validateRangeBounds(widget: WidgetNode, path: string, errors: ValidationError[]): void {
  const min = widget.props?.min;
  const max = widget.props?.max;
  if (typeof min === "number" && typeof max === "number" && Number.isFinite(min) && Number.isFinite(max) && max <= min) {
    errors.push({
      path: `${path}.max`,
      message: `Widget prop max must be greater than min: ${widget.id || path}`
    });
  }
}

function validateRangeValue(widget: WidgetNode, path: string, errors: ValidationError[]): void {
  const value = widget.props?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return;
  }
  const min = finiteNumberProp(widget.props, "min", 0);
  const max = finiteNumberProp(widget.props, "max", 100);
  if (max > min && (value < min || value > max)) {
    errors.push({
      path: `${path}.value`,
      message: `Widget prop value must be between min and max: ${widget.id || path}`
    });
  }
}

function finiteNumberProp(props: WidgetNode["props"] | undefined, key: string, fallback: number): number {
  const value = props?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
      return;
    }
    if (!Number.isInteger(value)) {
      errors.push({
        path: `${path}.values[${index}]`,
        message: `Widget prop values must contain only integers: ${widget.id || path}`
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
  widgetType: WidgetNode["type"],
  errors: ValidationError[]
): void {
  if (!isRecord(layout)) {
    errors.push({
      path,
      message: `Widget layout must be an object: ${widgetId}`
    });
    return;
  }
  validateAllowedObjectFields(
    layout,
    `${path}.`,
    ["x", "y", "width", "height", "align", "flex"],
    "Unsupported widget layout field",
    errors
  );
  validateIntegerNumberField(layout.x, `${path}.x`, "Widget x", widgetId, errors);
  validateIntegerNumberField(layout.y, `${path}.y`, "Widget y", widgetId, errors);
  const validWidth = validateIntegerNumberField(layout.width, `${path}.width`, "Widget width", widgetId, errors);
  const validHeight = validateIntegerNumberField(layout.height, `${path}.height`, "Widget height", widgetId, errors);
  if (validWidth && layout.width <= 0) {
    errors.push({
      path: `${path}.width`,
      message: `Widget width must be greater than 0: ${widgetId}`
    });
  }
  if (validHeight && layout.height <= 0) {
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
    if (widgetType !== "screen" && widgetType !== "container") {
      errors.push({
        path: `${path}.flex`,
        message: `Widget flex layout is only supported on screen and container widgets: ${widgetId}`
      });
    }
    const flex = validateObjectField<LayoutBox["flex"] & Record<string, unknown>>(
      layout.flex as (LayoutBox["flex"] & Record<string, unknown>) | undefined,
      `${path}.flex`,
      "Widget flex layout",
      widgetId,
      errors
    );
    validateAllowedObjectFields(
      flex,
      `${path}.flex.`,
      ["direction", "gap", "wrap"],
      "Unsupported flex layout field",
      errors
    );
    if (!["row", "column"].includes(flex.direction)) {
      errors.push({
        path: `${path}.flex.direction`,
        message: `Unsupported flex direction: ${flex.direction}`
      });
    }
    const validGap = validateIntegerNumberField(flex.gap, `${path}.flex.gap`, "Flex gap", widgetId, errors);
    if (validGap && flex.gap < 0) {
      errors.push({
        path: `${path}.flex.gap`,
        message: `Flex gap must be non-negative: ${widgetId}`
      });
    }
    if (typeof flex.wrap !== "boolean") {
      errors.push({
        path: `${path}.flex.wrap`,
        message: `Flex wrap must be a boolean: ${widgetId}`
      });
    }
  }
}

function validateStyleDef(
  styleDef: StyleDef | undefined,
  path: string,
  styleIds: Set<string>,
  assetKinds: Map<string, AssetRef["kind"]>,
  errors: ValidationError[]
): void {
  if (!isRecord(styleDef)) {
    errors.push({
      path,
      message: "Style entry is required"
    });
    return;
  }
  validateAllowedObjectFields(
    styleDef,
    `${path}.`,
    ["id", "name", "style"],
    "Unsupported style entry field",
    errors
  );
  const styleId = validateRequiredStringField(styleDef.id, `${path}.id`, "Style id", errors) ? styleDef.id : "";
  if (styleId && styleIds.has(styleId)) {
    errors.push({
      path: `${path}.id`,
      message: `Style id must be unique: ${styleId}`
    });
  } else if (styleId) {
    styleIds.add(styleId);
  }
  const styleOwner = styleId || path;
  validateRequiredStringField(styleDef.name, `${path}.name`, "Style name", errors, styleOwner);
  const style = validateObjectField<WidgetStyle>(styleDef.style, `${path}.style`, "Style value", styleOwner, errors);
  validateWidgetStyle(style, `${path}.style`, styleOwner, errors);
  const font = style.font;
  if (typeof font === "string" && font && !isBuiltInLvglFont(font)) {
    validateFontAssetKind(font, `${path}.style.font`, assetKinds, errors);
  }
}

function validateFontAssetKind(
  font: string,
  path: string,
  assetKinds: Map<string, AssetRef["kind"]>,
  errors: ValidationError[]
): void {
  const kind = assetKinds.get(font);
  if (!kind) {
    errors.push({
      path,
      message: `Font style references missing asset: ${font}`
    });
  } else if (kind !== "font") {
    errors.push({
      path,
      message: `Font style must reference a font asset: ${font}`
    });
  }
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
  validateAllowedObjectFields(
    style as WidgetStyle & Record<string, unknown>,
    `${path}.`,
    ["opacity", "blendMode", "bgColor", "textColor", "borderColor", "radius", "padding", "font", "lineSpace", "letterSpace", "align"],
    "Unsupported style field",
    errors
  );
  if (style.opacity !== undefined) {
    const validOpacity = validateIntegerNumberField(style.opacity, `${path}.opacity`, "Style opacity", ownerId, errors);
    if (validOpacity && (style.opacity < 0 || style.opacity > 100)) {
      errors.push({
        path: `${path}.opacity`,
        message: `Style opacity must be between 0 and 100: ${ownerId}`
      });
    }
  }
  if (style.radius !== undefined) {
    const validRadius = validateIntegerNumberField(style.radius, `${path}.radius`, "Style radius", ownerId, errors);
    if (validRadius && style.radius < 0) {
      errors.push({
        path: `${path}.radius`,
        message: `Style radius must be non-negative: ${ownerId}`
      });
    }
  }
  if (style.blendMode !== undefined && typeof style.blendMode !== "string") {
    errors.push({
      path: `${path}.blendMode`,
      message: `Style blendMode must be a string: ${ownerId}`
    });
  } else if (style.blendMode !== undefined && !["normal", "additive", "subtractive", "multiply", "replace"].includes(style.blendMode)) {
    errors.push({
      path: `${path}.blendMode`,
      message: `Unsupported blend mode: ${style.blendMode}`
    });
  }
  (["letterSpace", "lineSpace"] as const).forEach((field) => {
    const value = style[field];
    if (value !== undefined) {
      const validValue = validateIntegerNumberField(value, `${path}.${field}`, `Style ${field}`, ownerId, errors);
      if (validValue && value < 0) {
        errors.push({
          path: `${path}.${field}`,
          message: `Style ${field} must be non-negative: ${ownerId}`
        });
      }
    }
  });
  (["bgColor", "textColor", "borderColor"] as const).forEach((field) => {
    const value = style[field];
    if (value !== undefined && typeof value !== "string") {
      errors.push({
        path: `${path}.${field}`,
        message: `Style ${field} must be a string: ${ownerId}`
      });
      return;
    }
    if (value !== undefined && value !== "" && !isHexColor(value)) {
      errors.push({
        path: `${path}.${field}`,
        message: `Style ${field} must be a 3 or 6 digit hex color: ${ownerId}`
      });
    }
  });
  const padding = style.padding;
  if (padding) {
    if (!isRecord(padding)) {
      errors.push({
        path: `${path}.padding`,
        message: `Style padding must be an object: ${ownerId}`
      });
      return;
    }
    validateAllowedObjectFields(
      padding,
      `${path}.padding.`,
      ["top", "right", "bottom", "left"],
      "Unsupported style padding field",
      errors
    );
    (["top", "right", "bottom", "left"] as const).forEach((side) => {
      const value = padding[side];
      const validValue = validateIntegerNumberField(value, `${path}.padding.${side}`, "Style padding", ownerId, errors);
      if (validValue && value < 0) {
        errors.push({
          path: `${path}.padding.${side}`,
          message: `Style padding must be non-negative: ${ownerId}`
        });
      }
    });
  }
  if (style.font !== undefined && typeof style.font !== "string") {
    errors.push({
      path: `${path}.font`,
      message: `Style font must be a string: ${ownerId}`
    });
  }
  if (style.align !== undefined && typeof style.align !== "string") {
    errors.push({
      path: `${path}.align`,
      message: `Style align must be a string: ${ownerId}`
    });
  } else if (style.align !== undefined && !["left", "center", "right"].includes(style.align)) {
    errors.push({
      path: `${path}.align`,
      message: `Unsupported text align: ${style.align}`
    });
  }
}

function isHexColor(value: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function validateRequiredStringField(
  value: unknown,
  path: string,
  label: string,
  errors: ValidationError[],
  ownerId?: string
): value is string {
  if (typeof value !== "string") {
    errors.push({
      path,
      message: `${label} must be a string`
    });
    return false;
  }
  if (!value.trim()) {
    errors.push({
      path,
      message: ownerId ? `${label} is required: ${ownerId}` : `${label} is required`
    });
    return false;
  }
  return true;
}

function validateRequiredDateTimeField(
  value: unknown,
  path: string,
  label: string,
  errors: ValidationError[],
  ownerId?: string
): value is string {
  if (!validateRequiredStringField(value, path, label, errors, ownerId)) {
    return false;
  }
  if (!isUtcDateTime(value)) {
    errors.push({
      path,
      message: `${label} must be a UTC date-time string`
    });
    return false;
  }
  return true;
}

function isUtcDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value);
}

function validateFiniteNumberField(
  value: unknown,
  path: string,
  label: string,
  ownerId: string,
  errors: ValidationError[]
): value is number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return true;
  }
  errors.push({
    path,
    message: ownerId ? `${label} must be a finite number: ${ownerId}` : `${label} must be a finite number`
  });
  return false;
}

function validateIntegerNumberField(
  value: unknown,
  path: string,
  label: string,
  ownerId: string,
  errors: ValidationError[]
): value is number {
  if (!validateFiniteNumberField(value, path, label, ownerId, errors)) {
    return false;
  }
  if (Number.isInteger(value)) {
    return true;
  }
  errors.push({
    path,
    message: ownerId ? `${label} must be an integer: ${ownerId}` : `${label} must be an integer`
  });
  return false;
}
