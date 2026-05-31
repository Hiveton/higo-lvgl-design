import {
  createDefaultProjectDoc,
  getActiveScreen,
  projectDocJsonSchema,
  type ProjectDoc,
  validateProjectDoc,
  widgetCatalog
} from "./index";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("ProjectDoc schema", () => {
  it("creates a valid default project with Screen_1 and a screen root", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });

    expect(validateProjectDoc(doc).valid).toBe(true);
    expect(doc.schemaVersion).toBe(1);
    expect(doc.screens).toHaveLength(1);
    expect(doc.screens[0].name).toBe("Screen_1");
    expect(doc.screens[0].root.type).toBe("screen");
    expect(doc.target.width).toBe(480);
    expect(doc.target.height).toBe(480);
  });

  it("exports a JSON Schema artifact for ProjectDoc tooling", () => {
    expect(projectDocJsonSchema.title).toBe("ProjectDoc");
    expect(projectDocJsonSchema.required).toContain("screens");
    expect(projectDocJsonSchema.properties.screens.minItems).toBe(1);
    expect(projectDocJsonSchema.properties.updatedAt).toMatchObject({
      type: "string",
      format: "date-time"
    });
    expect(projectDocJsonSchema.$defs.AssetRef.properties.createdAt).toMatchObject({
      type: "string",
      format: "date-time"
    });
    const objectKeyPattern = new RegExp(projectDocJsonSchema.$defs.AssetRef.properties.objectKey.pattern ?? "");
    expect(objectKeyPattern.test("projects/project-1/assets/asset-1/icon.png")).toBe(true);
    expect(objectKeyPattern.test("local://icon.png")).toBe(true);
    expect(projectDocJsonSchema.$defs.WidgetNode.properties.type.enum).toEqual([
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
  });

  it("keeps the emitted JSON Schema file in sync with the TypeScript source", () => {
    const path = fileURLToPath(new URL("../project-doc.schema.json", import.meta.url));
    const emitted = JSON.parse(readFileSync(path, "utf8"));

    expect(emitted).toEqual(projectDocJsonSchema);
  });

  it("keeps the example watch project valid", () => {
    const path = fileURLToPath(new URL("../../../examples/watch-project.json", import.meta.url));
    const doc = JSON.parse(readFileSync(path, "utf8")) as ProjectDoc;

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(true);
    expect(doc.name).toBe("Example Watch UI");
    expect(doc.events[0]).toMatchObject({
      widgetId: "start-button",
      handlerName: "on_start_clicked"
    });
  });

  it("rejects ProjectDoc and asset timestamps that are not UTC date-time strings", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Timestamps",
      updatedAt: "yesterday"
    });
    doc.assets = [{
      id: "asset-1",
      projectId: "project-1",
      name: "icon.png",
      kind: "image",
      mimeType: "image/png",
      width: 16,
      height: 16,
      sizeBytes: 128,
      objectKey: "projects/project-1/assets/asset-1/icon.png",
      createdAt: "2026-05-08 00:00:00"
    }];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "updatedAt",
      message: "ProjectDoc updatedAt must be a UTC date-time string"
    });
    expect(result.errors).toContainEqual({
      path: "assets[0].createdAt",
      message: "Asset createdAt must be a UTC date-time string"
    });
  });

  it("rejects missing project identity fields", () => {
    const doc = createDefaultProjectDoc({
      id: "",
      name: "   ",
      updatedAt: "2026-05-08T00:00:00Z"
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "id",
      message: "ProjectDoc id is required"
    });
    expect(result.errors).toContainEqual({
      path: "name",
      message: "ProjectDoc name is required"
    });
  });

  it("rejects non-object ProjectDoc roots without throwing", () => {
    expect(validateProjectDoc(null).errors).toContainEqual({
      path: "",
      message: "ProjectDoc must be an object"
    });
    expect(validateProjectDoc("bad-doc").errors).toContainEqual({
      path: "",
      message: "ProjectDoc must be an object"
    });
  });

  it("rejects fractional target dimensions because LVGL targets use integer pixels and DPI", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Fractional Target",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.target.width = 320.5;
    doc.target.height = 240.25;
    doc.target.dpi = 159.5;

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "target.width",
      message: "Target width must be an integer"
    });
    expect(result.errors).toContainEqual({
      path: "target.height",
      message: "Target height must be an integer"
    });
    expect(result.errors).toContainEqual({
      path: "target.dpi",
      message: "Target dpi must be an integer"
    });
  });

  it("rejects non-string required text fields without throwing", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Text Types",
      updatedAt: "2026-05-08T00:00:00Z"
    }) as unknown as ProjectDoc;
    (doc as unknown as Record<string, unknown>).id = 123;
    (doc as unknown as Record<string, unknown>).name = false;
    (doc as unknown as Record<string, unknown>).updatedAt = [];
    doc.target.deviceName = 42 as unknown as ProjectDoc["target"]["deviceName"];
    doc.assets = [{
      id: 123,
      projectId: false,
      name: [],
      kind: "image",
      mimeType: 42,
      sizeBytes: 12,
      objectKey: {},
      createdAt: 0
    } as unknown as ProjectDoc["assets"][number]];
    doc.styles = [{
      id: 123,
      name: false,
      style: {}
    } as unknown as ProjectDoc["styles"][number]];
    doc.events = [{
      id: 123,
      widgetId: false,
      event: "LV_EVENT_CLICKED",
      handlerName: []
    } as unknown as ProjectDoc["events"][number]];
    doc.screens[0].id = 123 as unknown as ProjectDoc["screens"][number]["id"];
    doc.screens[0].name = false as unknown as ProjectDoc["screens"][number]["name"];
    doc.screens[0].root.id = 123 as unknown as ProjectDoc["screens"][number]["root"]["id"];
    doc.screens[0].root.name = false as unknown as ProjectDoc["screens"][number]["root"]["name"];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ path: "id", message: "ProjectDoc id must be a string" });
    expect(result.errors).toContainEqual({ path: "name", message: "ProjectDoc name must be a string" });
    expect(result.errors).toContainEqual({ path: "updatedAt", message: "ProjectDoc updatedAt must be a string" });
    expect(result.errors).toContainEqual({ path: "target.deviceName", message: "Target deviceName must be a string" });
    expect(result.errors).toContainEqual({ path: "assets[0].id", message: "Asset id must be a string" });
    expect(result.errors).toContainEqual({ path: "assets[0].projectId", message: "Asset projectId must be a string" });
    expect(result.errors).toContainEqual({ path: "assets[0].name", message: "Asset name must be a string" });
    expect(result.errors).toContainEqual({ path: "assets[0].mimeType", message: "Asset mimeType must be a string" });
    expect(result.errors).toContainEqual({ path: "assets[0].objectKey", message: "Asset objectKey must be a string" });
    expect(result.errors).toContainEqual({ path: "assets[0].createdAt", message: "Asset createdAt must be a string" });
    expect(result.errors).toContainEqual({ path: "styles[0].id", message: "Style id must be a string" });
    expect(result.errors).toContainEqual({ path: "styles[0].name", message: "Style name must be a string" });
    expect(result.errors).toContainEqual({ path: "events[0].id", message: "Event id must be a string" });
    expect(result.errors).toContainEqual({ path: "events[0].widgetId", message: "Event widgetId must be a string" });
    expect(result.errors).toContainEqual({ path: "events[0].handlerName", message: "Event handlerName must be a string" });
    expect(result.errors).toContainEqual({ path: "screens[0].id", message: "Screen id must be a string" });
    expect(result.errors).toContainEqual({ path: "screens[0].name", message: "Screen name must be a string" });
    expect(result.errors).toContainEqual({ path: "screens[0].root.id", message: "Widget id must be a string" });
    expect(result.errors).toContainEqual({ path: "screens[0].root.name", message: "Widget name must be a string" });
  });

  it("rejects invalid top-level ProjectDoc contract fields", () => {
    const doc = {
      schemaVersion: 2,
      id: "project-1",
      name: "Broken Contract",
      target: undefined,
      theme: "solarized",
      screens: {},
      assets: {},
      styles: {},
      events: {},
      updatedAt: ""
    } as unknown as ProjectDoc;

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "schemaVersion",
      message: "Unsupported ProjectDoc schemaVersion: 2"
    });
    expect(result.errors).toContainEqual({
      path: "target",
      message: "ProjectDoc target is required"
    });
    expect(result.errors).toContainEqual({
      path: "theme",
      message: "Unsupported ProjectDoc theme: solarized"
    });
    expect(result.errors).toContainEqual({
      path: "updatedAt",
      message: "ProjectDoc updatedAt is required"
    });
    expect(result.errors).toContainEqual({
      path: "screens",
      message: "ProjectDoc screens must be an array"
    });
    expect(result.errors).toContainEqual({
      path: "assets",
      message: "ProjectDoc assets must be an array"
    });
    expect(result.errors).toContainEqual({
      path: "styles",
      message: "ProjectDoc styles must be an array"
    });
    expect(result.errors).toContainEqual({
      path: "events",
      message: "ProjectDoc events must be an array"
    });
  });

  it("rejects unknown ProjectDoc object fields outside props", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Extra Object Fields",
      updatedAt: "2026-05-08T00:00:00Z"
    }) as ProjectDoc & Record<string, unknown>;
    doc.extraRoot = true;
    (doc.target as Record<string, unknown>).rotation = 90;
    (doc.assets[0] as Record<string, unknown>) = {
      id: "asset-1",
      projectId: "project-1",
      name: "icon.png",
      kind: "image",
      mimeType: "image/png",
      sizeBytes: 12,
      objectKey: "local://icon.png",
      createdAt: "2026-05-08T00:00:00Z",
      checksum: "abc"
    };
    (doc.styles[0] as Record<string, unknown>) = {
      id: "style-1",
      name: "Style_1",
      style: {},
      description: "extra"
    };
    (doc.events[0] as Record<string, unknown>) = {
      id: "event-1",
      widgetId: "root-screen-1",
      event: "LV_EVENT_READY",
      handlerName: "on_ready",
      once: true
    };
    (doc.screens[0] as Record<string, unknown>).order = 1;
    (doc.screens[0].root as Record<string, unknown>).zIndex = 1;
    doc.screens[0].root.props = { customRuntimeProp: "allowed" };

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "extraRoot",
      message: "Unsupported ProjectDoc field: extraRoot"
    });
    expect(result.errors).toContainEqual({
      path: "target.rotation",
      message: "Unsupported target field: rotation"
    });
    expect(result.errors).toContainEqual({
      path: "assets[0].checksum",
      message: "Unsupported asset field: checksum"
    });
    expect(result.errors).toContainEqual({
      path: "styles[0].description",
      message: "Unsupported style entry field: description"
    });
    expect(result.errors).toContainEqual({
      path: "events[0].once",
      message: "Unsupported event field: once"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].order",
      message: "Unsupported screen field: order"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.zIndex",
      message: "Unsupported widget field: zIndex"
    });
    expect(result.errors.some((error) => error.path === "screens[0].root.props.customRuntimeProp")).toBe(false);
  });

  it("rejects a document without screens", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens = [];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens",
      message: "ProjectDoc must contain at least one screen"
    });
  });

  it("rejects null ProjectDoc array entries without throwing", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Null Entries",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.assets = [null] as unknown as ProjectDoc["assets"];
    doc.styles = [null] as unknown as ProjectDoc["styles"];
    doc.events = [null] as unknown as ProjectDoc["events"];
    doc.screens[0].root.children = [null] as unknown as ProjectDoc["screens"][number]["root"]["children"];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "assets[0]",
      message: "Asset entry is required"
    });
    expect(result.errors).toContainEqual({
      path: "styles[0]",
      message: "Style entry is required"
    });
    expect(result.errors).toContainEqual({
      path: "events[0]",
      message: "Event entry is required"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0]",
      message: "Widget entry is required"
    });
  });

  it("rejects invalid target configuration", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.target = {
      lvglVersion: "9.0" as never,
      deviceName: "   ",
      width: 0,
      height: -1,
      dpi: 0,
      colorDepth: 24 as never
    };

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "target.lvglVersion",
      message: "Unsupported LVGL version: 9.0"
    });
    expect(result.errors).toContainEqual({
      path: "target.deviceName",
      message: "Target deviceName is required"
    });
    expect(result.errors).toContainEqual({
      path: "target.width",
      message: "Target width must be greater than 0"
    });
    expect(result.errors).toContainEqual({
      path: "target.colorDepth",
      message: "Target colorDepth must be 16 or 32"
    });
  });

  it("rejects non-numeric target dimensions and dpi", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Target Types",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.target = {
      lvglVersion: "8.3",
      deviceName: "ESP32-S3",
      width: "480",
      height: Number.NaN,
      dpi: Infinity,
      colorDepth: 16
    } as unknown as ProjectDoc["target"];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "target.width",
      message: "Target width must be a finite number"
    });
    expect(result.errors).toContainEqual({
      path: "target.height",
      message: "Target height must be a finite number"
    });
    expect(result.errors).toContainEqual({
      path: "target.dpi",
      message: "Target dpi must be a finite number"
    });
  });

  it("rejects a non-object target field", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Target Object",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.target = [] as unknown as ProjectDoc["target"];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "target",
      message: "ProjectDoc target must be an object"
    });
  });

  it("rejects a screen whose root is not a screen widget", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.type = "button";

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.type",
      message: "Screen root widget type must be screen"
    });
  });

  it("rejects duplicate screen ids and empty screen names", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens.push({
      id: "screen-1",
      name: "   ",
      root: {
        id: "root-screen-2",
        type: "screen",
        name: "Screen_2",
        parentId: null,
        children: [],
        layout: { x: 0, y: 0, width: 480, height: 480 },
        props: {},
        style: {},
        locked: false,
        hidden: false
      }
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[1].id",
      message: "Screen id must be unique: screen-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[1].name",
      message: "Screen name is required: screen-1"
    });
  });

  it("rejects unsupported widget types in the widget tree", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "bad-widget",
      type: "video" as never,
      name: "Video_1",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 0, y: 0, width: 100, height: 100 },
      props: {},
      style: {},
      locked: false,
      hidden: false
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].type",
      message: "Unsupported widget type: video"
    });
  });

  it("allows duplicate widget names within a screen because codegen makes symbols unique", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children = [
      {
        id: "label-1",
        type: "label",
        name: "Duplicate_Label",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 0, width: 100, height: 24 },
        props: { text: "A" },
        style: {},
        locked: false,
        hidden: false
      },
      {
        id: "label-2",
        type: "label",
        name: "Duplicate_Label",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 24, width: 100, height: 24 },
        props: { text: "B" },
        style: {},
        locked: false,
        hidden: false
      }
    ];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects empty widget names", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "label-1",
      type: "label",
      name: "   ",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 0, y: 0, width: 100, height: 24 },
      props: { text: "A" },
      style: {},
      locked: false,
      hidden: false
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].name",
      message: "Widget name is required: label-1"
    });
  });

  it("rejects invalid inline widget style values", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "label-1",
      type: "label",
      name: "Label_1",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 0, y: 0, width: 100, height: 24 },
      props: { text: "A" },
      style: {
        opacity: -1,
        radius: -2,
        letterSpace: -3,
        lineSpace: -4,
        padding: { top: 0, right: -1, bottom: 0, left: 0 },
        align: "middle" as never,
        blendMode: "screen" as unknown as ProjectDoc["screens"][number]["root"]["style"]["blendMode"]
      },
      locked: false,
      hidden: false
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.opacity",
      message: "Style opacity must be between 0 and 100: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.radius",
      message: "Style radius must be non-negative: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.letterSpace",
      message: "Style letterSpace must be non-negative: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.lineSpace",
      message: "Style lineSpace must be non-negative: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.padding.right",
      message: "Style padding must be non-negative: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.align",
      message: "Unsupported text align: middle"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.blendMode",
      message: "Unsupported blend mode: screen"
    });
  });

  it("rejects invalid widget container field types without throwing", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Widget Containers",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push(
      {
        id: "label-1",
        type: "label",
        name: "Label_1",
        parentId: "root-screen-1",
        children: {},
        layout: { x: 0, y: 0, width: 100, height: 24 },
        props: { text: "A" },
        style: {},
        locked: false,
        hidden: false
      } as unknown as ProjectDoc["screens"][number]["root"],
      {
        id: "label-2",
        type: "label",
        name: "Label_2",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 32, width: 100, height: 24 },
        props: "bad-props",
        style: {},
        locked: false,
        hidden: false
      } as unknown as ProjectDoc["screens"][number]["root"],
      {
        id: "label-3",
        type: "label",
        name: "Label_3",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 64, width: 100, height: 24 },
        props: { text: "A" },
        style: "bad-style",
        locked: false,
        hidden: false
      } as unknown as ProjectDoc["screens"][number]["root"]
    );

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].children",
      message: "Widget children must be an array: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[1].props",
      message: "Widget props must be an object: label-2"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[2].style",
      message: "Widget style must be an object: label-3"
    });
  });

  it("rejects invalid nested layout, flex and padding container field types", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Nested Containers",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push(
      {
        id: "label-1",
        type: "label",
        name: "Label_1",
        parentId: "root-screen-1",
        children: [],
        layout: "bad-layout",
        props: { text: "A" },
        style: {},
        locked: false,
        hidden: false
      } as unknown as ProjectDoc["screens"][number]["root"],
      {
        id: "label-2",
        type: "label",
        name: "Label_2",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 32, width: 100, height: 24, flex: "bad-flex" },
        props: { text: "B" },
        style: { padding: "bad-padding" },
        locked: false,
        hidden: false
      } as unknown as ProjectDoc["screens"][number]["root"]
    );

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].layout",
      message: "Widget layout must be an object: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[1].layout.flex",
      message: "Widget flex layout must be an object: label-2"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[1].style.padding",
      message: "Style padding must be an object: label-2"
    });
  });

  it("rejects non-numeric layout and style values plus non-boolean widget flags", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Field Types",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "label-1",
      type: "label",
      name: "Label_1",
      parentId: "root-screen-1",
      children: [],
      layout: { x: "0", y: Number.NaN, width: "100", height: Infinity },
      props: { text: "A" },
      style: {
        opacity: "100",
        radius: Number.NaN,
        letterSpace: "1",
        lineSpace: Infinity,
        padding: { top: "0", right: Number.NaN, bottom: "0", left: Infinity }
      },
      locked: "false",
      hidden: 0
    } as unknown as ProjectDoc["screens"][number]["root"]);

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].layout.x",
      message: "Widget x must be a finite number: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].layout.y",
      message: "Widget y must be a finite number: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].layout.width",
      message: "Widget width must be a finite number: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].layout.height",
      message: "Widget height must be a finite number: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.opacity",
      message: "Style opacity must be a finite number: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.padding.left",
      message: "Style padding must be a finite number: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].locked",
      message: "Widget locked must be a boolean: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].hidden",
      message: "Widget hidden must be a boolean: label-1"
    });
  });

  it("rejects fractional LVGL integer fields", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Fractional Widgets",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.layout.x = 0.5;
    doc.screens[0].root.layout.flex = { direction: "row", gap: 3.5, wrap: false };
    doc.screens[0].root.children.push({
      id: "chart-1",
      type: "chart",
      name: "Chart_1",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 10.5, y: 20, width: 160.5, height: 96 },
      props: { min: 0.5, max: 100, pointCount: 8.5, values: [10, 20.5] },
      style: {
        radius: 4.5,
        letterSpace: 1.5,
        lineSpace: 2.5,
        padding: { top: 1.5, right: 2, bottom: 3, left: 4 }
      },
      locked: false,
      hidden: false
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.layout.x",
      message: "Widget x must be an integer: root-screen-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.layout.flex.gap",
      message: "Flex gap must be an integer: root-screen-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].layout.width",
      message: "Widget width must be an integer: chart-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].props.pointCount",
      message: "Widget prop pointCount must be an integer: chart-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].props.values[1]",
      message: "Widget prop values must contain only integers: chart-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.radius",
      message: "Style radius must be an integer: chart-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.padding.top",
      message: "Style padding must be an integer: chart-1"
    });
  });

  it("rejects duplicate widget ids within a screen", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children = [
      {
        id: "label-1",
        type: "label",
        name: "Label_A",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 0, width: 100, height: 24 },
        props: { text: "A" },
        style: {},
        locked: false,
        hidden: false
      },
      {
        id: "label-1",
        type: "label",
        name: "Label_B",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 24, width: 100, height: 24 },
        props: { text: "B" },
        style: {},
        locked: false,
        hidden: false
      }
    ];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[1].id",
      message: "Widget id must be unique within a screen: label-1"
    });
  });

  it("rejects duplicate widget ids across screens", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens.push({
      id: "screen-2",
      name: "Screen_2",
      root: {
        id: "root-screen-2",
        type: "screen",
        name: "Screen_2",
        parentId: null,
        children: [
          {
            id: "root-screen-1",
            type: "label",
            name: "Label_1",
            parentId: "root-screen-2",
            children: [],
            layout: { x: 0, y: 0, width: 100, height: 24 },
            props: { text: "Duplicate id" },
            style: {},
            locked: false,
            hidden: false
          }
        ],
        layout: { x: 0, y: 0, width: 480, height: 480 },
        props: {},
        style: {},
        locked: false,
        hidden: false
      }
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[1].root.children[0].id",
      message: "Widget id must be unique across project: root-screen-1"
    });
  });

  it("rejects invalid widget-specific numeric props", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push(
      {
        id: "spinner-1",
        type: "spinner",
        name: "Spinner_1",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 0, width: 64, height: 64 },
        props: { spinTime: 0, arcLength: -1 },
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
        layout: { x: 0, y: 80, width: 160, height: 96 },
        props: { pointCount: 0 },
        style: {},
        locked: false,
        hidden: false
      },
      {
        id: "dropdown-1",
        type: "dropdown",
        name: "Dropdown_1",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 190, width: 160, height: 36 },
        props: { options: "One\nTwo", selected: -1 },
        style: {},
        locked: false,
        hidden: false
      },
      {
        id: "dropdown-2",
        type: "dropdown",
        name: "Dropdown_2",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 240, width: 160, height: 36 },
        props: { options: "One\nTwo", selected: 2 },
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
        layout: { x: 0, y: 290, width: 160, height: 24 },
        props: { min: 100, max: 10 },
        style: {},
        locked: false,
        hidden: false
      },
      {
        id: "bar-1",
        type: "bar",
        name: "Bar_1",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 330, width: 160, height: 24 },
        props: { min: 10, max: 20, value: 24 },
        style: {},
        locked: false,
        hidden: false
      },
      {
        id: "arc-1",
        type: "arc",
        name: "Arc_1",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 370, width: 80, height: 80 },
        props: { value: 120 },
        style: {},
        locked: false,
        hidden: false
      }
    );

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].props.spinTime",
      message: "Widget prop spinTime must be greater than 0: spinner-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].props.arcLength",
      message: "Widget prop arcLength must be greater than 0: spinner-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[1].props.pointCount",
      message: "Widget prop pointCount must be greater than 0: chart-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[2].props.selected",
      message: "Widget prop selected must be non-negative: dropdown-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[3].props.selected",
      message: "Widget prop selected must reference an available option: dropdown-2"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[4].props.max",
      message: "Widget prop max must be greater than min: slider-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[5].props.value",
      message: "Widget prop value must be between min and max: bar-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[6].props.value",
      message: "Widget prop value must be between min and max: arc-1"
    });
  });

  it("rejects widget-specific props with invalid types", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push(
      {
        id: "slider-1",
        type: "slider",
        name: "Slider_1",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 0, width: 160, height: 24 },
        props: { min: "0", max: 100, value: "50" },
        style: {},
        locked: false,
        hidden: false
      },
      {
        id: "switch-1",
        type: "switch",
        name: "Switch_1",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 40, width: 64, height: 32 },
        props: { checked: "true" },
        style: {},
        locked: false,
        hidden: false
      },
      {
        id: "label-1",
        type: "label",
        name: "Label_1",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 80, width: 120, height: 32 },
        props: { text: 123 },
        style: {},
        locked: false,
        hidden: false
      },
      {
        id: "image-1",
        type: "image",
        name: "Image_1",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 120, width: 96, height: 96 },
        props: { assetId: 123 },
        style: {},
        locked: false,
        hidden: false
      },
      {
        id: "dropdown-1",
        type: "dropdown",
        name: "Dropdown_1",
        parentId: "root-screen-1",
        children: [],
        layout: { x: 0, y: 230, width: 160, height: 40 },
        props: { text: 123, options: "Auto\nManual", selected: 0 },
        style: {},
        locked: false,
        hidden: false
      }
    );

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].props.min",
      message: "Widget prop min must be a number: slider-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].props.value",
      message: "Widget prop value must be a number: slider-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[1].props.checked",
      message: "Widget prop checked must be a boolean: switch-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[2].props.text",
      message: "Widget prop text must be a string: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[4].props.text",
      message: "Widget prop text must be a string: dropdown-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[3].props.assetId",
      message: "Widget prop assetId must be a string: image-1"
    });
  });

  it("accepts chart values as numeric data points", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Chart Values",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "chart-1",
      type: "chart",
      name: "Chart_1",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 0, y: 80, width: 160, height: 96 },
      props: { min: 0, max: 100, pointCount: 4, values: [10, 40, 80, 20] },
      style: {},
      locked: false,
      hidden: false
    });

    const propSchema = projectDocJsonSchema.$defs.WidgetNode.properties.props.additionalProperties;
    const result = validateProjectDoc(doc);

    expect(propSchema).toEqual({
      anyOf: [
        { type: "string" },
        { type: "integer" },
        { type: "boolean" },
        { type: "array", items: { type: "integer" } }
      ]
    });
    expect(result.valid).toBe(true);
  });

  it("rejects chart values that contain non-numeric data points", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Chart Values",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "chart-1",
      type: "chart",
      name: "Chart_1",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 0, y: 80, width: 160, height: 96 },
      props: { pointCount: 3, values: [10, "bad", 30] },
      style: {},
      locked: false,
      hidden: false
    } as ProjectDoc["screens"][number]["root"]);

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].props.values[1]",
      message: "Widget prop values must contain only finite numbers: chart-1"
    });
  });

  it("rejects duplicate reusable style ids", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.styles = [
      { id: "style-primary", name: "Primary", style: { bgColor: "#1e88ff" } },
      { id: "style-primary", name: "Primary Copy", style: { textColor: "#ffffff" } }
    ];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "styles[1].id",
      message: "Style id must be unique: style-primary"
    });
  });

  it("rejects invalid reusable style values", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.styles = [{
      id: "style-bad",
      name: "Bad",
      style: {
        opacity: 120,
        letterSpace: -1,
        lineSpace: -2,
        blendMode: "screen" as unknown as ProjectDoc["styles"][number]["style"]["blendMode"]
      }
    }];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "styles[0].style.opacity",
      message: "Style opacity must be between 0 and 100: style-bad"
    });
    expect(result.errors).toContainEqual({
      path: "styles[0].style.letterSpace",
      message: "Style letterSpace must be non-negative: style-bad"
    });
    expect(result.errors).toContainEqual({
      path: "styles[0].style.lineSpace",
      message: "Style lineSpace must be non-negative: style-bad"
    });
    expect(result.errors).toContainEqual({
      path: "styles[0].style.blendMode",
      message: "Unsupported blend mode: screen"
    });
  });

  it("rejects unknown layout and style fields", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Extra Fields",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.layout = {
      ...doc.screens[0].root.layout,
      flex: { direction: "row", gap: 4, wrap: "yes", justify: "center" } as never,
      unknownLayout: true
    } as never;
    doc.screens[0].root.style = {
      bgColor: "#101010",
      shadowColor: "#000000",
      padding: { top: 1, right: 2, bottom: 3, left: 4, start: 5 } as never
    } as never;
    doc.styles = [{
      id: "style-extra",
      name: "Extra",
      style: { textColor: "#ffffff", shadowColor: "#000000" } as never
    }];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.layout.unknownLayout",
      message: "Unsupported widget layout field: unknownLayout"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.layout.flex.justify",
      message: "Unsupported flex layout field: justify"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.layout.flex.wrap",
      message: "Flex wrap must be a boolean: root-screen-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.style.shadowColor",
      message: "Unsupported style field: shadowColor"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.style.padding.start",
      message: "Unsupported style padding field: start"
    });
    expect(result.errors).toContainEqual({
      path: "styles[0].style.shadowColor",
      message: "Unsupported style field: shadowColor"
    });
  });

  it("rejects invalid style color values", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.style.bgColor = "red";
    doc.styles = [{ id: "style-accent", name: "Accent", style: { textColor: "#12xx56" } }];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.style.bgColor",
      message: "Style bgColor must be a 3 or 6 digit hex color: root-screen-1"
    });
    expect(result.errors).toContainEqual({
      path: "styles[0].style.textColor",
      message: "Style textColor must be a 3 or 6 digit hex color: style-accent"
    });
  });

  it("rejects non-string style text fields", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Style Field Types",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.style = {
      bgColor: 123,
      textColor: false,
      borderColor: [],
      font: 42,
      align: 0
    } as unknown as ProjectDoc["screens"][number]["root"]["style"];
    doc.styles = [
      {
        id: "style-accent",
        name: "Accent",
        style: { font: 42, align: true } as unknown as ProjectDoc["styles"][number]["style"]
      }
    ];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.style.bgColor",
      message: "Style bgColor must be a string: root-screen-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.style.textColor",
      message: "Style textColor must be a string: root-screen-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.style.borderColor",
      message: "Style borderColor must be a string: root-screen-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.style.font",
      message: "Style font must be a string: root-screen-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.style.align",
      message: "Style align must be a string: root-screen-1"
    });
    expect(result.errors).toContainEqual({
      path: "styles[0].style.font",
      message: "Style font must be a string: style-accent"
    });
    expect(result.errors).toContainEqual({
      path: "styles[0].style.align",
      message: "Style align must be a string: style-accent"
    });
  });

  it("rejects reusable style fonts that reference missing font assets", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.styles = [{ id: "style-brand", name: "Brand", style: { font: "missing-font" } }];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "styles[0].style.font",
      message: "Font style references missing asset: missing-font"
    });
  });

  it("rejects reusable style fonts that reference non-font assets", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.assets.push({
      id: "image-asset",
      projectId: "project-1",
      name: "icon.png",
      kind: "image",
      mimeType: "image/png",
      width: 32,
      height: 32,
      sizeBytes: 128,
      objectKey: "projects/project-1/assets/image-asset/icon.png",
      createdAt: "2026-05-08T00:00:00Z"
    });
    doc.styles = [{ id: "style-brand", name: "Brand", style: { font: "image-asset" } }];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "styles[0].style.font",
      message: "Font style must reference a font asset: image-asset"
    });
  });

  it("rejects child widgets whose parentId does not match the tree parent", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "label-1",
      type: "label",
      name: "Label_A",
      parentId: "wrong-parent",
      children: [],
      layout: { x: 0, y: 0, width: 100, height: 24 },
      props: { text: "A" },
      style: {},
      locked: false,
      hidden: false
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].parentId",
      message: "Widget parentId must be root-screen-1"
    });
  });

  it("rejects invalid widget layout values", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "container-1",
      type: "container",
      name: "Container_1",
      parentId: "root-screen-1",
      children: [],
      layout: {
        x: 0,
        y: 0,
        width: 0,
        height: 100,
        align: "middle" as never,
        flex: { direction: "grid" as never, gap: -4, wrap: false }
      },
      props: {},
      style: {},
      locked: false,
      hidden: false
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].layout.width",
      message: "Widget width must be greater than 0: container-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].layout.align",
      message: "Unsupported widget align: middle"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].layout.flex.direction",
      message: "Unsupported flex direction: grid"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].layout.flex.gap",
      message: "Flex gap must be non-negative: container-1"
    });
  });

  it("rejects flex layout on widgets that cannot contain children", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Flex",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "label-1",
      type: "label",
      name: "Label_1",
      parentId: "root-screen-1",
      children: [],
      layout: {
        x: 0,
        y: 0,
        width: 120,
        height: 32,
        flex: { direction: "row", gap: 4, wrap: false }
      },
      props: { text: "Label" },
      style: {},
      locked: false,
      hidden: false
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].layout.flex",
      message: "Widget flex layout is only supported on screen and container widgets: label-1"
    });
  });

  it("rejects image widgets that reference missing assets", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
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

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].props.assetId",
      message: "Image widget references missing asset: missing-asset"
    });
  });

  it("rejects image widgets that reference non-image assets", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.assets.push({
      id: "font-asset",
      projectId: "project-1",
      name: "brand.ttf",
      kind: "font",
      mimeType: "font/ttf",
      sizeBytes: 2048,
      objectKey: "projects/project-1/assets/font-asset/brand.ttf",
      createdAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "image-1",
      type: "image",
      name: "Image_1",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 0, y: 0, width: 96, height: 96 },
      props: { assetId: "font-asset" },
      style: {},
      locked: false,
      hidden: false
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].props.assetId",
      message: "Image widget must reference an image asset: font-asset"
    });
  });

  it("rejects widget font styles that reference missing font assets", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "label-1",
      type: "label",
      name: "Label_1",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 0, y: 0, width: 120, height: 32 },
      props: { text: "A" },
      style: { font: "missing-font" },
      locked: false,
      hidden: false
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.font",
      message: "Font style references missing asset: missing-font"
    });
  });

  it("rejects widget font styles that reference non-font assets", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.assets.push({
      id: "image-asset",
      projectId: "project-1",
      name: "icon.png",
      kind: "image",
      mimeType: "image/png",
      width: 32,
      height: 32,
      sizeBytes: 128,
      objectKey: "projects/project-1/assets/image-asset/icon.png",
      createdAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "label-1",
      type: "label",
      name: "Label_1",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 0, y: 0, width: 120, height: 32 },
      props: { text: "A" },
      style: { font: "image-asset" },
      locked: false,
      hidden: false
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.font",
      message: "Font style must reference a font asset: image-asset"
    });
  });

  it("rejects invalid asset metadata", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.assets = [
      {
        id: "asset-1",
        projectId: "project-1",
        name: "icon.png",
        kind: "image",
        mimeType: "image/png",
        sizeBytes: 120,
        objectKey: "projects/project-1/assets/icon.png",
        createdAt: "2026-05-08T00:00:00Z"
      },
      {
        id: "asset-1",
        projectId: "other-project",
        name: "",
        kind: "audio" as never,
        mimeType: "",
        width: -16,
        height: -24,
        sizeBytes: -1,
        objectKey: "",
        createdAt: ""
      }
    ];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "assets[1].id",
      message: "Asset id must be unique: asset-1"
    });
    expect(result.errors).toContainEqual({
      path: "assets[1].projectId",
      message: "Asset projectId must match project id: asset-1"
    });
    expect(result.errors).toContainEqual({
      path: "assets[1].kind",
      message: "Unsupported asset kind: audio"
    });
    expect(result.errors).toContainEqual({
      path: "assets[1].width",
      message: "Asset width must be non-negative: asset-1"
    });
    expect(result.errors).toContainEqual({
      path: "assets[1].height",
      message: "Asset height must be non-negative: asset-1"
    });
    expect(result.errors).toContainEqual({
      path: "assets[1].sizeBytes",
      message: "Asset sizeBytes must be non-negative: asset-1"
    });
  });

  it("rejects asset object keys outside the owning project asset scope", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Wrong Asset Scope",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.assets = [
      {
        id: "asset-1",
        projectId: "project-1",
        name: "icon.png",
        kind: "image",
        mimeType: "image/png",
        sizeBytes: 120,
        objectKey: "projects/project-2/assets/asset-1/icon.png",
        createdAt: "2026-05-08T00:00:00Z"
      }
    ];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "assets[0].objectKey",
      message: "Asset objectKey must be under project asset scope: asset-1"
    });
  });

  it("rejects unsupported image asset MIME types", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Unsupported Image MIME",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.assets = [
      {
        id: "asset-1",
        projectId: "project-1",
        name: "animated.gif",
        kind: "image",
        mimeType: "image/gif",
        width: 16,
        height: 16,
        sizeBytes: 128,
        objectKey: "projects/project-1/assets/animated.gif",
        createdAt: "2026-05-08T00:00:00Z"
      }
    ];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "assets[0].mimeType",
      message: "Unsupported image asset mimeType: asset-1"
    });
  });

  it("rejects unsupported font asset MIME types", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Unsupported Font MIME",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.assets = [
      {
        id: "font-asset",
        projectId: "project-1",
        name: "brand.bin",
        kind: "font",
        mimeType: "application/octet-stream",
        sizeBytes: 128,
        objectKey: "projects/project-1/assets/brand.bin",
        createdAt: "2026-05-08T00:00:00Z"
      }
    ];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "assets[0].mimeType",
      message: "Unsupported font asset mimeType: font-asset"
    });
  });

  it("rejects non-numeric asset dimensions and sizes", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken Asset Types",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.assets = [
      {
        id: "asset-1",
        projectId: "project-1",
        name: "icon.png",
        kind: "image",
        mimeType: "image/png",
        width: "16",
        height: Number.NaN,
        sizeBytes: Infinity,
        objectKey: "projects/project-1/assets/icon.png",
        createdAt: "2026-05-08T00:00:00Z"
      } as unknown as ProjectDoc["assets"][number]
    ];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "assets[0].width",
      message: "Asset width must be a finite number: asset-1"
    });
    expect(result.errors).toContainEqual({
      path: "assets[0].height",
      message: "Asset height must be a finite number: asset-1"
    });
    expect(result.errors).toContainEqual({
      path: "assets[0].sizeBytes",
      message: "Asset sizeBytes must be a finite number: asset-1"
    });
  });

  it("rejects fractional asset dimensions and sizes", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Fractional Assets",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.assets = [
      {
        id: "asset-1",
        projectId: "project-1",
        name: "icon.png",
        kind: "image",
        mimeType: "image/png",
        width: 16.5,
        height: 24.5,
        sizeBytes: 128.5,
        objectKey: "projects/project-1/assets/icon.png",
        createdAt: "2026-05-08T00:00:00Z"
      }
    ];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "assets[0].width",
      message: "Asset width must be an integer: asset-1"
    });
    expect(result.errors).toContainEqual({
      path: "assets[0].height",
      message: "Asset height must be an integer: asset-1"
    });
    expect(result.errors).toContainEqual({
      path: "assets[0].sizeBytes",
      message: "Asset sizeBytes must be an integer: asset-1"
    });
  });

  it("rejects event bindings that reference missing widgets", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.events.push({
      id: "event-1",
      widgetId: "missing-widget",
      event: "LV_EVENT_CLICKED",
      handlerName: "on_missing_clicked"
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "events[0].widgetId",
      message: "Event binding references missing widget: missing-widget"
    });
  });

  it("rejects invalid event binding metadata", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.events.push({
      id: "",
      widgetId: "root-screen-1",
      event: "LV_EVENT_DELETE" as never,
      handlerName: "   "
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "events[0].id",
      message: "Event id is required"
    });
    expect(result.errors).toContainEqual({
      path: "events[0].event",
      message: "Unsupported event type: LV_EVENT_DELETE"
    });
    expect(result.errors).toContainEqual({
      path: "events[0].handlerName",
      message: "Event handlerName is required: events[0]"
    });
  });

  it("rejects duplicate event binding ids", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.events.push(
      {
        id: "event-1",
        widgetId: "root-screen-1",
        event: "LV_EVENT_READY",
        handlerName: "on_screen_ready"
      },
      {
        id: "event-1",
        widgetId: "root-screen-1",
        event: "LV_EVENT_CLICKED",
        handlerName: "on_screen_clicked"
      }
    );

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "events[1].id",
      message: "Event id must be unique: event-1"
    });
  });

  it("rejects event handlers that generate duplicate C callback symbols", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.events.push(
      {
        id: "event-1",
        widgetId: "root-screen-1",
        event: "LV_EVENT_READY",
        handlerName: "on-ready"
      },
      {
        id: "event-2",
        widgetId: "root-screen-1",
        event: "LV_EVENT_CLICKED",
        handlerName: "on_ready"
      }
    );

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "events[1].handlerName",
      message: "Event handlerName must generate a unique C callback symbol: on_ready"
    });
  });

  it("rejects event handlers that collide with generated widget C symbols", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "button-1",
      type: "button",
      name: "Start_Button",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 0, y: 0, width: 120, height: 48 },
      props: { text: "Start" },
      style: {},
      locked: false,
      hidden: false
    });
    doc.events.push({
      id: "event-1",
      widgetId: "button-1",
      event: "LV_EVENT_CLICKED",
      handlerName: "ui_Start_Button"
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "events[0].handlerName",
      message: "Event handlerName collides with generated C symbol: ui_Start_Button"
    });
  });

  it("rejects event handlers that collide with generated screen init C symbols", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.events.push({
      id: "event-1",
      widgetId: "root-screen-1",
      event: "LV_EVENT_READY",
      handlerName: "ui_Screen_1_screen_init"
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "events[0].handlerName",
      message: "Event handlerName collides with generated C symbol: ui_Screen_1_screen_init"
    });
  });

  it("rejects event handlers that collide with generated widget helper C symbols", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "Broken",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "chart-1",
      type: "chart",
      name: "Telemetry_Chart",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 0, y: 0, width: 160, height: 100 },
      props: { min: 0, max: 100, pointCount: 3, values: [10, 20, 30] },
      style: {},
      locked: false,
      hidden: false
    });
    doc.events.push({
      id: "event-1",
      widgetId: "chart-1",
      event: "LV_EVENT_READY",
      handlerName: "ui_Telemetry_Chart_series"
    });

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "events[0].handlerName",
      message: "Event handlerName collides with generated C symbol: ui_Telemetry_Chart_series"
    });
  });

  it("finds the active screen by id and falls back to the first screen", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });

    expect(getActiveScreen(doc, "screen-1")?.name).toBe("Screen_1");
    expect(getActiveScreen(doc, "missing")?.name).toBe("Screen_1");
  });

  it("defines the first-release LVGL widget catalog", () => {
    expect(widgetCatalog.map((widget) => widget.type)).toEqual([
      "button",
      "label",
      "image",
      "container",
      "chart",
      "arc",
      "bar",
      "spinner",
      "switch",
      "slider",
      "checkbox",
      "dropdown",
      "line"
    ]);
  });
});
