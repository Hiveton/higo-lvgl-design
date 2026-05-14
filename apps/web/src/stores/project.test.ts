import { setActivePinia, createPinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthToken } from "../api/auth";
import { useProjectStore } from "./project";

describe("useProjectStore", () => {
  let storage: Record<string, string>;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  it("adds a widget from the catalog to the active screen and selects it", () => {
    const store = useProjectStore();

    store.addWidgetFromCatalog("label", { x: 24, y: 32 });

    expect(store.selectedWidget?.type).toBe("label");
    expect(store.selectedWidget?.name).toBe("Label_1");
    expect(store.selectedWidget?.layout).toMatchObject({ x: 24, y: 32, width: 120, height: 32 });
    expect(store.activeScreen?.root.children.some((widget) => widget.name === "Label_1")).toBe(true);
  });

  it("uses UUID ids for newly created widgets, screens and pasted widget trees", () => {
    const store = useProjectStore();

    store.addWidgetFromCatalog("label", { x: 24, y: 32 });
    const createdWidgetId = store.selectedWidget?.id;
    expect(createdWidgetId).toMatch(uuidPattern);

    store.addScreen();
    expect(store.activeScreen?.id).toMatch(uuidPattern);
    expect(store.activeScreen?.root.id).toMatch(uuidPattern);

    store.selectWidget("time-label");
    store.copySelectedWidget();
    store.pasteCopiedWidget();
    expect(store.selectedWidget?.id).toMatch(uuidPattern);
  });

  it("exposes command history entries for the timeline", () => {
    const store = useProjectStore();

    store.addWidgetFromCatalog("label", { x: 24, y: 32 });
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

  it("adds new widgets inside the selected container", () => {
    const store = useProjectStore();

    store.addWidgetFromCatalog("container", { x: 16, y: 24 });
    const container = store.selectedWidget;
    expect(container?.type).toBe("container");

    store.addWidgetFromCatalog("label", { x: 8, y: 12 });

    const updatedContainer = store.activeScreen?.root.children.find((widget) => widget.id === container?.id);
    expect(updatedContainer?.children).toHaveLength(1);
    expect(updatedContainer?.children[0]).toMatchObject({
      type: "label",
      parentId: container?.id,
      layout: { x: 8, y: 12, width: 120, height: 32 }
    });
  });

  it("adds new widgets inside an explicit drop target container", () => {
    const store = useProjectStore();

    store.addWidgetFromCatalog("container", { x: 16, y: 24 });
    const containerId = store.selectedWidget!.id;
    store.selectWidget("time-label");
    store.addWidgetFromCatalog("label", { x: 18, y: 20 }, { parentId: containerId });

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

  it("copies and pastes nested widgets with corrected child parent ids", () => {
    const store = useProjectStore();

    store.addWidgetFromCatalog("container", { x: 16, y: 24 });
    const containerId = store.selectedWidget!.id;
    store.addWidgetFromCatalog("label", { x: 8, y: 12 });
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

  it("moves widgets from layers into containers", () => {
    const store = useProjectStore();

    store.addWidgetFromCatalog("container", { x: 16, y: 24 });
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

  it("registers assets in ProjectDoc and binds an image asset to the selected widget", () => {
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
    store.addWidgetFromCatalog("image", { x: 24, y: 32 });
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

    expect(store.project.assets).toContainEqual(fontAsset);
    expect(store.selectedWidget?.style.font).toBe("font-1");

    store.unregisterAsset("font-1");

    expect(store.project.assets).toEqual([]);
    expect(store.selectedWidget?.style.font).toBeUndefined();

    store.undo();
    expect(store.project.assets).toContainEqual(fontAsset);
    expect(store.selectedWidget?.style.font).toBe("font-1");
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

  it("renames project, active screen and selected widget", () => {
    const store = useProjectStore();

    store.renameProject("Demo Panel");
    store.renameScreen("screen-1", "Main_Screen");
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

  it("adds, switches and deletes screens while keeping one screen", () => {
    const store = useProjectStore();

    store.addScreen();
    store.addWidgetFromCatalog("label", { x: 24, y: 32 });
    store.addEventBinding("LV_EVENT_CLICKED", "on_screen_2_label_clicked");
    expect(store.project.events).toHaveLength(1);

    expect(store.project.screens.map((screen) => screen.name)).toEqual(["Screen_1", "Screen_2"]);
    expect(store.activeScreen?.name).toBe("Screen_2");
    const secondScreenId = store.activeScreen!.id;

    store.switchScreen("screen-1");
    expect(store.activeScreen?.name).toBe("Screen_1");

    store.deleteScreen(secondScreenId);
    expect(store.project.screens.map((screen) => screen.name)).toEqual(["Screen_1"]);
    expect(store.activeScreen?.name).toBe("Screen_1");
    expect(store.project.events).toEqual([]);

    store.deleteScreen(store.activeScreen!.id);
    expect(store.project.screens).toHaveLength(1);
  });

  it("adds screens with unique ids after deleting a middle screen", () => {
    const store = useProjectStore();

    store.addScreen();
    store.addScreen();
    const secondScreenId = store.project.screens[1].id;
    const thirdScreenId = store.project.screens[2].id;
    expect(store.project.screens.map((screen) => screen.id)).toEqual(["screen-1", secondScreenId, thirdScreenId]);
    expect(secondScreenId).toMatch(uuidPattern);
    expect(thirdScreenId).toMatch(uuidPattern);

    store.deleteScreen(secondScreenId);
    store.addScreen();
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

  it("switches to the adjacent screen after deleting the active screen", () => {
    const store = useProjectStore();

    store.addScreen();
    store.addScreen();
    expect(store.project.screens.map((screen) => screen.name)).toEqual(["Screen_1", "Screen_2", "Screen_3"]);
    const secondScreenId = store.project.screens[1].id;
    const thirdScreenId = store.project.screens[2].id;

    store.switchScreen(secondScreenId);
    store.deleteScreen(secondScreenId);
    expect(store.activeScreen?.id).toBe(thirdScreenId);

    store.deleteScreen(thirdScreenId);
    expect(store.activeScreen?.id).toBe("screen-1");
  });

  it("duplicates the active screen with unique screen and widget ids", () => {
    const store = useProjectStore();

    store.duplicateScreen("screen-1");

    expect(store.project.screens).toHaveLength(2);
    expect(store.activeScreen?.name).toBe("Screen_1_1");
    expect(store.activeScreen?.id).not.toBe("screen-1");
    expect(store.activeScreen?.root.id).not.toBe("root-screen-1");
    expect(store.activeScreen?.root.children[0].id).not.toBe("time-label");
    expect(store.activeScreen?.root.children[0].parentId).toBe(store.activeScreen?.root.id);
  });

  it("duplicates screen event bindings onto the cloned widget ids", () => {
    const store = useProjectStore();

    store.addEventBinding("LV_EVENT_CLICKED", "on_time_clicked", "time-label");
    store.duplicateScreen("screen-1");

    const clonedTimeLabelId = store.activeScreen?.root.children.find((widget) => widget.name === "Time_Label_1")?.id;
    expect(clonedTimeLabelId).toBeTruthy();
    expect(store.project.events).toContainEqual({
      id: expect.stringMatching(uuidPattern),
      widgetId: clonedTimeLabelId,
      event: "LV_EVENT_CLICKED",
      handlerName: "on_time_clicked"
    });
  });

  it("keeps document-level edits in undo and redo history", () => {
    const store = useProjectStore();

    store.renameProject("Renamed UI");
    store.updateTarget({ width: 320, height: 240 });
    store.addScreen();
    store.renameScreen(store.activeScreen!.id, "Settings");

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
          project: {
            id: "project-1",
            name: "My Watch UI",
            updatedAt: "2026-05-08T00:00:00Z",
            doc: {}
          }
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

  it("directly creates a cloud project for logged-in seeded ProjectDoc saves without a failing seed PUT", async () => {
    storage["lvgl-editor-token"] = "demo-token";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          project: {
            id: "project-1",
            name: "My Watch UI",
            updatedAt: "2026-05-08T00:00:00Z",
            doc: {}
          }
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
          project: {
            id: "project-1",
            name: "My Watch UI",
            updatedAt: "2026-05-08T00:00:00Z",
            doc: {}
          }
        }), { status: 201 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ projectId: "project-1", updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    store.addWidgetFromCatalog("image", { x: 32, y: 32 });
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

    store.addWidgetFromCatalog("image", { x: 0, y: 0 });
    store.bindSelectedImageAsset("missing-asset");
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "project-2", name: "Cloud UI", doc: returnedDoc } }), { status: 200 }))
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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{ id: "project-1", name: "My Watch UI" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "project-2", name: "New UI", doc: returnedDoc } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "project-2", name: "New UI", doc: returnedDoc } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    await store.loadProjects();
    expect(store.projects).toEqual([{ id: "project-1", name: "My Watch UI" }]);

    await store.createCloudProject("New UI");
    expect(store.project.name).toBe("New UI");
    expect(localStorage.getItem("lvgl-editor-last-project-id")).toBe("project-2");

    await store.openProject("project-2");
    expect(store.project.id).toBe("project-2");
    expect(store.activeScreen?.name).toBe("Screen_1");
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
      new Response(JSON.stringify({ project: { id: "project-restored", name: "Restored UI", doc: returnedDoc } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const store = useProjectStore();

    await store.restoreLastProject();

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-restored", expect.any(Object));
    expect(store.project.name).toBe("Restored UI");
    expect(store.project.target).toMatchObject({ width: 320, height: 240, dpi: 160 });
  });
});
