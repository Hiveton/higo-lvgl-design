import { setActivePinia, createPinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultProjectDoc, validateProjectDoc } from "@hiveton-lvgl/schema";
import { clearAuthToken } from "../api/auth";
import { useProjectStore } from "./project";

describe("useProjectStore", () => {
  let storage: Record<string, string>;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const apiTimestamp = "2026-05-08T00:00:00Z";

  function apiProject(id: string, name: string, doc: unknown) {
    return {
      id,
      name,
      doc,
      createdAt: apiTimestamp,
      updatedAt: apiTimestamp
    };
  }

  function apiProjectDoc(id: string, name: string) {
    return createDefaultProjectDoc({
      id,
      name,
      updatedAt: apiTimestamp
    });
  }

  beforeEach(() => {
    setActivePinia(createPinia());
    storage = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        storage = {};
      })
    });
  });

  afterEach(() => {
    clearAuthToken();
    vi.unstubAllGlobals();
  });

  it("loads the seeded watch project and selects Time_Label", () => {
    const store = useProjectStore();

    expect(store.project.name).toBe("My Watch UI");
    expect(store.activeScreen?.name).toBe("Screen_1");
    expect(store.selectedWidget?.name).toBe("Time_Label");
    expect(store.selectedWidget?.props.text).toBe("10:09");
  });

  it("adds a widget from the catalog to the active screen and selects it", async () => {
    const store = useProjectStore();

    await store.addWidgetFromCatalog("label", { x: 24, y: 32 });

    expect(store.selectedWidget?.type).toBe("label");
    expect(store.selectedWidget?.name).toBe("Label_1");
    expect(store.selectedWidget?.layout).toMatchObject({ x: 24, y: 32, width: 120, height: 32 });
    expect(store.activeScreen?.root.children.some((widget) => widget.name === "Label_1")).toBe(true);
  });

  it("uses UUID ids for newly created widgets, screens and pasted widget trees", async () => {
    const store = useProjectStore();

    await store.addWidgetFromCatalog("label", { x: 24, y: 32 });
    const createdWidgetId = store.selectedWidget?.id;
    expect(createdWidgetId).toMatch(uuidPattern);

    await store.addScreen();
    expect(store.activeScreen?.id).toMatch(uuidPattern);
    expect(store.activeScreen?.root.id).toMatch(uuidPattern);

    store.selectWidget("time-label");
    store.copySelectedWidget();
    store.pasteCopiedWidget();
    expect(store.selectedWidget?.id).toMatch(uuidPattern);
  });

  it("exposes command history entries for the timeline", async () => {
    const store = useProjectStore();

    await store.addWidgetFromCatalog("label", { x: 24, y: 32 });
    expect(store.historyEntries).toContainEqual(
      expect.objectContaining({ label: "Add Label_1", status: "done" })
    );

    store.undo();
    expect(store.historyEntries).toContainEqual(
      expect.objectContaining({ label: "Add Label_1", status: "undone" })
    );

    store.redo();
    expect(store.historyEntries).toContainEqual(
      expect.objectContaining({ label: "Add Label_1", status: "done" })
    );
  });

  it("adds new widgets inside the selected container", async () => {
    const store = useProjectStore();

    await store.addWidgetFromCatalog("container", { x: 16, y: 24 });
    const container = store.selectedWidget;
    expect(container?.type).toBe("container");

    await store.addWidgetFromCatalog("label", { x: 8, y: 12 });

    const updatedContainer = store.activeScreen?.root.children.find((widget) => widget.id === container?.id);
    expect(updatedContainer?.children).toHaveLength(1);
    expect(updatedContainer?.children[0]).toMatchObject({
      type: "label",
      parentId: container?.id,
      layout: { x: 8, y: 12, width: 120, height: 32 }
    });
  });

  it("adds new widgets inside an explicit drop target container", async () => {
    const store = useProjectStore();

    await store.addWidgetFromCatalog("container", { x: 16, y: 24 });
    const containerId = store.selectedWidget!.id;
    store.selectWidget("time-label");
    await store.addWidgetFromCatalog("label", { x: 18, y: 20 }, { parentId: containerId });

    const container = store.activeScreen?.root.children.find((widget) => widget.id === containerId);
    expect(container?.children[0]).toMatchObject({
      type: "label",
      parentId: containerId,
      layout: { x: 18, y: 20, width: 120, height: 32 }
    });
  });

  it("copies and pastes the selected widget with unique ids and names", () => {
    const store = useProjectStore();

    store.selectWidget("time-label");
    store.copySelectedWidget();
    store.pasteCopiedWidget();

    expect(store.selectedWidget?.name).toBe("Time_Label_1");
    expect(store.selectedWidget?.id).not.toBe("time-label");
    expect(store.selectedWidget?.parentId).toBe("root-screen-1");
    expect(store.selectedWidget?.layout).toMatchObject({ x: 166, y: 56, width: 180, height: 56 });
    expect(store.selectedWidget?.props.text).toBe("10:09");
    expect(store.historyEntries).toContainEqual(
      expect.objectContaining({ label: "Add Time_Label_1", status: "done" })
    );

    store.undo();
    expect(store.activeScreen?.root.children.some((widget) => widget.name === "Time_Label_1")).toBe(false);
  });

  it("copies widget event bindings onto pasted widget ids", () => {
    const store = useProjectStore();

    store.addEventBinding("LV_EVENT_CLICKED", "on_time_clicked", "time-label");
    store.selectWidget("time-label");
    store.copySelectedWidget();
    store.pasteCopiedWidget();

    const pastedWidgetId = store.selectedWidget?.id;
    expect(store.project.events).toContainEqual({
      id: expect.stringMatching(uuidPattern),
      widgetId: pastedWidgetId,
      event: "LV_EVENT_CLICKED",
      handlerName: "on_time_clicked"
    });

    store.undo();
    expect(store.project.events).toEqual([
      expect.objectContaining({ widgetId: "time-label", handlerName: "on_time_clicked" })
    ]);
  });

  it("pastes copied widget event bindings from the clipboard snapshot", () => {
    const store = useProjectStore();

    store.addEventBinding("LV_EVENT_CLICKED", "on_time_clicked", "time-label");
    const copiedEventId = store.project.events[0].id;
    store.selectWidget("time-label");
    store.copySelectedWidget();
    store.removeEventBinding(copiedEventId);

    store.pasteCopiedWidget();

    const pastedWidgetId = store.selectedWidget?.id;
    expect(store.project.events).toContainEqual({
      id: expect.stringMatching(uuidPattern),
      widgetId: pastedWidgetId,
      event: "LV_EVENT_CLICKED",
      handlerName: "on_time_clicked"
    });
  });

  it("copies and pastes nested widgets with corrected child parent ids", async () => {
    const store = useProjectStore();

    await store.addWidgetFromCatalog("container", { x: 16, y: 24 });
    const containerId = store.selectedWidget!.id;
    await store.addWidgetFromCatalog("label", { x: 8, y: 12 });
    store.selectWidget(containerId);
    store.copySelectedWidget();
    store.pasteCopiedWidget();

    const pastedContainer = store.selectedWidget;
    expect(pastedContainer?.name).toBe("Container_1_1");
    expect(pastedContainer?.children[0]).toMatchObject({
      name: "Label_1_1",
      parentId: pastedContainer?.id,
      layout: { x: 24, y: 28, width: 120, height: 32 }
    });
  });

  it("duplicates selected widget event bindings onto the cloned widget id", () => {
    const store = useProjectStore();

    store.addEventBinding("LV_EVENT_CLICKED", "on_time_clicked", "time-label");
    store.selectWidget("time-label");
    store.duplicateSelectedWidget();

    const duplicatedWidgetId = store.selectedWidget?.id;
    expect(store.project.events).toContainEqual({
      id: expect.stringMatching(uuidPattern),
      widgetId: duplicatedWidgetId,
      event: "LV_EVENT_CLICKED",
      handlerName: "on_time_clicked"
    });
  });

  it("moves widgets from layers into containers", async () => {
    const store = useProjectStore();

    await store.addWidgetFromCatalog("container", { x: 16, y: 24 });
    const containerId = store.selectedWidget!.id;
    store.selectWidget("date-label");
    store.moveWidgetLayerDrop("date-label", containerId);

    const container = store.activeScreen?.root.children.find((widget) => widget.id === containerId);
    expect(container?.children[0]).toMatchObject({
      id: "date-label",
      parentId: containerId
    });
    expect(store.activeScreen?.root.children.some((widget) => widget.id === "date-label")).toBe(false);

    store.undo();
    expect(store.activeScreen?.root.children.some((widget) => widget.id === "date-label")).toBe(true);
  });

  it("updates selected text and can undo the change", () => {
    const store = useProjectStore();

    store.updateSelectedText("11:30");
    expect(store.selectedWidget?.props.text).toBe("11:30");

    store.undo();
    expect(store.selectedWidget?.props.text).toBe("10:09");
  });

  it("updates selected widget style and can undo the change", () => {
    const store = useProjectStore();

    store.updateSelectedStyle({
      textColor: "#00AEEF",
      bgColor: "#101820",
      radius: 12,
      opacity: 72,
      padding: { top: 4, right: 8, bottom: 4, left: 8 }
    });

    expect(store.selectedWidget?.style).toMatchObject({
      textColor: "#00AEEF",
      bgColor: "#101820",
      radius: 12,
      opacity: 72,
      padding: { top: 4, right: 8, bottom: 4, left: 8 }
    });

    store.undo();
    expect(store.selectedWidget?.style.textColor).toBe("#FFFFFF");
    expect(store.selectedWidget?.style.bgColor).toBeUndefined();
  });

  it("registers assets in ProjectDoc and binds an image asset to the selected widget", async () => {
    const store = useProjectStore();
    const asset = {
      id: "asset-1",
      projectId: "project-watch-demo",
      name: "icon_heart.png",
      kind: "image" as const,
      mimeType: "image/png",
      width: 32,
      height: 32,
      sizeBytes: 128,
      objectKey: "projects/project-watch-demo/assets/asset-1/icon_heart.png",
      createdAt: "2026-05-08T00:00:00Z"
    };

    store.registerAsset(asset);
    store.unregisterAsset("asset-1");
    expect(store.project.assets).toEqual([]);

    store.registerAsset(asset);
    await store.addWidgetFromCatalog("image", { x: 24, y: 32 });
    store.bindSelectedImageAsset("asset-1");

    expect(store.project.assets).toContainEqual(asset);
    expect(store.selectedWidget?.type).toBe("image");
    expect(store.selectedWidget?.props.assetId).toBe("asset-1");

    store.unregisterAsset("asset-1");
    expect(store.project.assets).toEqual([]);
    expect(store.selectedWidget?.props.assetId).toBeUndefined();

    store.undo();
    expect(store.project.assets).toContainEqual(asset);
    expect(store.selectedWidget?.props.assetId).toBe("asset-1");

    store.undo();
    expect(store.selectedWidget?.props.assetId).toBeUndefined();
  });

  it("replaces migrated asset ids across ProjectDoc assets and references", async () => {
    const store = useProjectStore();
    const localImage = {
      id: "local-heart",
      projectId: "project-watch-demo",
      name: "heart.png",
      kind: "image" as const,
      mimeType: "image/png",
      sizeBytes: 128,
      objectKey: "local://heart.png",
      createdAt: "2026-05-08T00:00:00Z"
    };
    const cloudImage = {
      ...localImage,
      id: "asset-heart-cloud",
      projectId: "project-1",
      objectKey: "projects/project-1/assets/asset-heart-cloud/heart.png"
    };
    const localFont = {
      id: "local-font",
      projectId: "project-watch-demo",
      name: "brand.ttf",
      kind: "font" as const,
      mimeType: "font/ttf",
      sizeBytes: 2048,
      objectKey: "local://brand.ttf",
      createdAt: "2026-05-08T00:00:00Z"
    };
    const cloudFont = {
      ...localFont,
      id: "asset-font-cloud",
      projectId: "project-1",
      objectKey: "projects/project-1/assets/asset-font-cloud/brand.ttf"
    };

    store.registerAsset(localImage);
    await store.addWidgetFromCatalog("image", { x: 24, y: 32 });
    store.bindSelectedImageAsset("local-heart");
    store.registerAsset(localFont);
    store.updateSelectedStyle({ font: "local-font" });
    store.addProjectStyle();
    store.updateProjectStyleText(store.project.styles[0]?.id, "font", "local-font");

    store.replaceAssetReference("local-heart", cloudImage);
    store.replaceAssetReference("local-font", cloudFont);

    expect(store.project.assets).not.toContainEqual(expect.objectContaining({ id: "local-heart" }));
    expect(store.project.assets).not.toContainEqual(expect.objectContaining({ id: "local-font" }));
    expect(store.project.assets).toContainEqual(cloudImage);
    expect(store.project.assets).toContainEqual(cloudFont);
    expect(store.selectedWidget?.props.assetId).toBe("asset-heart-cloud");
    expect(store.selectedWidget?.style.font).toBe("asset-font-cloud");
    expect(store.project.styles[0]?.style.font).toBe("asset-font-cloud");
  });

  it("does not bind non-image assets to image widgets", async () => {
    const store = useProjectStore();
    const fontAsset = {
      id: "font-1",
      projectId: "project-watch-demo",
      name: "watch_digits.ttf",
      kind: "font" as const,
      mimeType: "font/ttf",
      sizeBytes: 2048,
      objectKey: "projects/project-watch-demo/assets/font-1/watch_digits.ttf",
      createdAt: "2026-05-08T00:00:00Z"
    };

    store.registerAsset(fontAsset);
    await store.addWidgetFromCatalog("image", { x: 24, y: 32 });
    store.bindSelectedImageAsset("font-1");

    expect(store.selectedWidget?.type).toBe("image");
    expect(store.selectedWidget?.props.assetId).toBeUndefined();
  });

  it("removes font asset references from widget styles when unregistering an asset", () => {
    const store = useProjectStore();
    const fontAsset = {
      id: "font-1",
      projectId: "project-watch-demo",
      name: "watch_digits.ttf",
      kind: "font" as const,
      mimeType: "font/ttf",
      sizeBytes: 2048,
      objectKey: "projects/project-watch-demo/assets/font-1/watch_digits.ttf",
      createdAt: "2026-05-08T00:00:00Z"
    };

    store.registerAsset(fontAsset);
    store.updateSelectedStyle({ font: "font-1" });
    store.addProjectStyle();
    const styleId = store.project.styles[0]?.id;
    store.updateProjectStyleText(styleId, "font", "font-1");

    expect(store.project.assets).toContainEqual(fontAsset);
    expect(store.selectedWidget?.style.font).toBe("font-1");
    expect(store.project.styles[0]?.style.font).toBe("font-1");

    store.unregisterAsset("font-1");

    expect(store.project.assets).toEqual([]);
    expect(store.selectedWidget?.style.font).toBeUndefined();
    expect(store.project.styles[0]?.style.font).toBeUndefined();

    store.undo();
    expect(store.project.assets).toContainEqual(fontAsset);
    expect(store.selectedWidget?.style.font).toBe("font-1");
    expect(store.project.styles[0]?.style.font).toBe("font-1");
  });

  it("moves, resizes and deletes the selected widget", () => {
    const store = useProjectStore();

    store.moveSelectedWidget({ x: 200, y: 80 });
    expect(store.selectedWidget?.layout).toMatchObject({ x: 200, y: 80 });

    store.resizeSelectedWidget({ width: 220, height: 72 });
    expect(store.selectedWidget?.layout).toMatchObject({ width: 220, height: 72 });

    store.deleteSelectedWidget();
    expect(store.selectedWidget).toBeNull();
    expect(store.activeScreen?.root.children.some((widget) => widget.id === "time-label")).toBe(false);

    store.undo();
    expect(store.activeScreen?.root.children.some((widget) => widget.id === "time-label")).toBe(true);
  });

  it("toggles selected widget lock and hidden flags", () => {
    const store = useProjectStore();

    store.selectWidget("date-label");
    store.toggleWidgetHidden("date-label");
    expect(store.selectedWidget?.hidden).toBe(true);

    store.toggleWidgetLocked("date-label");
    expect(store.selectedWidget?.locked).toBe(true);

    store.updateSelectedLayout({ x: 220 });
    expect(store.selectedWidget?.layout.x).toBe(168);

    store.updateSelectedText("Locked text");
    expect(store.selectedWidget?.props.text).toBe("Wed, May 15");
  });

  it("keeps locked widgets from layer delete, reorder and reparent commands", () => {
    const store = useProjectStore();

    store.selectWidget("date-label");
    store.toggleWidgetLocked("date-label");

    store.deleteSelectedWidget();
    expect(store.activeScreen?.root.children.some((widget) => widget.id === "date-label")).toBe(true);

    store.reorderWidgetLayer("date-label", -1);
    expect(store.activeScreen?.root.children.map((widget) => widget.id).slice(0, 2)).toEqual(["time-label", "date-label"]);

    store.addWidgetFromCatalog("container", { x: 12, y: 16 });
    const containerId = store.selectedWidget?.id;
    expect(containerId).toBeTruthy();

    store.moveWidgetLayerDrop("date-label", containerId!);
    expect(store.activeScreen?.root.children.find((widget) => widget.id === "date-label")?.parentId).toBe("root-screen-1");
    expect(store.activeScreen?.root.children.find((widget) => widget.id === containerId)?.children).toEqual([]);
  });

  it("ignores layer reorder commands at sibling boundaries", () => {
    const store = useProjectStore();

    store.reorderWidgetLayer("time-label", -1);
    expect(store.historyEntries).toEqual([]);
    expect(store.activeScreen?.root.children.map((widget) => widget.id).slice(0, 2)).toEqual(["time-label", "date-label"]);

    store.reorderWidgetLayer("settings-button", 1);
    expect(store.historyEntries).toEqual([]);
    expect(store.activeScreen?.root.children.map((widget) => widget.id).slice(-2)).toEqual(["battery-metric", "settings-button"]);
  });

  it("allows unlocked widgets to reorder around locked siblings but not into locked containers", () => {
    const store = useProjectStore();

    store.toggleWidgetLocked("date-label");
    store.moveWidgetLayerDrop("start-button", "date-label");
    expect(store.activeScreen?.root.children.map((widget) => widget.id).slice(0, 3)).toEqual([
      "time-label",
      "start-button",
      "date-label"
    ]);

    store.addWidgetFromCatalog("container", { x: 12, y: 16 });
    const containerId = store.selectedWidget!.id;
    store.toggleWidgetLocked(containerId);
    store.moveWidgetLayerDrop("time-label", containerId);

    expect(store.activeScreen?.root.children.find((widget) => widget.id === containerId)?.children).toEqual([]);
    expect(store.activeScreen?.root.children.find((widget) => widget.id === "time-label")?.parentId).toBe("root-screen-1");
  });

  it("updates the target device configuration", () => {
    const store = useProjectStore();

    store.updateTarget({ width: 320, height: 240, dpi: 160, colorDepth: 32 });

    expect(store.project.target).toMatchObject({ width: 320, height: 240, dpi: 160, colorDepth: 32 });
    expect(store.activeScreen?.root.layout).toMatchObject({ width: 320, height: 240 });
  });

  it("keeps target and theme updates schema-valid when input is unsupported", () => {
    const store = useProjectStore();
    const initialTarget = { ...store.project.target };
    const initialRootLayout = { ...store.activeScreen!.root.layout };

    store.updateTarget({ lvglVersion: "9.0" as never });
    store.updateTarget({ deviceName: "   " });
    store.updateTarget({ width: 320.5 });
    store.updateTarget({ height: 0 });
    store.updateTarget({ dpi: -1 });
    store.updateTarget({ colorDepth: 24 as never });
    store.updateTheme("solarized" as never);

    expect(store.project.target).toEqual(initialTarget);
    expect(store.activeScreen?.root.layout).toEqual(initialRootLayout);
    expect(store.project.theme).toBe("dark");
    expect(validateProjectDoc(store.project).valid).toBe(true);
  });

  it("renames project, active screen and selected widget", async () => {
    const store = useProjectStore();

    store.renameProject("Demo Panel");
    await store.renameScreen("screen-1", "Main_Screen");
    store.renameWidget("time-label", "Clock_Label");

    expect(store.project.name).toBe("Demo Panel");
    expect(store.activeScreen?.name).toBe("Main_Screen");
    expect(store.selectedWidget?.name).toBe("Clock_Label");
  });

  it("keeps widget names unique when renaming", () => {
    const store = useProjectStore();

    store.renameWidget("date-label", "Time_Label");

    expect(store.activeScreen?.root.children.find((widget) => widget.id === "time-label")?.name).toBe("Time_Label");
    expect(store.activeScreen?.root.children.find((widget) => widget.id === "date-label")?.name).toBe("Time_Label_1");
  });

  it("updates project theme", () => {
    const store = useProjectStore();

    store.updateTheme("light");

    expect(store.project.theme).toBe("light");

    store.undo();
    expect(store.project.theme).toBe("dark");
  });

  it("manages reusable project styles and applies them to the selected widget", () => {
    const store = useProjectStore();

    store.selectWidget("start-button");
    store.addProjectStyle();

    const styleId = store.project.styles[0]?.id;
    expect(styleId).toMatch(uuidPattern);
    expect(store.project.styles[0]).toMatchObject({
      name: "Style_1",
      style: {
        bgColor: "#2fbf9b",
        textColor: "#FFFFFF",
        radius: 8,
        opacity: 100
      }
    });

    store.renameProjectStyle(styleId, "Primary Button");
    store.updateProjectStyleText(styleId, "bgColor", "#123456");
    store.updateProjectStyleText(styleId, "textColor", "#F8FAFC");
    store.updateProjectStyleText(styleId, "borderColor", "#C084FC");
    store.updateProjectStyleText(styleId, "font", "lv_font_montserrat_32");
    store.updateProjectStyleText(styleId, "align", "right");
    store.updateProjectStyleNumber(styleId, "radius", "14");
    store.updateProjectStyleNumber(styleId, "letterSpace", "2");
    store.updateProjectStyleNumber(styleId, "lineSpace", "4");
    store.updateProjectStylePaddingSide(styleId, "top", "6");
    store.updateProjectStylePaddingSide(styleId, "right", "8");
    store.updateProjectStylePaddingSide(styleId, "bottom", "10");
    store.updateProjectStylePaddingSide(styleId, "left", "12");
    store.applyProjectStyleToSelectedWidget(styleId);

    expect(store.project.styles[0]).toMatchObject({
      id: styleId,
      name: "Primary Button",
      style: {
        bgColor: "#123456",
        textColor: "#F8FAFC",
        borderColor: "#C084FC",
        font: "lv_font_montserrat_32",
        align: "right",
        radius: 14,
        letterSpace: 2,
        lineSpace: 4,
        padding: { top: 6, right: 8, bottom: 10, left: 12 },
        opacity: 100
      }
    });
    expect(store.selectedWidget?.style).toMatchObject({
      bgColor: "#123456",
      textColor: "#F8FAFC",
      borderColor: "#C084FC",
      font: "lv_font_montserrat_32",
      align: "right",
      radius: 14,
      letterSpace: 2,
      lineSpace: 4,
      padding: { top: 6, right: 8, bottom: 10, left: 12 },
      opacity: 100
    });

    store.deleteProjectStyle(styleId);
    expect(store.project.styles).toHaveLength(0);

    store.undo();
    expect(store.project.styles[0]?.name).toBe("Primary Button");
  });

  it("keeps reusable project style updates schema-valid when input is unsupported", () => {
    const store = useProjectStore();
    store.addProjectStyle();
    const styleId = store.project.styles[0]?.id;
    const initialStyle = { ...store.project.styles[0]?.style };

    store.updateProjectStyleText(styleId, "bgColor", "red");
    store.updateProjectStyleText(styleId, "textColor", "white");
    store.updateProjectStyleText(styleId, "borderColor", "#12345");
    store.updateProjectStyleText(styleId, "font", "missing-font");
    expect(() => store.updateProjectStyleText(styleId, "font", 42 as never)).not.toThrow();
    store.updateProjectStyleText(styleId, "align", "justify");
    store.updateProjectStyleText(styleId, "blendMode", "screen");
    store.updateProjectStyleText(styleId, "unsupportedToken" as never, "normal");
    store.updateProjectStyleNumber(styleId, "unsupportedNumber" as never, "4");
    store.updateProjectStylePaddingSide(styleId, "start" as never, "6");

    expect(store.project.styles[0]?.style).toMatchObject(initialStyle);
    expect(store.project.styles[0]?.style).not.toHaveProperty("unsupportedToken");
    expect(store.project.styles[0]?.style).not.toHaveProperty("unsupportedNumber");
    expect(store.project.styles[0]?.style.padding).toBeUndefined();
    expect(validateProjectDoc(store.project).valid).toBe(true);
  });

  it("adds, switches and deletes screens while keeping one screen", async () => {
    const store = useProjectStore();

    await store.addScreen();
    await store.addWidgetFromCatalog("label", { x: 24, y: 32 });
    store.addEventBinding("LV_EVENT_CLICKED", "on_screen_2_label_clicked");
    expect(store.project.events).toHaveLength(1);

    expect(store.project.screens.map((screen) => screen.name)).toEqual(["Screen_1", "Screen_2"]);
    expect(store.activeScreen?.name).toBe("Screen_2");
    const secondScreenId = store.activeScreen!.id;

    await store.switchScreen("screen-1");
    expect(store.activeScreen?.name).toBe("Screen_1");

    await store.deleteScreen(secondScreenId);
    expect(store.project.screens.map((screen) => screen.name)).toEqual(["Screen_1"]);
    expect(store.activeScreen?.name).toBe("Screen_1");
    expect(store.project.events).toEqual([]);

    await store.deleteScreen(store.activeScreen!.id);
    expect(store.project.screens).toHaveLength(1);
  });

  it("adds screens with unique ids after deleting a middle screen", async () => {
    const store = useProjectStore();

    await store.addScreen();
    await store.addScreen();
    const secondScreenId = store.project.screens[1].id;
    const thirdScreenId = store.project.screens[2].id;
    expect(store.project.screens.map((screen) => screen.id)).toEqual(["screen-1", secondScreenId, thirdScreenId]);
    expect(secondScreenId).toMatch(uuidPattern);
    expect(thirdScreenId).toMatch(uuidPattern);

    await store.deleteScreen(secondScreenId);
    await store.addScreen();
    const fourthScreenId = store.project.screens[2].id;

    expect(store.project.screens.map((screen) => screen.id)).toEqual(["screen-1", thirdScreenId, fourthScreenId]);
    expect(fourthScreenId).toMatch(uuidPattern);
    expect(new Set(store.project.screens.map((screen) => screen.id)).size).toBe(3);
    expect(store.project.screens.map((screen) => screen.root.id)[0]).toBe("root-screen-1");
    expect(store.project.screens.slice(1).map((screen) => screen.root.id)).toEqual([
      expect.stringMatching(uuidPattern),
      expect.stringMatching(uuidPattern)
    ]);
    expect(store.project.screens.map((screen) => screen.name)).toEqual(["Screen_1", "Screen_3", "Screen_4"]);
  });

  it("switches to the adjacent screen after deleting the active screen", async () => {
    const store = useProjectStore();

    await store.addScreen();
    await store.addScreen();
    expect(store.project.screens.map((screen) => screen.name)).toEqual(["Screen_1", "Screen_2", "Screen_3"]);
    const secondScreenId = store.project.screens[1].id;
    const thirdScreenId = store.project.screens[2].id;

    await store.switchScreen(secondScreenId);
    await store.deleteScreen(secondScreenId);
    expect(store.activeScreen?.id).toBe(thirdScreenId);

    await store.deleteScreen(thirdScreenId);
    expect(store.activeScreen?.id).toBe("screen-1");
  });

  it("duplicates the active screen with unique screen and widget ids", async () => {
    const store = useProjectStore();

    await store.duplicateScreen("screen-1");

    expect(store.project.screens).toHaveLength(2);
    expect(store.activeScreen?.name).toBe("Screen_1_1");
    expect(store.activeScreen?.id).not.toBe("screen-1");
    expect(store.activeScreen?.root.id).not.toBe("root-screen-1");
    expect(store.activeScreen?.root.children[0].id).not.toBe("time-label");
    expect(store.activeScreen?.root.children[0].parentId).toBe(store.activeScreen?.root.id);
  });

  it("duplicates screen event bindings onto the cloned widget ids", async () => {
    const store = useProjectStore();

    store.addEventBinding("LV_EVENT_CLICKED", "on_time_clicked", "time-label");
    await store.duplicateScreen("screen-1");

    const clonedTimeLabelId = store.activeScreen?.root.children.find((widget) => widget.name === "Time_Label_1")?.id;
    expect(clonedTimeLabelId).toBeTruthy();
    expect(store.project.events).toContainEqual({
      id: expect.stringMatching(uuidPattern),
      widgetId: clonedTimeLabelId,
      event: "LV_EVENT_CLICKED",
      handlerName: "on_time_clicked"
    });
  });

  it("keeps document-level edits in undo and redo history", async () => {
    const store = useProjectStore();

    store.renameProject("Renamed UI");
    store.updateTarget({ width: 320, height: 240 });
    await store.addScreen();
    await store.renameScreen(store.activeScreen!.id, "Settings");

    expect(store.project.name).toBe("Renamed UI");
    expect(store.project.target).toMatchObject({ width: 320, height: 240 });
    expect(store.project.screens.map((screen) => screen.name)).toEqual(["Screen_1", "Settings"]);

    store.undo();
    expect(store.project.screens.map((screen) => screen.name)).toEqual(["Screen_1", "Screen_2"]);

    store.undo();
    expect(store.project.screens.map((screen) => screen.name)).toEqual(["Screen_1"]);

    store.undo();
    expect(store.project.target).toMatchObject({ width: 480, height: 480 });

    store.undo();
    expect(store.project.name).toBe("My Watch UI");

    store.redo();
    expect(store.project.name).toBe("Renamed UI");
  });

  it("adds normalized event bindings for selected or target widgets", () => {
    const store = useProjectStore();

    store.addEventBinding("LV_EVENT_CLICKED", "on time clicked!");
    const timeEventId = store.project.events[0].id;
    expect(store.project.events).toContainEqual({
      id: expect.stringMatching(uuidPattern),
      widgetId: "time-label",
      event: "LV_EVENT_CLICKED",
      handlerName: "on_time_clicked"
    });

    store.addEventBinding("LV_EVENT_READY", "123 ready", "date-label");
    const dateEventId = store.project.events[1].id;
    expect(store.project.events).toContainEqual({
      id: expect.stringMatching(uuidPattern),
      widgetId: "date-label",
      event: "LV_EVENT_READY",
      handlerName: "handler_123_ready"
    });

    store.removeEventBinding(timeEventId);
    expect(store.project.events.map((event) => event.id)).toEqual([dateEventId]);

    store.undo();
    expect(store.project.events.map((event) => event.id)).toEqual([
      timeEventId,
      dateEventId
    ]);

    store.undo();
    expect(store.project.events.map((event) => event.id)).toEqual([timeEventId]);

    store.redo();
    expect(store.project.events.map((event) => event.id)).toEqual([
      timeEventId,
      dateEventId
    ]);
  });

  it("keeps added event handler names from colliding with generated C symbols", () => {
    const store = useProjectStore();

    store.addEventBinding("LV_EVENT_CLICKED", "ui_Time_Label", "time-label");

    expect(store.project.events).toContainEqual({
      id: expect.stringMatching(uuidPattern),
      widgetId: "time-label",
      event: "LV_EVENT_CLICKED",
      handlerName: "handler_ui_Time_Label"
    });
    expect(validateProjectDoc(store.project).valid).toBe(true);
  });

  it("checks event handler candidates with a non-conflicting temporary event id", () => {
    const store = useProjectStore();

    store.addEventBinding("LV_EVENT_READY", "existing_handler", "date-label");
    store.project.events[0].id = "candidate-event";
    store.addEventBinding("LV_EVENT_CLICKED", "ui_Time_Label", "time-label");

    expect(store.project.events).toContainEqual(expect.objectContaining({
      widgetId: "time-label",
      event: "LV_EVENT_CLICKED",
      handlerName: "handler_ui_Time_Label"
    }));
    expect(validateProjectDoc(store.project).valid).toBe(true);
  });

  it("keeps screen root event handlers from colliding with generated screen init symbols", () => {
    const store = useProjectStore();

    store.addEventBinding("LV_EVENT_READY", "ui_Screen_1_screen_init", "root-screen-1");

    expect(store.project.events).toContainEqual(expect.objectContaining({
      widgetId: "root-screen-1",
      event: "LV_EVENT_READY",
      handlerName: "handler_ui_Screen_1_screen_init"
    }));
    expect(validateProjectDoc(store.project).valid).toBe(true);
  });

  it("keeps event handlers from colliding with generated widget helper symbols", async () => {
    const store = useProjectStore();
    await store.addWidgetFromCatalog("chart", { x: 24, y: 32 });
    const chartId = store.selectedWidget?.id;

    store.addEventBinding("LV_EVENT_READY", "ui_Chart_1_series", chartId);

    expect(store.project.events).toContainEqual(expect.objectContaining({
      widgetId: chartId,
      event: "LV_EVENT_READY",
      handlerName: "handler_ui_Chart_1_series"
    }));
    expect(validateProjectDoc(store.project).valid).toBe(true);
  });

  it("keeps event binding updates schema-valid when input is unsupported", () => {
    const store = useProjectStore();

    store.addEventBinding("LV_EVENT_DELETE" as never, "on_delete", "time-label");

    expect(store.project.events).toEqual([]);
    expect(validateProjectDoc(store.project).valid).toBe(true);
  });

  it("replaces an existing event binding for the same widget and event", () => {
    const store = useProjectStore();

    store.addEventBinding("LV_EVENT_CLICKED", "on_time_clicked", "time-label");
    const firstEventId = store.project.events[0].id;
    store.addEventBinding("LV_EVENT_CLICKED", "on_time_clicked_again", "time-label");

    expect(store.project.events).toEqual([
      {
        id: expect.stringMatching(uuidPattern),
        widgetId: "time-label",
        event: "LV_EVENT_CLICKED",
        handlerName: "on_time_clicked_again"
      }
    ]);
    expect(store.project.events[0].id).not.toBe(firstEventId);
  });

  it("keeps locked widgets from event binding edits", () => {
    const store = useProjectStore();

    store.toggleWidgetLocked("time-label");
    store.addEventBinding("LV_EVENT_CLICKED", "on_locked_clicked", "time-label");
    expect(store.project.events).toEqual([]);

    store.toggleWidgetLocked("time-label");
    store.addEventBinding("LV_EVENT_CLICKED", "on_time_clicked", "time-label");
    expect(store.project.events).toHaveLength(1);
    const eventId = store.project.events[0].id;

    store.toggleWidgetLocked("time-label");
    store.removeEventBinding(eventId);
    expect(store.project.events).toHaveLength(1);
  });

  it("keeps the seeded ProjectDoc local when saving without a login", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    store.updateSelectedText("11:30");
    const saved = await store.saveProject();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(saved).toBe(true);
    expect(store.saveState).toBe("saved");
  });

  it("tracks dirty state across edits, successful saves and failed saves", async () => {
    const store = useProjectStore();

    expect(store.dirty).toBe(false);
    store.updateSelectedText("11:30");
    expect(store.dirty).toBe(true);

    await expect(store.saveProject()).resolves.toBe(true);
    expect(store.dirty).toBe(false);

    storage["lvgl-editor-token"] = "demo-token";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "SAVE_FAILED", message: "save failed" } }), { status: 500 })
    );
    vi.stubGlobal("fetch", fetchMock);
    await store.createCloudProject("Cloud UI").catch(() => undefined);
    store.updateSelectedText("12:45");
    await expect(store.saveProject()).resolves.toBe(false);
    expect(store.dirty).toBe(true);
  });

  it("keeps dirty state when the user edits while an existing cloud project save is in flight", async () => {
    storage["lvgl-editor-token"] = "demo-token";
    let resolveSave: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects/project-1" && (!init || init.method === undefined || init.method === "GET")) {
        return Promise.resolve(new Response(JSON.stringify({
          project: apiProject(
            "project-1",
            "Cloud UI",
            {
              ...useProjectStore().project,
              id: "project-1",
              updatedAt: "2026-05-08T00:00:00Z"
            }
          )
        }), { status: 200 }));
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        return new Promise<Response>((resolve) => {
          resolveSave = resolve;
        });
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();
    await store.openProject("project-1");
    fetchMock.mockClear();

    store.updateSelectedText("11:30");
    const savePromise = store.saveProject();
    store.updateSelectedText("12:45");
    resolveSave?.(new Response(JSON.stringify({ projectId: "project-1", updatedAt: "2026-05-08T00:00:01Z" }), { status: 200 }));

    await expect(savePromise).resolves.toBe(true);
    expect(store.selectedWidget?.props.text).toBe("12:45");
    expect(store.dirty).toBe(true);
    expect(store.saveState).toBe("saved");
  });

  it("does not apply an old cloud save result after another project becomes active", async () => {
    storage["lvgl-editor-token"] = "demo-token";
    let resolveSave: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects/project-1" && (!init || init.method === undefined || init.method === "GET")) {
        return Promise.resolve(new Response(JSON.stringify({
          project: apiProject("project-1", "Project One", apiProjectDoc("project-1", "Project One"))
        }), { status: 200 }));
      }
      if (url === "/api/projects/project-2" && (!init || init.method === undefined || init.method === "GET")) {
        return Promise.resolve(new Response(JSON.stringify({
          project: apiProject("project-2", "Project Two", apiProjectDoc("project-2", "Project Two"))
        }), { status: 200 }));
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        return new Promise<Response>((resolve) => {
          resolveSave = resolve;
        });
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();
    await store.openProject("project-1");

    store.updateSelectedText("11:30");
    const savePromise = store.saveProject();
    await vi.waitFor(() => expect(resolveSave).toBeDefined());
    await store.openProject("project-2");
    resolveSave?.(new Response(JSON.stringify({ projectId: "project-1", updatedAt: "2026-05-08T00:00:01Z" }), { status: 200 }));

    await expect(savePromise).resolves.toBe(false);
    expect(store.project.id).toBe("project-2");
    expect(store.project.updatedAt).toBe(apiTimestamp);
    expect(store.dirty).toBe(false);
    expect(store.saveState).toBe("saved");
  });

  it("keeps edits made while the first cloud save is in flight", async () => {
    storage["lvgl-editor-token"] = "demo-token";
    let resolveSave: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({
          project: apiProject("project-1", "My Watch UI", apiProjectDoc("project-1", "My Watch UI"))
        }), { status: 201 }));
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        return new Promise<Response>((resolve) => {
          resolveSave = resolve;
        });
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    store.updateSelectedText("11:30");
    const savePromise = store.saveProject();
    await vi.waitFor(() => expect(resolveSave).toBeDefined());
    store.updateSelectedText("12:45");
    resolveSave?.(new Response(JSON.stringify({ projectId: "project-1", updatedAt: "2026-05-08T00:00:01Z" }), { status: 200 }));

    await expect(savePromise).resolves.toBe(true);
    expect(store.project.id).toBe("project-1");
    expect(store.selectedWidget?.props.text).toBe("12:45");
    expect(store.dirty).toBe(true);
  });

  it("marks the project dirty when undo or redo changes a saved document", async () => {
    const store = useProjectStore();

    store.updateSelectedText("11:30");
    await expect(store.saveProject()).resolves.toBe(true);
    expect(store.dirty).toBe(false);

    store.undo();
    expect(store.dirty).toBe(true);

    await expect(store.saveProject()).resolves.toBe(true);
    expect(store.dirty).toBe(false);

    store.redo();
    expect(store.dirty).toBe(true);
  });

  it("creates a cloud project when saving the seeded local ProjectDoc with a login", async () => {
    storage["lvgl-editor-token"] = "demo-token";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          project: apiProject("project-1", "My Watch UI", apiProjectDoc("project-1", "My Watch UI"))
        }), { status: 201 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ projectId: "project-1", updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    const saved = await store.saveProject();

    expect(saved).toBe(true);
    expect(store.project.id).toBe("project-1");
    expect(store.saveState).toBe("saved");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/projects", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/projects/project-1/doc", expect.any(Object));
  });

  it("rewrites asset project ids when the first cloud save migrates a local ProjectDoc", async () => {
    storage["lvgl-editor-token"] = "demo-token";
    const savedDocs: unknown[] = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({
          project: apiProject("project-1", "My Watch UI", apiProjectDoc("project-1", "My Watch UI"))
        }), { status: 201 }));
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        savedDocs.push(JSON.parse(String(init.body)).doc);
        return Promise.resolve(new Response(JSON.stringify({ projectId: "project-1", updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 }));
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();
    store.registerAsset({
      id: "local-heart",
      projectId: "project-watch-demo",
      name: "heart.png",
      kind: "image",
      mimeType: "image/png",
      width: 32,
      height: 32,
      sizeBytes: 128,
      objectKey: "local://heart.png",
      createdAt: "2026-05-08T00:00:00Z"
    });

    const saved = await store.saveProject();

    expect(saved).toBe(true);
    expect(store.project.id).toBe("project-1");
    expect(store.project.assets[0]).toMatchObject({ id: "local-heart", projectId: "project-1" });
    expect(savedDocs).toHaveLength(1);
    expect(savedDocs[0]).toMatchObject({ id: "project-1", assets: [expect.objectContaining({ projectId: "project-1" })] });
  });

  it("directly creates a cloud project for logged-in seeded ProjectDoc saves without a failing seed PUT", async () => {
    storage["lvgl-editor-token"] = "demo-token";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          project: apiProject("project-1", "My Watch UI", apiProjectDoc("project-1", "My Watch UI"))
        }), { status: 201 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ projectId: "project-1", updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    const saved = await store.saveProject();

    expect(saved).toBe(true);
    expect(store.project.id).toBe("project-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/projects", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/projects/project-1/doc", expect.any(Object));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/projects/project-watch-demo/doc", expect.any(Object));
  });

  it("keeps the active selection when first save migrates the seeded ProjectDoc to a cloud project", async () => {
    storage["lvgl-editor-token"] = "demo-token";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          project: apiProject("project-1", "My Watch UI", apiProjectDoc("project-1", "My Watch UI"))
        }), { status: 201 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ projectId: "project-1", updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    await store.addWidgetFromCatalog("image", { x: 32, y: 32 });
    const selectedBeforeSave = store.selectedWidget?.id;
    const saved = await store.saveProject();

    expect(saved).toBe(true);
    expect(store.project.id).toBe("project-1");
    expect(store.selectedWidget?.id).toBe(selectedBeforeSave);
    expect(store.selectedWidget?.type).toBe("image");
  });

  it("blocks save when ProjectDoc validation fails", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    await store.addWidgetFromCatalog("image", { x: 0, y: 0 });
    store.updateSelectedProps({ assetId: "missing-asset" });
    const saved = await store.saveProject();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(saved).toBe(false);
    expect(store.saveState).toBe("failed");
    expect(store.validationErrors[0]?.message).toBe("Image widget references missing asset: missing-asset");
  });

  it("syncs ProjectDoc updatedAt after saving an existing cloud project", async () => {
    storage["lvgl-editor-token"] = "demo-token";
    const returnedDoc = {
      schemaVersion: 1,
      id: "project-2",
      name: "Cloud UI",
      target: { lvglVersion: "8.3", deviceName: "ESP32-S3", width: 480, height: 480, dpi: 240, colorDepth: 16 },
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
      updatedAt: "2026-05-08T00:00:00Z"
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: apiProject("project-2", "Cloud UI", returnedDoc) }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projectId: "project-2", updatedAt: "2026-05-13T10:00:00Z" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    await store.openProject("project-2");
    const saved = await store.saveProject();

    expect(saved).toBe(true);
    expect(store.project.updatedAt).toBe("2026-05-13T10:00:00Z");
  });

  it("loads project list, creates a project and opens a project document", async () => {
    const returnedDoc = {
      schemaVersion: 1,
      id: "project-2",
      name: "New UI",
      target: { lvglVersion: "8.3", deviceName: "ESP32-S3", width: 480, height: 480, dpi: 240, colorDepth: 16 },
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
      updatedAt: "2026-05-08T00:00:00Z"
    };
    const listedDoc = {
      ...returnedDoc,
      id: "project-1",
      name: "My Watch UI"
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [apiProject("project-1", "My Watch UI", listedDoc)] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: apiProject("project-2", "New UI", returnedDoc) }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: apiProject("project-2", "New UI", returnedDoc) }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    await store.loadProjects();
    expect(store.projects).toMatchObject([{ id: "project-1", name: "My Watch UI" }]);

    await store.createCloudProject("New UI");
    expect(store.project.name).toBe("New UI");
    expect(localStorage.getItem("lvgl-editor-last-project-id")).toBe("project-2");

    await store.openProject("project-2");
    expect(store.project.id).toBe("project-2");
    expect(store.activeScreen?.name).toBe("Screen_1");
  });

  it("keeps the latest opened project when open requests resolve out of order", async () => {
    let resolveProjectOne: (response: Response) => void = () => undefined;
    let resolveProjectTwo: (response: Response) => void = () => undefined;
    const projectOneResponse = new Promise<Response>((resolve) => {
      resolveProjectOne = resolve;
    });
    const projectTwoResponse = new Promise<Response>((resolve) => {
      resolveProjectTwo = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/projects/project-1") {
        return projectOneResponse;
      }
      if (url === "/api/projects/project-2") {
        return projectTwoResponse;
      }
      return Promise.reject(new Error(`unexpected request ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    const firstOpen = store.openProject("project-1");
    const secondOpen = store.openProject("project-2");
    resolveProjectTwo(new Response(JSON.stringify({
      project: apiProject("project-2", "Project Two", apiProjectDoc("project-2", "Project Two"))
    }), { status: 200 }));
    await expect(secondOpen).resolves.toBe(true);

    expect(store.project.id).toBe("project-2");
    expect(store.project.name).toBe("Project Two");
    expect(localStorage.getItem("lvgl-editor-last-project-id")).toBe("project-2");

    resolveProjectOne(new Response(JSON.stringify({
      project: apiProject("project-1", "Project One", apiProjectDoc("project-1", "Project One"))
    }), { status: 200 }));
    await expect(firstOpen).resolves.toBe(false);

    expect(store.project.id).toBe("project-2");
    expect(store.project.name).toBe("Project Two");
    expect(localStorage.getItem("lvgl-editor-last-project-id")).toBe("project-2");
  });

  it("keeps the latest created cloud project when create requests resolve out of order", async () => {
    let resolveProjectOne: (response: Response) => void = () => undefined;
    let resolveProjectTwo: (response: Response) => void = () => undefined;
    const projectOneResponse = new Promise<Response>((resolve) => {
      resolveProjectOne = resolve;
    });
    const projectTwoResponse = new Promise<Response>((resolve) => {
      resolveProjectTwo = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/projects" && fetchMock.mock.calls.length === 1) {
        return projectOneResponse;
      }
      if (url === "/api/projects" && fetchMock.mock.calls.length === 2) {
        return projectTwoResponse;
      }
      return Promise.reject(new Error(`unexpected request ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    const firstCreate = store.createCloudProject("Project One");
    const secondCreate = store.createCloudProject("Project Two");
    resolveProjectTwo(new Response(JSON.stringify({
      project: apiProject("project-2", "Project Two", apiProjectDoc("project-2", "Project Two"))
    }), { status: 201 }));
    await secondCreate;

    expect(store.project.id).toBe("project-2");
    expect(store.project.name).toBe("Project Two");
    expect(localStorage.getItem("lvgl-editor-last-project-id")).toBe("project-2");

    resolveProjectOne(new Response(JSON.stringify({
      project: apiProject("project-1", "Project One", apiProjectDoc("project-1", "Project One"))
    }), { status: 201 }));
    await firstCreate;

    expect(store.project.id).toBe("project-2");
    expect(store.project.name).toBe("Project Two");
    expect(localStorage.getItem("lvgl-editor-last-project-id")).toBe("project-2");
  });

  it("keeps the latest project list when list requests resolve out of order", async () => {
    let resolveFirstList: (response: Response) => void = () => undefined;
    let resolveSecondList: (response: Response) => void = () => undefined;
    const firstListResponse = new Promise<Response>((resolve) => {
      resolveFirstList = resolve;
    });
    const secondListResponse = new Promise<Response>((resolve) => {
      resolveSecondList = resolve;
    });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstListResponse)
      .mockReturnValueOnce(secondListResponse);
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    const firstLoad = store.loadProjects();
    const secondLoad = store.loadProjects();
    resolveSecondList(new Response(JSON.stringify({
      projects: [apiProject("project-2", "Project Two", apiProjectDoc("project-2", "Project Two"))]
    }), { status: 200 }));
    await secondLoad;

    expect(store.projects).toMatchObject([{ id: "project-2", name: "Project Two" }]);

    resolveFirstList(new Response(JSON.stringify({
      projects: [apiProject("project-1", "Project One", apiProjectDoc("project-1", "Project One"))]
    }), { status: 200 }));
    await firstLoad;

    expect(store.projects).toMatchObject([{ id: "project-2", name: "Project Two" }]);
  });

  it("clears stale cloud project list when the latest list request fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        projects: [apiProject("project-1", "Project One", apiProjectDoc("project-1", "Project One"))]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: "PROJECT_LIST_FAILED", message: "project list failed" }
      }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    await store.loadProjects();
    expect(store.projects).toMatchObject([{ id: "project-1", name: "Project One" }]);

    await expect(store.loadProjects()).rejects.toMatchObject({
      code: "PROJECT_LIST_FAILED",
      status: 500
    });
    expect(store.projects).toEqual([]);
  });

  it("rejects an invalid opened project document without replacing the current project", async () => {
    const store = useProjectStore();
    const invalidDoc = {
      ...store.project,
      id: "project-bad",
      name: "Broken UI",
      screens: []
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ project: apiProject("project-bad", "Broken UI", invalidDoc) }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(store.openProject("project-bad")).rejects.toMatchObject({
      code: "PROJECT_LOOKUP_FAILED",
      detail: "project lookup failed with status 200"
    });

    expect(store.project.id).toBe("project-watch-demo");
    expect(store.project.name).toBe("My Watch UI");
    expect(localStorage.getItem("lvgl-editor-last-project-id")).toBeNull();
    expect(store.saveState).toBe("saved");
    expect(store.validationErrors).toEqual([]);
  });

  it("rejects an opened project document with invalid top-level contract fields", async () => {
    const store = useProjectStore();
    const invalidDoc = {
      schemaVersion: 2,
      id: "project-bad-contract",
      name: "Broken Contract",
      target: store.project.target,
      theme: "solarized",
      screens: store.project.screens,
      assets: {},
      styles: [],
      events: [],
      updatedAt: ""
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ project: apiProject("project-bad-contract", "Broken Contract", invalidDoc) }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(store.openProject("project-bad-contract")).rejects.toMatchObject({
      code: "PROJECT_LOOKUP_FAILED",
      detail: "project lookup failed with status 200"
    });

    expect(store.project.id).toBe("project-watch-demo");
    expect(localStorage.getItem("lvgl-editor-last-project-id")).toBeNull();
    expect(store.validationErrors).toEqual([]);
  });

  it("restores the last opened cloud project from local storage", async () => {
    const returnedDoc = {
      schemaVersion: 1,
      id: "project-restored",
      name: "Restored UI",
      target: { lvglVersion: "8.3", deviceName: "ESP32-S3", width: 320, height: 240, dpi: 160, colorDepth: 16 },
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
            layout: { x: 0, y: 0, width: 320, height: 240 },
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
      updatedAt: "2026-05-08T00:00:00Z"
    };
    localStorage.setItem("lvgl-editor-last-project-id", "project-restored");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ project: apiProject("project-restored", "Restored UI", returnedDoc) }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    await store.restoreLastProject();

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-restored", expect.any(Object));
    expect(store.project.name).toBe("Restored UI");
    expect(store.project.target).toMatchObject({ width: 320, height: 240, dpi: 160 });
  });

  it("forgets the last opened cloud project when restore receives an invalid document", async () => {
    localStorage.setItem("lvgl-editor-last-project-id", "project-bad");
    const store = useProjectStore();
    const invalidDoc = {
      ...store.project,
      id: "project-bad",
      name: "Broken UI",
      screens: []
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ project: apiProject("project-bad", "Broken UI", invalidDoc) }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await store.restoreLastProject();

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-bad", expect.any(Object));
    expect(localStorage.getItem("lvgl-editor-last-project-id")).toBeNull();
    expect(store.project.id).toBe("project-watch-demo");
    expect(store.validationErrors).toEqual([]);
  });

  it("keeps cloud project workflows usable when last-project storage methods fail", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem() {
          throw new Error("read blocked");
        },
        setItem() {
          throw new Error("write blocked");
        },
        removeItem() {
          throw new Error("remove blocked");
        }
      }
    });
    setActivePinia(createPinia());
    const returnedDoc = apiProjectDoc("project-2", "Cloud UI");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ project: apiProject("project-2", "Cloud UI", returnedDoc) }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      const store = useProjectStore();

      await expect(store.openProject("project-2")).resolves.toBe(true);
      expect(store.project.id).toBe("project-2");
      await expect(store.restoreLastProject()).resolves.toBeUndefined();
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, "localStorage", descriptor);
      }
    }
  });
});
