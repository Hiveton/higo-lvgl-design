import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAuthToken } from "../api/auth";
import EditorShell from "./EditorShell.vue";
import { useAssetsStore } from "../stores/assets";
import { useProjectStore } from "../stores/project";

function assetUploadResponse(): Response {
  return new Response(
    JSON.stringify({
      asset: {
        id: "asset-1",
        projectId: "project-watch-demo",
        name: "icon_heart.png",
        kind: "image",
        mimeType: "image/png",
        sizeBytes: 12,
        objectKey: "projects/project-watch-demo/assets/asset-1/icon_heart.png",
        createdAt: "2026-05-08T00:00:00Z"
      }
    }),
    { status: 201 }
  );
}

function fontAssetUploadResponse(): Response {
  return new Response(
    JSON.stringify({
      asset: {
        id: "font-1",
        projectId: "project-watch-demo",
        name: "watch_digits.ttf",
        kind: "font",
        mimeType: "font/ttf",
        sizeBytes: 2048,
        objectKey: "projects/project-watch-demo/assets/font-1/watch_digits.ttf",
        createdAt: "2026-05-08T00:00:00Z"
      }
    }),
    { status: 201 }
  );
}

function projectSaveResponse(): Response {
  return new Response(JSON.stringify({ projectId: "project-watch-demo", updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 });
}

function projectCreateResponse(projectId = "project-1"): Response {
  return new Response(
    JSON.stringify({
      project: {
        id: projectId,
        name: "My Watch UI",
        updatedAt: "2026-05-08T00:00:00Z",
        doc: {}
      }
    }),
    { status: 201 }
  );
}

function signInForCloudSaves(): void {
  localStorage.setItem("lvgl-editor-token", "demo-token");
}

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("EditorShell", () => {
  it("renders the complete LVGL editor workspace chrome", () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.text()).toContain("LVGL Online Editor");
    expect(wrapper.text()).toContain("Widgets");
    expect(wrapper.text()).toContain("Layers");
    expect(wrapper.text()).toContain("Canvas");
    expect(wrapper.text()).toContain("Style");
    expect(wrapper.text()).toContain("Events");
    expect(wrapper.text()).toContain("Layout");
    expect(wrapper.text()).toContain("Assets");
    expect(wrapper.text()).toContain("Log");
    expect(wrapper.text()).toContain("Simulator");
    expect(wrapper.text()).toContain("All changes saved");
    expect(wrapper.get('[data-testid="persistence-status"]').text()).toBe("Local project");
    expect(wrapper.text()).toContain("LVGL v8.3");
    expect(wrapper.text()).toContain("DPI: 240");
    expect((wrapper.get('[data-testid="layer-name-settings-button"]').element as HTMLInputElement).value).toBe("Settings_Button");
    expect(wrapper.get('[data-testid="canvas-widget-steps-metric"]').text()).toContain("7,842");
    expect(wrapper.text()).toContain("Editor ready");
    expect(wrapper.text()).not.toContain("Build completed successfully");
  });

  it("updates status bar coordinates from the artboard mouse position", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });
    const artboard = wrapper.get('[data-testid="artboard"]');
    vi.spyOn(artboard.element, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 80,
      left: 100,
      top: 80,
      right: 580,
      bottom: 560,
      width: 480,
      height: 480,
      toJSON: () => ({})
    } as DOMRect);

    await artboard.trigger("mousemove", { clientX: 184, clientY: 128 });

    expect(wrapper.get('[data-testid="status-coordinates"]').text()).toBe("X: 84 Y: 48");
    wrapper.unmount();
  });

  it("shows dirty project state after local edits until save completes", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="selected-text-input"]').setValue("11:30");

    expect(wrapper.text()).toContain("Unsaved changes");

    const store = useProjectStore();
    await store.saveProject();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("All changes saved");
    expect(wrapper.text()).not.toContain("Unsaved changes");
  });

  it("renders every first-release widget category from the palette", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.text()).toContain("Containers");
    expect(wrapper.text()).toContain("Charts");
    expect(wrapper.text()).toContain("Indicators");
    expect(wrapper.text()).toContain("Inputs");

    await wrapper.get('[data-testid="widget-card-container"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-chart"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-slider"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-switch"]').trigger("click");

    expect(wrapper.find('[data-testid="canvas-widget-container-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="canvas-widget-chart-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="canvas-widget-slider-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="canvas-widget-switch-1"]').exists()).toBe(true);
  });

  it("renders LVGL-specific canvas previews for non-text widgets", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-slider"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-switch"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-checkbox"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-dropdown"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-arc"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-spinner"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-chart"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-line"]').trigger("click");

    expect(wrapper.find('[data-testid="canvas-widget-slider-1"] .range-preview').exists()).toBe(true);
    expect(wrapper.find('[data-testid="canvas-widget-switch-1"] .switch-preview').exists()).toBe(true);
    expect(wrapper.get('[data-testid="canvas-widget-checkbox-1"] .checkbox-preview').text()).toContain("Checkbox");
    expect(wrapper.get('[data-testid="canvas-widget-dropdown-1"] .dropdown-preview').text()).toContain("Option 1");
    expect(wrapper.find('[data-testid="canvas-widget-arc-1"] .arc-preview').exists()).toBe(true);
    expect(wrapper.find('[data-testid="canvas-widget-spinner-1"] .spinner-preview').exists()).toBe(true);
    expect(wrapper.find('[data-testid="canvas-widget-chart-1"] .chart-preview').exists()).toBe(true);
    expect(wrapper.find('[data-testid="canvas-widget-line-1"] .line-preview').exists()).toBe(true);
  });

  it("filters widgets from the palette search", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-search-input"]').setValue("slide");

    expect(wrapper.find('[data-testid="widget-card-slider"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="widget-card-label"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="widget-card-button"]').exists()).toBe(false);
  });

  it("drags a widget from the palette onto the canvas at the drop point", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });
    const transferData = new Map<string, string>();
    const dataTransfer = {
      setData: vi.fn((key: string, value: string) => transferData.set(key, value)),
      getData: vi.fn((key: string) => transferData.get(key) ?? "")
    };
    const artboard = wrapper.get('[data-testid="artboard"]');
    vi.spyOn(artboard.element, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 80,
      left: 100,
      top: 80,
      right: 580,
      bottom: 560,
      width: 480,
      height: 480,
      toJSON: () => ({})
    } as DOMRect);

    await wrapper.get('[data-testid="widget-card-label"]').trigger("dragstart", { dataTransfer });
    await artboard.trigger("drop", { dataTransfer, clientX: 154, clientY: 118 });
    await wrapper.vm.$nextTick();

    const store = useProjectStore();
    expect(store.selectedWidget?.name).toBe("Label_1");
    expect(store.selectedWidget?.layout).toMatchObject({ x: 56, y: 40 });
    expect(wrapper.get('[data-testid="canvas-widget-label-1"]').attributes("style")).toContain("left: 56px");
    wrapper.unmount();
  });

  it("drops a palette widget into the container hit on the canvas", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();
    await wrapper.get('[data-testid="widget-card-container"]').trigger("click");
    const container = store.selectedWidget!;
    store.selectWidget("time-label");
    await wrapper.vm.$nextTick();

    const transferData = new Map<string, string>();
    const dataTransfer = {
      setData: vi.fn((key: string, value: string) => transferData.set(key, value)),
      getData: vi.fn((key: string) => transferData.get(key) ?? "")
    };
    const artboard = wrapper.get('[data-testid="artboard"]');
    vi.spyOn(artboard.element, "getBoundingClientRect").mockReturnValue({
      x: 100,
      y: 80,
      left: 100,
      top: 80,
      right: 580,
      bottom: 560,
      width: 480,
      height: 480,
      toJSON: () => ({})
    } as DOMRect);

    await wrapper.get('[data-testid="widget-card-label"]').trigger("dragstart", { dataTransfer });
    await artboard.trigger("drop", { dataTransfer, clientX: 152, clientY: 144 });
    await wrapper.vm.$nextTick();

    const updatedContainer = store.activeScreen?.root.children.find((widget) => widget.id === container.id);
    expect(store.selectedWidget?.parentId).toBe(container.id);
    expect(updatedContainer?.children[0]).toMatchObject({
      type: "label",
      layout: { x: 32, y: 32, width: 120, height: 32 }
    });
    wrapper.unmount();
  });

  it("shows a generated LVGL C preview for the current screen", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();
    const root = store.activeScreen?.root;
    const timeLabel = root?.children.find((widget) => widget.id === "time-label");
    if (root && timeLabel) {
      root.layout.flex = { direction: "column", gap: 12, wrap: true };
      root.style.padding = { top: 4, right: 4, bottom: 4, left: 4 };
      timeLabel.layout.align = "center";
      store.project.events.push({
        id: "event-time-click",
        widgetId: timeLabel.id,
        event: "LV_EVENT_CLICKED",
        handlerName: "time_label_clicked"
      });
      store.registerAsset({
        id: "asset-icon-heart",
        projectId: store.project.id,
        name: "icon-heart.png",
        kind: "image",
        mimeType: "image/png",
        width: 16,
        height: 16,
        sizeBytes: 1024,
        objectKey: "projects/project-watch-demo/assets/icon-heart.png",
        createdAt: "2026-05-08T00:00:00Z"
      });
      store.addWidgetFromCatalog("image", { x: 32, y: 60 });
      store.bindSelectedImageAsset("asset-icon-heart");
    }

    await wrapper.get('[data-testid="widget-card-container"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-label"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-slider"]').trigger("click");
    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    const preview = wrapper.get('[data-testid="code-preview"]').text();
    expect(preview).toContain("lv_label_create(ui_Screen_1)");
    expect(preview).toContain("lv_obj_set_layout(ui_Screen_1, LV_LAYOUT_FLEX);");
    expect(preview).toContain("lv_obj_set_flex_flow(ui_Screen_1, LV_FLEX_FLOW_COLUMN_WRAP);");
    expect(preview).toContain("lv_obj_align(ui_Time_Label, LV_ALIGN_CENTER, 150, 40);");
    expect(preview).toContain('lv_label_set_text(ui_Time_Label, "10:09");');
    expect(preview).toContain("lv_obj_add_event_cb(ui_Time_Label, time_label_clicked, LV_EVENT_CLICKED, NULL);");
    expect(preview).toContain("void time_label_clicked(lv_event_t * e)");
    expect(preview).toContain("/* User code can be added here. */");
    expect(preview).toContain('lv_label_set_text(ui_Settings_Button_Label, "Settings");');
    expect(preview).toContain("ui_Label_1 = lv_label_create(ui_Container_1);");
    expect(preview).toContain("lv_slider_set_range(ui_Slider_1, 0, 100);");
    expect(preview).toContain("lv_img_set_src(ui_Image_1, &ui_img_icon_heart_png);");
    expect(preview).not.toContain("0xtransparent");
  });

  it("renders canvas widgets with flex wrap, padding and align layout metadata", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();
    const root = store.activeScreen!.root;
    const timeLabel = root.children.find((widget) => widget.id === "time-label")!;
    const dateLabel = root.children.find((widget) => widget.id === "date-label")!;

    root.layout.flex = { direction: "row", gap: 8, wrap: true };
    root.style.padding = { top: 10, right: 12, bottom: 10, left: 12 };
    timeLabel.layout = { ...timeLabel.layout, width: 260, height: 56 };
    dateLabel.layout = { ...dateLabel.layout, width: 260, height: 24 };
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("style")).toContain("left: 12px");
    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("style")).toContain("top: 10px");
    expect(wrapper.get('[data-testid="canvas-widget-date-label"]').attributes("style")).toContain("left: 12px");
    expect(wrapper.get('[data-testid="canvas-widget-date-label"]').attributes("style")).toContain("top: 74px");

    root.layout.flex = undefined;
    timeLabel.layout = { ...timeLabel.layout, x: 0, y: 0, width: 180, height: 56, align: "center" };
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("style")).toContain("left: 150px");
    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("style")).toContain("top: 212px");
  });

  it("renders the seeded watch project and selected Time_Label", () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.text()).toContain("My Watch UI");
    expect(wrapper.text()).toContain("ESP32-S3 (480x480)");
    expect(wrapper.text()).toContain("Screen_1");
    expect(wrapper.text()).toContain("Time_Label");
    expect(wrapper.text()).toContain("10:09");
  });

  it("renames project, active screen and selected widget from the editor UI", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="project-name-input"]').setValue("Demo Panel");
    await wrapper.get('[data-testid="active-screen-name-input"]').setValue("Main_Screen");
    await wrapper.get('[data-testid="selector-input"]').setValue("Clock_Label");

    expect(wrapper.text()).toContain("Demo Panel");
    expect(wrapper.get('[data-testid="active-screen-label"]').text()).toBe("Main_Screen");
    expect(wrapper.text()).toContain("Clock_Label");
  });

  it("switches the project theme from the toolbar", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="theme-select"]').setValue("light");

    expect(wrapper.classes()).toContain("theme-light");
  });

  it("shows project settings from the settings navigation item", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="settings-nav-button"]').trigger("click");

    expect(wrapper.get('[data-testid="settings-panel"]').text()).toContain("ESP32-S3");
    expect(wrapper.get('[data-testid="settings-panel"]').text()).toContain("LVGL 8.3");
    expect(wrapper.get('[data-testid="settings-panel"]').text()).toContain("480 x 480");
  });

  it("keeps the left editor navigation active state in sync with the selected section", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="widgets-nav-button"]').classes()).toContain("active");

    await wrapper.get('[data-testid="layers-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="layers-nav-button"]').classes()).toContain("active");
    expect(wrapper.find('[data-testid="code-preview"]').exists()).toBe(false);

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="code-nav-button"]').classes()).toContain("active");
    expect(wrapper.find('[data-testid="code-preview"]').exists()).toBe(true);

    await wrapper.get('[data-testid="screens-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="screens-nav-button"]').classes()).toContain("active");
    expect(wrapper.find('[data-testid="code-preview"]').exists()).toBe(false);
  });

  it("adds log entries when Preview and Build are clicked", async () => {
    signInForCloudSaves();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue("blob:export-zip"),
      revokeObjectURL: vi.fn()
    });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(projectCreateResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ projectId: "project-watch-demo", updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-1" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-1",
          status: "succeeded",
          logs: [
            { time: "2026-05-08T00:00:00Z", level: "info", message: "Build started" },
            { time: "2026-05-08T00:00:01Z", level: "info", message: "Build completed successfully" }
          ],
          result: { downloadUrl: "/api/jobs/job-1/download" }
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Blob(["zip"]), { status: 200, headers: { "Content-Type": "application/zip" } }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    await wrapper.get('[data-testid="build-button"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Preview updated");
    expect(wrapper.text()).toContain("Build completed successfully");
    expect(wrapper.find('[data-testid="build-status-succeeded"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="download-export-button"]').exists()).toBe(true);

    await wrapper.get('[data-testid="download-export-button"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job-1/download", expect.objectContaining({ headers: expect.any(Object) }));
    expect(anchorClick).toHaveBeenCalled();
    expect(wrapper.text()).toContain("Export zip downloaded");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/projects", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/projects/project-1/doc", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/export/c", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job-1", expect.any(Object));
    wrapper.unmount();
  });

  it("polls build jobs until they finish", async () => {
    signInForCloudSaves();
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(projectCreateResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ projectId: "project-watch-demo", updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-2" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-2",
          status: "running",
          logs: [{ time: "2026-05-08T00:00:00Z", level: "info", message: "Generating code" }]
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-2",
          status: "succeeded",
          logs: [{ time: "2026-05-08T00:00:01Z", level: "info", message: "Build completed successfully" }],
          result: { downloadUrl: "/api/jobs/job-2/download" }
        }
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="build-button"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(wrapper.find('[data-testid="build-status-running"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="build-button"]').text()).toBe("Building...");
    expect(wrapper.text()).toContain("Generating code");

    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job-2", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(wrapper.text()).toContain("Build completed successfully");
  });

  it("writes failed build status and error message to the log", async () => {
    signInForCloudSaves();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(projectCreateResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ projectId: "project-watch-demo", updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-failed" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-failed",
          status: "failed",
          logs: [],
          error: { code: "CODEGEN_FAILED", message: "image widget references missing asset" }
        }
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="build-button"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Job status: failed");
    expect(wrapper.text()).toContain("image widget references missing asset");
  });

  it("fails a build with a log entry when job polling times out", async () => {
    signInForCloudSaves();
    vi.useFakeTimers();
    const runningJobResponse = {
      job: {
        id: "job-timeout",
        status: "running",
        logs: [{ time: "2026-05-08T00:00:00Z", level: "info", message: "Generating code" }]
      }
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(projectCreateResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ projectId: "project-watch-demo", updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-timeout" }), { status: 202 }));
    for (let index = 0; index < 10; index += 1) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(runningJobResponse), { status: 200 }));
    }
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="build-button"]').trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(4500);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(13);
    expect(wrapper.find('[data-testid="build-status-failed"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Export job timed out after 10 polls");
  });

  it("does not export when the pre-build save fails", async () => {
    signInForCloudSaves();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "SAVE_FAILED", message: "save failed" } }), { status: 500 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="build-button"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/projects", expect.objectContaining({ method: "POST" }));
    expect(wrapper.text()).toContain("Build stopped because project save failed");
  });

  it("requires a cloud project before exporting the local seeded project", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="build-button"]').trigger("click");
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="build-status-failed"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Sign in before Build to create a cloud project and export C code");
  });

  it("opens and closes a full device preview overlay", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    expect(wrapper.get('[data-testid="preview-overlay"]').text()).toContain("Preview");
    expect(wrapper.get('[data-testid="preview-widget-time-label"]').text()).toContain("10:09");

    await wrapper.get('[data-testid="close-preview-button"]').trigger("click");
    expect(wrapper.find('[data-testid="preview-overlay"]').exists()).toBe(false);
  });

  it("renders widget-specific controls inside the full preview overlay", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    await wrapper.get('[data-testid="widget-card-chart"]').trigger("click");
    await wrapper.get('[data-testid="prop-values-input"]').setValue("10, 40, 90");
    await wrapper.get('[data-testid="widget-card-dropdown"]').trigger("click");
    await wrapper.get('[data-testid="prop-options-input"]').setValue("Auto\nManual\nOff");
    await wrapper.get('[data-testid="prop-selected-input"]').setValue("1");

    await wrapper.get('[data-testid="preview-button"]').trigger("click");

    expect(wrapper.get('[data-testid="preview-widget-chart-1"] .chart-preview span').attributes("style")).toContain("height: 10%");
    expect(wrapper.get('[data-testid="preview-widget-dropdown-1"] .dropdown-preview').text()).toContain("Manual");
    expect(store.selectedWidget?.type).toBe("dropdown");
  });

  it("supports preview refresh and screenshot controls without changing ProjectDoc", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);
    const beforeDoc = JSON.stringify(store.project);
    const canvas = wrapper.get('[data-testid="simulator-canvas"]').element as HTMLCanvasElement;
    vi.spyOn(canvas, "toDataURL").mockReturnValue("data:image/png;base64,preview");

    await wrapper.get('[data-testid="preview-button"]').trigger("click");

    expect(wrapper.get('[data-testid="preview-screen-name"]').text()).toBe("Screen_1");
    expect(wrapper.get('[data-testid="preview-overlay"]').text()).toContain("ESP32-S3 (480x480)");

    await wrapper.get('[data-testid="refresh-preview-button"]').trigger("click");
    await wrapper.get('[data-testid="screenshot-preview-button"]').trigger("click");

    expect(wrapper.get('[data-testid="preview-screenshot-link"]').attributes("href")).toBe("data:image/png;base64,preview");
    expect(wrapper.text()).toContain("Preview screenshot ready");
    expect(JSON.stringify(store.project)).toBe(beforeDoc);
  });

  it("shows screen, event and command entries in the timeline tab", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-label"]').trigger("click");
    await wrapper.get('[data-testid="inspector-events-tab"]').trigger("click");
    await wrapper.get('[data-testid="event-handler-input"]').setValue("on_time_clicked");
    await wrapper.get('[data-testid="add-event-button"]').trigger("click");
    await wrapper.get('[data-testid="bottom-timeline-tab"]').trigger("click");

    const timeline = wrapper.get('[data-testid="timeline-list"]').text();
    expect(timeline).toContain("Screen");
    expect(timeline).toContain("Screen_1");
    expect(timeline).toContain("Event");
    expect(timeline).toContain("LV_EVENT_CLICKED -> on_time_clicked");
    expect(timeline).toContain("Command");
    expect(timeline).toContain("Add Label_1");
  });

  it("updates the selected widget text from the inspector", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    const input = wrapper.get('[data-testid="selected-text-input"]');
    await input.setValue("11:30");

    expect(wrapper.text()).toContain("11:30");
  });

  it("hides text controls for non-text widgets in the inspector", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-image"]').trigger("click");

    expect(wrapper.find('[data-testid="selected-text-input"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="style-font-select"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="style-align-select"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="style-letter-space-input"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="style-line-space-input"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="image-asset-select"]').exists()).toBe(true);
  });

  it("lists imported font assets in the inspector font selector", async () => {
    const pinia = createPinia();
    const fontAsset = {
      id: "font-1",
      projectId: "project-watch-demo",
      name: "brand.ttf",
      kind: "font",
      mimeType: "font/ttf",
      sizeBytes: 1200,
      objectKey: "projects/project-watch-demo/assets/font-1/brand.ttf",
      createdAt: "2026-05-08T00:00:00Z"
    } as const;
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const projectStore = useProjectStore();
    projectStore.registerAsset(fontAsset);
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-testid="style-font-select"]').setValue("font-1");

    expect(wrapper.get('[data-testid="style-font-select"]').text()).toContain("brand.ttf");
    expect(projectStore.selectedWidget?.style.font).toBe("font-1");

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="code-preview"]').text()).not.toContain("&font_1");
    expect(wrapper.get('[data-testid="code-preview"]').text()).toContain("Font asset font-1 is registered as metadata only");
  });

  it("updates selected widget style fields from the inspector", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="style-text-color-input"]').setValue("#00AEEF");
    await wrapper.get('[data-testid="style-bg-color-input"]').setValue("#101820");
    await wrapper.get('[data-testid="style-border-color-input"]').setValue("#FFCC00");
    await wrapper.get('[data-testid="style-font-select"]').setValue("lv_font_montserrat_32");
    await wrapper.get('[data-testid="style-align-select"]').setValue("right");
    await wrapper.get('[data-testid="style-radius-input"]').setValue("16");
    await wrapper.get('[data-testid="style-opacity-input"]').setValue("64");
    await wrapper.get('[data-testid="style-padding-top-input"]').setValue("6");
    await wrapper.get('[data-testid="style-padding-right-input"]').setValue("8");
    await wrapper.get('[data-testid="style-padding-bottom-input"]').setValue("10");
    await wrapper.get('[data-testid="style-padding-left-input"]').setValue("12");
    await wrapper.get('[data-testid="style-letter-space-input"]').setValue("2");
    await wrapper.get('[data-testid="style-line-space-input"]').setValue("4");

    const widget = wrapper.get('[data-testid="canvas-widget-time-label"]');
    expect(widget.attributes("style")).toContain("color: rgb(0, 174, 239)");
    expect(widget.attributes("style")).toContain("background-color: rgb(16, 24, 32)");
    expect(widget.attributes("style")).toContain("border-color: rgb(255, 204, 0)");
    expect(widget.attributes("style")).toContain("border-radius: 16px");
    expect(widget.attributes("style")).toContain("opacity: 0.64");
    expect(widget.attributes("style")).toContain("padding: 6px 8px 10px 12px");
    expect(widget.attributes("style")).toContain("text-align: right");
    expect(widget.attributes("style")).toContain("letter-spacing: 2px");
  });

  it("edits widget-specific props from the inspector", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    await wrapper.get('[data-testid="widget-card-slider"]').trigger("click");
    await wrapper.get('[data-testid="prop-min-input"]').setValue("10");
    await wrapper.get('[data-testid="prop-max-input"]').setValue("200");
    await wrapper.get('[data-testid="prop-value-input"]').setValue("64");
    expect(store.selectedWidget?.props).toMatchObject({ min: 10, max: 200, value: 64 });

    await wrapper.get('[data-testid="widget-card-checkbox"]').trigger("click");
    await wrapper.get('[data-testid="prop-text-input"]').setValue("Enable logs");
    await wrapper.get('[data-testid="prop-checked-input"]').setValue(true);
    expect(store.selectedWidget?.props).toMatchObject({ text: "Enable logs", checked: true });

    await wrapper.get('[data-testid="widget-card-dropdown"]').trigger("click");
    await wrapper.get('[data-testid="prop-options-input"]').setValue("Auto\nManual\nOff");
    await wrapper.get('[data-testid="prop-selected-input"]').setValue("1");
    expect(store.selectedWidget?.props).toMatchObject({ options: "Auto\nManual\nOff", selected: 1 });

    await wrapper.get('[data-testid="widget-card-spinner"]').trigger("click");
    await wrapper.get('[data-testid="prop-spin-time-input"]').setValue("900");
    await wrapper.get('[data-testid="prop-arc-length-input"]').setValue("80");
    expect(store.selectedWidget?.props).toMatchObject({ spinTime: 900, arcLength: 80 });

    await wrapper.get('[data-testid="widget-card-chart"]').trigger("click");
    await wrapper.get('[data-testid="prop-min-input"]').setValue("-20");
    await wrapper.get('[data-testid="prop-max-input"]').setValue("120");
    await wrapper.get('[data-testid="prop-point-count-input"]').setValue("12");
    expect(store.selectedWidget?.props).toMatchObject({ min: -20, max: 120, pointCount: 12 });
  });

  it("rejects invalid widget-specific numeric props from the inspector", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    await wrapper.get('[data-testid="widget-card-spinner"]').trigger("click");
    await wrapper.get('[data-testid="prop-spin-time-input"]').setValue("0");
    expect(wrapper.get('[data-testid="prop-spin-time-error"]').text()).toBe("spinTime must be greater than 0");
    expect(store.selectedWidget?.props.spinTime).toBe(1000);

    await wrapper.get('[data-testid="prop-arc-length-input"]').setValue("-1");
    expect(wrapper.get('[data-testid="prop-arc-length-error"]').text()).toBe("arcLength must be greater than 0");
    expect(store.selectedWidget?.props.arcLength).toBe(60);

    await wrapper.get('[data-testid="widget-card-chart"]').trigger("click");
    await wrapper.get('[data-testid="prop-point-count-input"]').setValue("0");
    expect(wrapper.get('[data-testid="prop-point-count-error"]').text()).toBe("pointCount must be greater than 0");
    expect(store.selectedWidget?.props.pointCount).toBe(8);

    await wrapper.get('[data-testid="widget-card-dropdown"]').trigger("click");
    await wrapper.get('[data-testid="prop-selected-input"]').setValue("-1");
    expect(wrapper.get('[data-testid="prop-selected-error"]').text()).toBe("selected must be non-negative");
    expect(store.selectedWidget?.props.selected).toBe(0);

    await wrapper.get('[data-testid="prop-selected-input"]').setValue("1");
    expect(wrapper.find('[data-testid="prop-selected-error"]').exists()).toBe(false);
    expect(store.selectedWidget?.props.selected).toBe(1);
  });

  it("edits chart values from the inspector and reflects them in canvas and code preview", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    await wrapper.get('[data-testid="widget-card-chart"]').trigger("click");
    await wrapper.get('[data-testid="prop-values-input"]').setValue("10, 40, 90");

    expect(store.selectedWidget?.props).toMatchObject({
      values: [10, 40, 90],
      pointCount: 3
    });
    expect(wrapper.get('[data-testid="canvas-widget-chart-1"] .chart-preview span').attributes("style")).toContain("height: 10%");

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    const preview = wrapper.get('[data-testid="code-preview"]').text();
    expect(preview).toContain("lv_chart_series_t * ui_Chart_1_series = lv_chart_add_series(ui_Chart_1, lv_palette_main(LV_PALETTE_BLUE), LV_CHART_AXIS_PRIMARY_Y);");
    expect(preview).toContain("lv_chart_set_next_value(ui_Chart_1, ui_Chart_1_series, 10);");
    expect(preview).toContain("lv_chart_set_next_value(ui_Chart_1, ui_Chart_1_series, 90);");
    expect(preview).toContain("lv_chart_refresh(ui_Chart_1);");
  });

  it("rejects invalid chart value input without changing ProjectDoc", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    await wrapper.get('[data-testid="widget-card-chart"]').trigger("click");
    await wrapper.get('[data-testid="prop-values-input"]').setValue("10, nope, 90");

    expect(wrapper.get('[data-testid="prop-values-error"]').text()).toBe("values must be comma, space or newline separated numbers");
    expect(store.selectedWidget?.props.values).toBeUndefined();
    expect(store.selectedWidget?.props.pointCount).toBe(8);
  });

  it("selects a widget from the canvas and edits layout fields", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-container"]').trigger("click");
    await wrapper.get('[data-testid="canvas-widget-date-label"]').trigger("click");

    expect(wrapper.get('[data-testid="selector-input"]').element).toHaveProperty("value", "Date_Label");
    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");

    await wrapper.get('[data-testid="layout-x-input"]').setValue("190");
    await wrapper.get('[data-testid="layout-y-input"]').setValue("120");
    await wrapper.get('[data-testid="layout-width-input"]').setValue("170");
    await wrapper.get('[data-testid="layout-height-input"]').setValue("28");
    await wrapper.get('[data-testid="layout-align-select"]').setValue("center");
    expect(wrapper.find('[data-testid="layout-flex-direction-select"]').exists()).toBe(false);

    await wrapper.get('[data-testid="canvas-widget-container-1"]').trigger("click");
    await wrapper.get('[data-testid="layout-flex-direction-select"]').setValue("column");
    await wrapper.get('[data-testid="layout-gap-input"]').setValue("8");
    await wrapper.get('[data-testid="layout-flex-wrap-input"]').setValue(true);

    const widget = wrapper.get('[data-testid="canvas-widget-date-label"]');
    expect(widget.attributes("style")).toContain("left: 345px");
    expect(widget.attributes("style")).toContain("top: 346px");
    expect(widget.attributes("style")).toContain("width: 170px");
    expect(widget.attributes("style")).toContain("height: 28px");
    expect(useProjectStore().selectedWidget?.layout.flex).toMatchObject({ direction: "column", gap: 8, wrap: true });
  });

  it("selects the active screen root from Layers and edits screen flex layout", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();

    await wrapper.get('[data-testid="layer-row-screen-root"]').trigger("click");
    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    await wrapper.get('[data-testid="layout-flex-direction-select"]').setValue("column");
    await wrapper.get('[data-testid="layout-gap-input"]').setValue("12");
    await wrapper.get('[data-testid="layout-flex-wrap-input"]').setValue(true);

    expect(store.selectedWidget?.id).toBe(store.activeScreen?.root.id);
    expect(store.selectedWidget?.type).toBe("screen");
    expect(store.activeScreen?.root.layout.flex).toMatchObject({ direction: "column", gap: 12, wrap: true });
    expect(wrapper.get('[data-testid="layer-row-screen-root"]').classes()).toContain("selected-layer");
  });

  it("shows inline errors for invalid inspector numbers without changing ProjectDoc", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    await wrapper.get('[data-testid="layout-width-input"]').setValue("-1");

    expect(wrapper.get('[data-testid="layout-width-error"]').text()).toBe("width must be greater than 0");
    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("style")).toContain("width: 180px");

    await wrapper.get('[data-testid="layout-width-input"]').setValue("200");

    expect(wrapper.find('[data-testid="layout-width-error"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("style")).toContain("width: 200px");
  });

  it("rejects invalid style padding, radius and flex gap from the inspector", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();

    await wrapper.get('[data-testid="style-radius-input"]').setValue("-1");
    expect(wrapper.get('[data-testid="style-radius-error"]').text()).toBe("radius must be non-negative");
    expect(store.selectedWidget?.style.radius).toBeUndefined();

    await wrapper.get('[data-testid="style-padding-top-input"]').setValue("-4");
    expect(wrapper.get('[data-testid="style-padding-top-error"]').text()).toBe("padding top must be non-negative");
    expect(store.selectedWidget?.style.padding).toBeUndefined();

    await wrapper.get('[data-testid="layer-row-screen-root"]').trigger("click");
    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    await wrapper.get('[data-testid="layout-gap-input"]').setValue("-8");

    expect(wrapper.get('[data-testid="layout-gap-error"]').text()).toBe("gap must be non-negative");
    expect(store.activeScreen?.root.layout.flex).toBeUndefined();

    await wrapper.get('[data-testid="layout-gap-input"]').setValue("8");
    expect(wrapper.find('[data-testid="layout-gap-error"]').exists()).toBe(false);
    expect(store.activeScreen?.root.layout.flex).toMatchObject({ direction: "row", gap: 8, wrap: false });
  });

  it("moves and resizes a selected widget directly on the canvas", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="canvas-widget-date-label"]').trigger("mousedown", {
      clientX: 168,
      clientY: 105
    });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 198, clientY: 125 }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    await wrapper.vm.$nextTick();

    let widget = wrapper.get('[data-testid="canvas-widget-date-label"]');
    expect(widget.attributes("style")).toContain("left: 200px");
    expect(widget.attributes("style")).toContain("top: 128px");

    await wrapper.get('[data-testid="resize-handle-date-label"]').trigger("mousedown", {
      clientX: 348,
      clientY: 149
    });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 378, clientY: 159 }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    await wrapper.vm.$nextTick();

    widget = wrapper.get('[data-testid="canvas-widget-date-label"]');
    expect(widget.attributes("style")).toContain("width: 184px");
    expect(widget.attributes("style")).toContain("height: 32px");
    wrapper.unmount();
  });

  it("keeps true negative coordinates when a widget is dragged outside the canvas", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="canvas-widget-date-label"]').trigger("mousedown", {
      clientX: 168,
      clientY: 105
    });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: -40, clientY: -35 }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    await wrapper.vm.$nextTick();

    const widget = wrapper.get('[data-testid="canvas-widget-date-label"]');
    expect(widget.attributes("style")).toContain("left: -40px");
    expect(widget.attributes("style")).toContain("top: -32px");

    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    expect((wrapper.get('[data-testid="layout-x-input"]').element as HTMLInputElement).value).toBe("-40");
    expect((wrapper.get('[data-testid="layout-y-input"]').element as HTMLInputElement).value).toBe("-32");
    wrapper.unmount();
  });

  it("snaps moved widgets to alignment guides while dragging", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="canvas-widget-date-label"]').trigger("mousedown", {
      clientX: 168,
      clientY: 105
    });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 165, clientY: 105 }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="alignment-guide-vertical"]').attributes("style")).toContain("left: 240px");
    expect(wrapper.get('[data-testid="canvas-widget-date-label"]').attributes("style")).toContain("left: 165px");

    document.dispatchEvent(new MouseEvent("mouseup"));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="alignment-guide-vertical"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("applies zoom scale and can disable snap while dragging canvas widgets", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="zoom-select"]').setValue("200");
    await wrapper.get('[data-testid="snap-toggle"]').trigger("click");
    await wrapper.get('[data-testid="canvas-widget-date-label"]').trigger("mousedown", {
      clientX: 168,
      clientY: 105
    });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 200, clientY: 125 }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    await wrapper.vm.$nextTick();

    const widget = wrapper.get('[data-testid="canvas-widget-date-label"]');
    expect(widget.attributes("style")).toContain("left: 184px");
    expect(widget.attributes("style")).toContain("top: 115px");
    expect(wrapper.get(".artboard").attributes("style")).toContain("scale(2)");
    expect(wrapper.get('[data-testid="grid-toggle"]').classes()).toContain("active");
    await wrapper.get('[data-testid="grid-toggle"]').trigger("click");
    expect(wrapper.get(".artboard").classes()).not.toContain("show-grid");
    wrapper.unmount();
  });

  it("fits the current device canvas into the visible canvas stage", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });
    const stage = wrapper.get('[data-testid="canvas-stage"]');
    vi.spyOn(stage.element, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 240,
      bottom: 240,
      width: 240,
      height: 240,
      toJSON: () => ({})
    } as DOMRect);

    await wrapper.get('[data-testid="fit-view-button"]').trigger("click");

    expect((wrapper.get('[data-testid="zoom-select"]').element as HTMLSelectElement).value).toBe("50");
    expect(wrapper.get('[data-testid="artboard"]').attributes("style")).toContain("scale(0.5)");
    wrapper.unmount();
  });

  it("requests fullscreen for the canvas stage from the canvas toolbar", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });
    const stage = wrapper.get('[data-testid="canvas-stage"]').element as HTMLElement & { requestFullscreen?: () => Promise<void> };
    const requestFullscreen = vi.fn(async () => undefined);
    stage.requestFullscreen = requestFullscreen;

    await wrapper.get('[data-testid="fullscreen-canvas-button"]').trigger("click");

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("shows canvas rulers and pans the canvas stage", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="ruler-top"]').text()).toContain("480");
    expect(wrapper.get('[data-testid="ruler-left"]').text()).toContain("480");

    await wrapper.get('[data-testid="canvas-stage"]').trigger("mousedown", {
      shiftKey: true,
      clientX: 200,
      clientY: 180
    });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 236, clientY: 210 }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="canvas-pan"]').attributes("style")).toContain("translate(36px, 30px)");
    wrapper.unmount();
  });

  it("pans the canvas stage while space is held", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    await wrapper.get('[data-testid="canvas-stage"]').trigger("mousedown", {
      clientX: 120,
      clientY: 100
    });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 148, clientY: 118 }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    document.dispatchEvent(new KeyboardEvent("keyup", { key: " " }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="canvas-pan"]').attributes("style")).toContain("translate(28px, 18px)");
    wrapper.unmount();
  });

  it("adds, switches and deletes screens from the screens panel", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="add-screen-button"]').trigger("click");
    expect(wrapper.text()).toContain("Screen_2");
    expect(wrapper.get('[data-testid="screen-summary"]').text()).toContain("2 screens");

    await wrapper.get('[data-testid="screen-row-screen-2"]').trigger("click");
    expect(wrapper.get('[data-testid="active-screen-label"]').text()).toBe("Screen_2");

    await wrapper.get('[data-testid="duplicate-screen-button"]').trigger("click");
    expect(wrapper.text()).toContain("Screen_2_1");
    expect(wrapper.get('[data-testid="active-screen-label"]').text()).toBe("Screen_2_1");

    await wrapper.get('[data-testid="delete-screen-button"]').trigger("click");
    expect(wrapper.find('[data-testid="screen-row-screen-2-1"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="active-screen-label"]').text()).toBe("Screen_2");
  });

  it("disables deleting the last remaining screen", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="delete-screen-button"]').element).toHaveProperty("disabled", true);

    await wrapper.get('[data-testid="add-screen-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="delete-screen-button"]').element).toHaveProperty("disabled", false);
  });

  it("switches to the adjacent row when deleting the active middle screen from the screens panel", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="add-screen-button"]').trigger("click");
    await wrapper.get('[data-testid="add-screen-button"]').trigger("click");
    await wrapper.get('[data-testid="screen-row-screen-2"]').trigger("click");
    await wrapper.get('[data-testid="delete-screen-button"]').trigger("click");

    expect(wrapper.find('[data-testid="screen-row-screen-2"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="active-screen-label"]').text()).toBe("Screen_3");
  });

  it("warns when screen names are duplicated without blocking editing", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="add-screen-button"]').trigger("click");
    await wrapper.get('[data-testid="active-screen-name-input"]').setValue("Screen_1");

    expect(wrapper.get('[data-testid="screen-name-warning"]').text()).toBe("Screen names should be unique.");
    expect(wrapper.get('[data-testid="active-screen-label"]').text()).toBe("Screen_1");
  });

  it("reorders and deletes widgets from the layers panel", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="layer-up-date-label"]').trigger("click");
    await wrapper.vm.$nextTick();

    const rowsAfterReorder = wrapper.findAll(".layer-name-input").map((row) => (row.element as HTMLInputElement).value);
    expect(rowsAfterReorder[0]).toBe("Date_Label");

    await wrapper.get('[data-testid="layer-delete-time-label"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="layer-row-time-label"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="canvas-widget-time-label"]').exists()).toBe(false);
  });

  it("disables layer reorder actions at sibling boundaries", () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="layer-up-time-label"]').element).toHaveProperty("disabled", true);
    expect(wrapper.get('[data-testid="layer-down-time-label"]').element).toHaveProperty("disabled", false);
    expect(wrapper.get('[data-testid="layer-up-settings-button"]').element).toHaveProperty("disabled", false);
    expect(wrapper.get('[data-testid="layer-down-settings-button"]').element).toHaveProperty("disabled", true);
  });

  it("renames widgets inline from the layers panel and keeps canvas and inspector synced", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="layer-name-date-label"]').setValue("Calendar_Label");
    await wrapper.vm.$nextTick();

    expect((wrapper.get('[data-testid="layer-name-calendar-label"]').element as HTMLInputElement).value).toBe("Calendar_Label");
    expect(wrapper.get('[data-testid="canvas-widget-calendar-label"]').text()).toContain("Calendar_Label");
    expect((wrapper.get('[data-testid="selector-input"]').element as HTMLInputElement).value).toBe("Calendar_Label");
  });

  it("renders nested container children in layers and on the canvas", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-container"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-label"]').trigger("click");
    await wrapper.vm.$nextTick();

    const container = wrapper.get('[data-testid="canvas-widget-container-1"]');
    const nestedLabel = wrapper.get('[data-testid="canvas-widget-label-1"]');
    expect(wrapper.get('[data-testid="layer-row-label-1"]').attributes("style")).toContain("padding-left: 18px");
    expect(container.attributes("style")).toContain("left: 24px");
    expect(nestedLabel.attributes("style")).toContain("left: 48px");
    expect(nestedLabel.attributes("style")).toContain("top: 64px");
  });

  it("drags a layer row into a container layer", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-container"]').trigger("click");
    await wrapper.get('[data-testid="layer-row-date-label"]').trigger("dragstart");
    await wrapper.get('[data-testid="layer-row-container-1"]').trigger("drop");
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="layer-row-date-label"]').attributes("style")).toContain("padding-left: 18px");
    expect(wrapper.get('[data-testid="canvas-widget-date-label"]').attributes("style")).toContain("left: 192px");
  });

  it("drags a layer row onto a sibling layer to reorder it", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="layer-row-start-button"]').trigger("dragstart");
    await wrapper.get('[data-testid="layer-row-date-label"]').trigger("drop");
    await wrapper.vm.$nextTick();

    const rows = wrapper.findAll(".layer-name-input").map((row) => (row.element as HTMLInputElement).value);
    expect(rows.slice(0, 3)).toEqual(["Time_Label", "Start_Button", "Date_Label"]);
  });

  it("adds an event binding for the selected widget from the inspector", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="inspector-events-tab"]').trigger("click");
    await wrapper.get('[data-testid="event-type-select"]').setValue("LV_EVENT_CLICKED");
    await wrapper.get('[data-testid="event-handler-input"]').setValue("on_time_clicked");
    await wrapper.get('[data-testid="add-event-button"]').trigger("click");

    expect(wrapper.text()).toContain("LV_EVENT_CLICKED");
    expect(wrapper.text()).toContain("on_time_clicked");
  });

  it("adds a normalized event binding for an explicit target widget", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    await wrapper.get('[data-testid="inspector-events-tab"]').trigger("click");
    await wrapper.get('[data-testid="event-target-select"]').setValue("date-label");
    await wrapper.get('[data-testid="event-type-select"]').setValue("LV_EVENT_READY");
    await wrapper.get('[data-testid="event-handler-input"]').setValue("123 ready handler!");
    await wrapper.get('[data-testid="add-event-button"]').trigger("click");

    expect(store.project.events).toContainEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
      widgetId: "date-label",
      event: "LV_EVENT_READY",
      handlerName: "handler_123_ready_handler"
    });
  });

  it("adds an event binding for the selected screen root", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    await wrapper.get('[data-testid="layers-nav-button"]').trigger("click");
    await wrapper.get('[data-testid="layer-row-screen-root"]').trigger("click");
    await wrapper.get('[data-testid="inspector-events-tab"]').trigger("click");
    await wrapper.get('[data-testid="event-type-select"]').setValue("LV_EVENT_READY");
    await wrapper.get('[data-testid="event-handler-input"]').setValue("on_screen_ready");
    await wrapper.get('[data-testid="add-event-button"]').trigger("click");

    expect((wrapper.get('[data-testid="event-target-select"]').element as HTMLSelectElement).value).toBe("root-screen-1");
    expect(store.project.events).toContainEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
      widgetId: "root-screen-1",
      event: "LV_EVENT_READY",
      handlerName: "on_screen_ready"
    });
  });

  it("uploads an asset from the assets panel and renders the returned asset", async () => {
    signInForCloudSaves();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && init?.method === "POST") {
        return Promise.resolve(projectCreateResponse());
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        return Promise.resolve(projectSaveResponse());
      }
      if (url === "/api/projects/project-1/assets" && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              asset: {
                id: "asset-1",
                projectId: "project-1",
                name: "icon_heart.png",
                kind: "image",
                mimeType: "image/png",
                width: 24,
                height: 24,
                sizeBytes: 12,
                objectKey: "projects/project-watch-demo/assets/asset-1/icon_heart.png",
                createdAt: "2026-05-08T00:00:00Z"
              }
            }),
            { status: 201 }
          )
        );
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const input = wrapper.get('[data-testid="asset-file-input"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["png"], "icon_heart.png", { type: "image/png" })]
    });

    await input.trigger("change");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/doc", expect.objectContaining({ method: "PUT" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/assets", expect.any(Object));
    expect(wrapper.text()).toContain("icon_heart.png");
    expect(wrapper.text()).toContain("24x24");
  });

  it("filters imported assets by name, kind and mime type", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const assetsStore = useAssetsStore(pinia);
    assetsStore.assets = [
      {
        id: "asset-heart",
        projectId: "project-watch-demo",
        name: "icon_heart.png",
        kind: "image",
        mimeType: "image/png",
        width: 24,
        height: 24,
        sizeBytes: 2048,
        objectKey: "projects/project-watch-demo/assets/icon_heart.png",
        createdAt: "2026-05-08T00:00:00Z"
      },
      {
        id: "asset-logo",
        projectId: "project-watch-demo",
        name: "brand_logo.jpg",
        kind: "image",
        mimeType: "image/jpeg",
        width: 64,
        height: 32,
        sizeBytes: 4096,
        objectKey: "projects/project-watch-demo/assets/brand_logo.jpg",
        createdAt: "2026-05-08T00:00:00Z"
      }
    ];
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("icon_heart.png");
    expect(wrapper.text()).toContain("brand_logo.jpg");

    await wrapper.get('[data-testid="asset-search-input"]').setValue("jpeg");

    expect(wrapper.text()).not.toContain("icon_heart.png");
    expect(wrapper.text()).toContain("brand_logo.jpg");

    await wrapper.get('[data-testid="asset-search-input"]').setValue("missing");

    expect(wrapper.text()).toContain("No matching assets");
  });

  it("requires a cloud project before uploading assets to the local seeded project", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const input = wrapper.get('[data-testid="asset-file-input"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["png"], "icon_heart.png", { type: "image/png" })]
    });

    await input.trigger("change");
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("sign in before uploading assets");
    expect(wrapper.text()).toContain("Sign in before uploading assets");
  });

  it("binds an uploaded image asset to a selected image widget", async () => {
    signInForCloudSaves();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn().mockReturnValue("blob:icon-heart") });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && init?.method === "POST") {
        return Promise.resolve(projectCreateResponse());
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        return Promise.resolve(projectSaveResponse());
      }
      if (url === "/api/projects/project-1/assets" && init?.method === "POST") {
        return Promise.resolve(assetUploadResponse());
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-image"]').trigger("click");
    const input = wrapper.get('[data-testid="asset-file-input"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["png"], "icon_heart.png", { type: "image/png" })]
    });
    await input.trigger("change");
    await flushPromises();

    await wrapper.get('[data-testid="image-asset-select"]').setValue("asset-1");

    const canvasImage = wrapper.get('[data-testid="canvas-widget-image-1"] img');
    expect(canvasImage.attributes("src")).toBe("blob:icon-heart");
    expect(canvasImage.attributes("alt")).toBe("icon_heart.png");
  });

  it("shows an explicit placeholder when an image asset preview URL is unavailable", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const projectStore = useProjectStore(pinia);
    projectStore.registerAsset({
      id: "asset-missing-preview",
      projectId: "project-watch-demo",
      name: "icon_heart.png",
      kind: "image",
      mimeType: "image/png",
      width: 32,
      height: 32,
      sizeBytes: 128,
      objectKey: "projects/project-watch-demo/assets/icon_heart.png",
      createdAt: "2026-05-08T00:00:00Z"
    });

    await wrapper.get('[data-testid="widget-card-image"]').trigger("click");
    await wrapper.get('[data-testid="image-asset-select"]').setValue("asset-missing-preview");

    expect(wrapper.get('[data-testid="canvas-widget-image-1"] .image-placeholder').text()).toContain("Missing preview");

    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    expect(wrapper.get('[data-testid="preview-widget-image-1"] .image-placeholder').text()).toContain("Missing preview");
  });

  it("deletes an asset from the assets panel and ProjectDoc", async () => {
    signInForCloudSaves();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && init?.method === "POST") {
        return Promise.resolve(projectCreateResponse());
      }
      if (url === "/api/projects/project-1/assets" && init?.method === "POST") {
        return Promise.resolve(assetUploadResponse());
      }
      if (url === "/api/projects/project-1/assets/asset-1" && init?.method === "DELETE") {
        return Promise.resolve(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        return Promise.resolve(projectSaveResponse());
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const input = wrapper.get('[data-testid="asset-file-input"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["png"], "icon_heart.png", { type: "image/png" })]
    });

    await input.trigger("change");
    await flushPromises();
    expect(wrapper.text()).toContain("icon_heart.png");

    await wrapper.get('[data-testid="delete-asset-asset-1"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/assets/asset-1", expect.objectContaining({ method: "DELETE" }));
    expect(wrapper.text()).not.toContain("icon_heart.png");
  });

  it("confirms in-app before deleting an asset that is referenced by an image widget", async () => {
    signInForCloudSaves();
    const savedDocs: unknown[] = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && init?.method === "POST") {
        return Promise.resolve(projectCreateResponse());
      }
      if (url === "/api/projects/project-1/assets" && init?.method === "POST") {
        return Promise.resolve(assetUploadResponse());
      }
      if (url === "/api/projects/project-1/assets/asset-1" && init?.method === "DELETE") {
        return Promise.resolve(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        savedDocs.push(JSON.parse(String(init.body)).doc);
        return Promise.resolve(projectSaveResponse());
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-image"]').trigger("click");
    const input = wrapper.get('[data-testid="asset-file-input"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["png"], "icon_heart.png", { type: "image/png" })]
    });
    await input.trigger("change");
    await flushPromises();
    await wrapper.get('[data-testid="image-asset-select"]').setValue("asset-1");

    await wrapper.get('[data-testid="delete-asset-asset-1"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="asset-delete-confirm"]').text()).toContain("icon_heart.png");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/projects/project-1/assets/asset-1", expect.objectContaining({ method: "DELETE" }));

    await wrapper.get('[data-testid="cancel-delete-asset-button"]').trigger("click");
    expect(wrapper.find('[data-testid="asset-delete-confirm"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("icon_heart.png");

    await wrapper.get('[data-testid="delete-asset-asset-1"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="confirm-delete-asset-button"]').trigger("click");
    await flushPromises();

    const deleteCallIndex = fetchMock.mock.calls.findIndex(([url, init]) =>
      url === "/api/projects/project-1/assets/asset-1" && init?.method === "DELETE"
    );
    const saveBeforeDelete = [...fetchMock.mock.calls]
      .slice(0, deleteCallIndex)
      .reverse()
      .find(([url, init]) => url === "/api/projects/project-1/doc" && init?.method === "PUT");
    const savedBeforeDeleteDoc = JSON.parse(String(saveBeforeDelete?.[1]?.body)).doc as {
      assets: unknown[];
      screens: Array<{ root: { children: Array<{ props: Record<string, unknown> }> } }>;
    };
    expect(savedBeforeDeleteDoc.assets).toEqual([]);
    expect(savedBeforeDeleteDoc.screens[0].root.children[0].props.assetId).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/assets/asset-1", expect.objectContaining({ method: "DELETE" }));
    expect(wrapper.text()).not.toContain("icon_heart.png");
  });

  it("counts font asset usage and confirms before deleting a referenced font", async () => {
    signInForCloudSaves();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && init?.method === "POST") {
        return Promise.resolve(projectCreateResponse());
      }
      if (url === "/api/projects/project-1/assets" && init?.method === "POST") {
        return Promise.resolve(fontAssetUploadResponse());
      }
      if (url === "/api/projects/project-1/assets/font-1" && init?.method === "DELETE") {
        return Promise.resolve(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        return Promise.resolve(projectSaveResponse());
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const input = wrapper.get('[data-testid="asset-file-input"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["font"], "watch_digits.ttf", { type: "font/ttf" })]
    });
    await input.trigger("change");
    await flushPromises();

    await wrapper.get('[data-testid="style-font-select"]').setValue("font-1");
    await flushPromises();

    expect(wrapper.get('[data-testid="asset-usage-font-1"]').text()).toBe("Used 1");

    await wrapper.get('[data-testid="delete-asset-font-1"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="asset-delete-confirm"]').text()).toContain("watch_digits.ttf");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/projects/project-1/assets/font-1", expect.objectContaining({ method: "DELETE" }));
  });

  it("does not delete a referenced asset when clearing references cannot be saved", async () => {
    signInForCloudSaves();
    let saveCount = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && init?.method === "POST") {
        return Promise.resolve(projectCreateResponse());
      }
      if (url === "/api/projects/project-1/assets" && init?.method === "POST") {
        return Promise.resolve(assetUploadResponse());
      }
      if (url === "/api/projects/project-1/assets/asset-1" && init?.method === "DELETE") {
        return Promise.resolve(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        saveCount += 1;
        if (saveCount === 1) {
          return Promise.resolve(projectSaveResponse());
        }
        return Promise.resolve(new Response(JSON.stringify({ error: { code: "SAVE_FAILED", message: "save failed" } }), { status: 500 }));
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-image"]').trigger("click");
    const input = wrapper.get('[data-testid="asset-file-input"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["png"], "icon_heart.png", { type: "image/png" })]
    });
    await input.trigger("change");
    await flushPromises();
    await wrapper.get('[data-testid="image-asset-select"]').setValue("asset-1");
    await wrapper.get('[data-testid="delete-asset-asset-1"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="confirm-delete-asset-button"]').trigger("click");
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalledWith("/api/projects/project-1/assets/asset-1", expect.objectContaining({ method: "DELETE" }));
    expect(wrapper.text()).toContain("icon_heart.png");
    expect(wrapper.text()).toContain("Save failed");
  });

  it("creates a widget from the widget palette and deletes it with keyboard", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-label"]').trigger("click");

    expect(wrapper.text()).toContain("Label_1");
    expect(wrapper.get('[data-testid="selector-input"]').element).toHaveProperty("value", "Label_1");

    await document.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).not.toContain("Label_1");
    expect(wrapper.get('[data-testid="inspector-empty-state"]').text()).toContain("No widget selected");
    expect(wrapper.find('[data-testid="selector-input"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("copies and pastes the selected widget with keyboard shortcuts", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="canvas-widget-time-label"]').trigger("click");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "c", metaKey: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "v", metaKey: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="canvas-widget-time-label-1"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="selector-input"]').element).toHaveProperty("value", "Time_Label_1");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="canvas-widget-time-label-1"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("duplicates the selected widget with the keyboard shortcut", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="canvas-widget-time-label"]').trigger("click");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "d", metaKey: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="canvas-widget-time-label-1"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="selector-input"]').element).toHaveProperty("value", "Time_Label_1");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="canvas-widget-time-label-1"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("duplicates the selected widget from the toolbar action", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="canvas-widget-time-label"]').trigger("click");
    await wrapper.get('[data-testid="duplicate-widget-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="canvas-widget-time-label-1"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="selector-input"]').element).toHaveProperty("value", "Time_Label_1");
  });

  it("disables the duplicate toolbar action for locked widgets", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="duplicate-widget-button"]').element).toHaveProperty("disabled", false);

    await wrapper.get('[data-testid="layer-lock-time-label"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="duplicate-widget-button"]').element).toHaveProperty("disabled", true);
  });

  it("nudges the selected widget with arrow keys", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="canvas-widget-time-label"]').trigger("click");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true }));
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    expect((wrapper.get('[data-testid="layout-x-input"]').element as HTMLInputElement).value).toBe("151");
    expect((wrapper.get('[data-testid="layout-y-input"]').element as HTMLInputElement).value).toBe("50");
    wrapper.unmount();
  });

  it("saves the project from the toolbar and reflects save state", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="save-project-button"]').trigger("click");
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("All changes saved");
    expect(wrapper.get('[data-testid="persistence-status"]').text()).toBe("Local project");
  });

  it("autosaves ProjectDoc edits after a debounce", async () => {
    signInForCloudSaves();
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(projectCreateResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ projectId: "project-1", updatedAt: "2026-05-08T00:00:00Z" }), {
          status: 200
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="selected-text-input"]').setValue("12:45");
    await vi.advanceTimersByTimeAsync(799);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/projects", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/doc", expect.any(Object));
  });

  it("mounts the simulator canvas and resizes it to the project target", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    await flushPromises();

    const canvas = wrapper.get('[data-testid="simulator-canvas"]').element as HTMLCanvasElement;
    expect(canvas.width).toBe(480);
    expect(canvas.height).toBe(480);
  });

  it("toggles the simulator panel from the toolbar and remounts the preview canvas", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="simulator-canvas"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="simulator-toggle-button"]').attributes("aria-pressed")).toBe("true");

    await wrapper.get('[data-testid="simulator-toggle-button"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="simulator-canvas"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="simulator-toggle-button"]').attributes("aria-pressed")).toBe("false");

    await wrapper.get('[data-testid="simulator-toggle-button"]').trigger("click");
    await flushPromises();
    const canvas = wrapper.get('[data-testid="simulator-canvas"]').element as HTMLCanvasElement;
    expect(canvas.width).toBe(480);
    expect(canvas.height).toBe(480);
  });

  it("renders the active screen into the simulator runtime", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    await flushPromises();

    await wrapper.get('[data-testid="add-screen-button"]').trigger("click");
    await flushPromises();

    const canvas = wrapper.get('[data-testid="simulator-canvas"]').element as HTMLCanvasElement;
    expect(canvas.dataset.lvglScreen).toBe("Screen_2");
    expect(wrapper.text()).toContain("Rendering Screen_2");
  });

  it("writes simulator render failures to the log", async () => {
    signInForCloudSaves();
    const brokenDoc = {
      schemaVersion: 1,
      id: "project-broken",
      name: "Broken Image UI",
      target: { lvglVersion: "8.3", deviceName: "ESP32-S3", width: 480, height: 480, dpi: 240, colorDepth: 16 },
      theme: "dark",
      screens: [{
        id: "screen-1",
        name: "Screen_1",
        root: {
          id: "root-screen-1",
          type: "screen",
          name: "Screen_1",
          parentId: null,
          children: [{
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
          }],
          layout: { x: 0, y: 0, width: 480, height: 480 },
          props: {},
          style: {},
          locked: false,
          hidden: false
        }
      }],
      assets: [],
      styles: [],
      events: [],
      updatedAt: "2026-05-08T00:00:00Z"
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ project: { id: "project-broken", name: "Broken Image UI", doc: brokenDoc } }), {
          status: 201
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ assets: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="new-project-button"]').trigger("click");
    await wrapper.get('[data-testid="confirm-new-project-button"]').trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("MISSING_ASSET: Missing asset: missing-asset");
  });

  it("creates a cloud project from the toolbar", async () => {
    signInForCloudSaves();
    const returnedDoc = {
      schemaVersion: 1,
      id: "project-2",
      name: "Factory Panel",
      target: { lvglVersion: "8.3", deviceName: "ESP32-S3", width: 480, height: 480, dpi: 240, colorDepth: 16 },
      theme: "dark",
      screens: [{
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
      }],
      assets: [],
      styles: [],
      events: [],
      updatedAt: "2026-05-08T00:00:00Z"
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ project: { id: "project-2", name: "Factory Panel", doc: returnedDoc } }), { status: 201 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ assets: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="new-project-button"]').trigger("click");
    expect(wrapper.get('[data-testid="new-project-dialog"]').text()).toContain("Create cloud project");
    await wrapper.get('[data-testid="new-project-name-input"]').setValue("Factory Panel");
    await wrapper.get('[data-testid="confirm-new-project-button"]').trigger("submit");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/projects", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).name).toBe("Factory Panel");
    expect(wrapper.text()).toContain("Factory Panel");
    expect(wrapper.find('[data-testid="new-project-dialog"]').exists()).toBe(false);
  });

  it("requires login before creating or loading cloud projects from the toolbar", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="new-project-button"]').trigger("click");
    await wrapper.get('[data-testid="load-projects-button"]').trigger("click");
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Sign in before creating cloud projects");
    expect(wrapper.text()).toContain("Sign in before loading cloud projects");
  });

  it("logs in with the demo account from the toolbar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "demo-token",
          user: { id: "user-demo", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="demo-login-button"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" }));
    expect(wrapper.text()).toContain("Hiveton Demo");
    expect(wrapper.get('[data-testid="persistence-status"]').text()).toBe("Cloud project not created");
  });

  it("logs in with email and password then logs out", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "user-token",
          user: { id: "user-demo", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="login-email-input"]').setValue("demo@hiveton.dev");
    await wrapper.get('[data-testid="login-password-input"]').setValue("password");
    await wrapper.get('[data-testid="login-button"]').trigger("submit");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "demo@hiveton.dev", password: "password" })
    }));
    expect(wrapper.text()).toContain("Hiveton Demo");

    await wrapper.get('[data-testid="logout-button"]').trigger("click");
    expect(wrapper.find('[data-testid="current-user"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="login-button"]').exists()).toBe(true);
  });

  it("loads the project list and opens a selected cloud project", async () => {
    signInForCloudSaves();
    const openedDoc = {
      schemaVersion: 1,
      id: "project-2",
      name: "Factory Panel",
      target: { lvglVersion: "8.3", deviceName: "ESP32-S3", width: 480, height: 480, dpi: 240, colorDepth: 16 },
      theme: "dark",
      screens: [{
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
      }],
      assets: [],
      styles: [],
      events: [],
      updatedAt: "2026-05-08T00:00:00Z"
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            projects: [
              { id: "project-watch-demo", name: "My Watch UI" },
              { id: "project-same-name", name: "My Watch UI" },
              { id: "project-2", name: "Factory Panel" }
            ]
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ project: { id: "project-2", name: "Factory Panel", doc: openedDoc } }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ assets: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="load-projects-button"]').trigger("click");
    await flushPromises();
    const options = wrapper.findAll('[data-testid="project-select"] option').map((option) => option.text());
    expect(options).toEqual(["My Watch UI (tch-demo)", "My Watch UI (ame-name)", "Factory Panel"]);
    await wrapper.get('[data-testid="project-select"]').setValue("project-2");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/projects", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-2", expect.any(Object));
    expect(wrapper.text()).toContain("Factory Panel");
  });

  it("hides widgets from canvas and locks layout edits from the layers panel", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.find('[data-testid="canvas-widget-date-label"]').exists()).toBe(true);

    await wrapper.get('[data-testid="layer-row-date-label"]').trigger("click");
    await wrapper.get('[data-testid="layer-hide-date-label"]').trigger("click");
    expect(wrapper.find('[data-testid="canvas-widget-date-label"]').exists()).toBe(false);
    expect((wrapper.get('[data-testid="layer-name-date-label"]').element as HTMLInputElement).value).toBe("Date_Label");
    expect(wrapper.get('[data-testid="layer-state-date-label"]').text()).toContain("Hidden");

    await wrapper.get('[data-testid="layer-lock-date-label"]').trigger("click");
    expect(wrapper.get('[data-testid="layer-state-date-label"]').text()).toContain("Locked");
    expect(wrapper.get('[data-testid="layer-hide-date-label"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="layer-up-date-label"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="layer-down-date-label"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="layer-delete-date-label"]').attributes("disabled")).toBeDefined();
    await wrapper.get('[data-testid="inspector-style-tab"]').trigger("click");
    expect(wrapper.get('[data-testid="selected-text-input"]').attributes("disabled")).toBeDefined();
    await wrapper.get('[data-testid="inspector-events-tab"]').trigger("click");
    expect(wrapper.get('[data-testid="event-type-select"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="event-handler-input"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="add-event-button"]').attributes("disabled")).toBeDefined();

    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    expect(wrapper.get('[data-testid="layout-x-input"]').attributes("disabled")).toBeDefined();

    await document.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="layer-row-date-label"]').exists()).toBe(true);
  });

  it("updates target device settings from the inspector", async () => {
    vi.useFakeTimers();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    await wrapper.get('[data-testid="target-device-name-input"]').setValue("STM32-HMI");
    await wrapper.get('[data-testid="target-lvgl-version-select"]').setValue("8.3");
    await wrapper.get('[data-testid="target-width-input"]').setValue("320");
    await wrapper.get('[data-testid="target-height-input"]').setValue("240");
    await wrapper.get('[data-testid="target-dpi-input"]').setValue("160");
    await wrapper.get('[data-testid="target-color-depth-select"]').setValue("32");
    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();

    expect(wrapper.text()).toContain("STM32-HMI (320x240)");
    expect(wrapper.find('[data-testid="settings-panel"]').exists()).toBe(false);
    expect((wrapper.get('[data-testid="simulator-canvas"]').element as HTMLCanvasElement).width).toBe(320);
    expect((wrapper.get('[data-testid="simulator-canvas"]').element as HTMLCanvasElement).height).toBe(240);
  });

  it("shows target setting validation errors without changing ProjectDoc", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();

    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    await wrapper.get('[data-testid="target-width-input"]').setValue("0");

    expect(wrapper.get('[data-testid="target-width-error"]').text()).toBe("width must be greater than 0");
    expect(store.project.target.width).toBe(480);

    await wrapper.get('[data-testid="target-width-input"]').setValue("320");
    expect(wrapper.find('[data-testid="target-width-error"]').exists()).toBe(false);
    expect(store.project.target.width).toBe(320);

    await wrapper.get('[data-testid="canvas-target-settings-button"]').trigger("click");
    await wrapper.get('[data-testid="settings-target-height-input"]').setValue("-1");
    await wrapper.get('[data-testid="settings-target-dpi-input"]').setValue("bad");

    expect(wrapper.get('[data-testid="settings-target-height-error"]').text()).toBe("height must be greater than 0");
    expect(wrapper.get('[data-testid="settings-target-dpi-error"]').text()).toBe("dpi must be a number");
    expect(store.project.target.height).toBe(480);
    expect(store.project.target.dpi).toBe(240);
  });

  it("shows target device name validation errors without changing ProjectDoc", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();

    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    await wrapper.get('[data-testid="target-device-name-input"]').setValue("   ");

    expect(wrapper.get('[data-testid="target-device-name-error"]').text()).toBe("deviceName is required");
    expect(store.project.target.deviceName).toBe("ESP32-S3");

    await wrapper.get('[data-testid="target-device-name-input"]').setValue("STM32-HMI");
    expect(wrapper.find('[data-testid="target-device-name-error"]').exists()).toBe(false);
    expect(store.project.target.deviceName).toBe("STM32-HMI");

    await wrapper.get('[data-testid="canvas-target-settings-button"]').trigger("click");
    await wrapper.get('[data-testid="settings-target-device-name-input"]').setValue("");

    expect(wrapper.get('[data-testid="settings-target-device-name-error"]').text()).toBe("deviceName is required");
    expect(store.project.target.deviceName).toBe("STM32-HMI");
  });

  it("switches inspector tabs between style, events and layout panels", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.find('[data-testid="style-text-color-input"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="event-type-select"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="layout-x-input"]').exists()).toBe(false);

    await wrapper.get('[data-testid="inspector-events-tab"]').trigger("click");
    expect(wrapper.find('[data-testid="style-text-color-input"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="event-type-select"]').exists()).toBe(true);

    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    expect(wrapper.find('[data-testid="event-type-select"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="layout-x-input"]').exists()).toBe(true);
  });
});
