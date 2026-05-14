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

  it("rejects duplicate widget names within a screen", () => {
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

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[1].name",
      message: "Widget name must be unique within a screen: Duplicate_Label"
    });
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
        padding: { top: 0, right: -1, bottom: 0, left: 0 },
        align: "middle" as never
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
      path: "screens[0].root.children[0].style.padding.right",
      message: "Style padding must be non-negative: label-1"
    });
    expect(result.errors).toContainEqual({
      path: "screens[0].root.children[0].style.align",
      message: "Unsupported text align: middle"
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
        props: { selected: -1 },
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
        { type: "number" },
        { type: "boolean" },
        { type: "array", items: { type: "number" } }
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
    doc.styles = [{ id: "style-bad", name: "Bad", style: { opacity: 120 } }];

    const result = validateProjectDoc(doc);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: "styles[0].style.opacity",
      message: "Style opacity must be between 0 and 100: style-bad"
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
