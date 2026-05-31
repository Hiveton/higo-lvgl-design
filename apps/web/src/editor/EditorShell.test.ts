import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAuthToken, getAuthToken, setAuthToken } from "../api/auth";
import { createDefaultProjectDoc, type ScreenNode } from "@hiveton-lvgl/schema";
import EditorShell from "./EditorShell.vue";
import LogPanel from "./LogPanel.vue";
import ScreensPanel from "./ScreensPanel.vue";
import { useAssetsStore } from "../stores/assets";
import { useAuthStore } from "../stores/auth";
import { useLocaleStore } from "../stores/locale";
import { useProjectStore } from "../stores/project";

function assetUploadResponse(projectId = "project-1"): Response {
  return new Response(
    JSON.stringify({
      asset: {
        id: "asset-1",
        projectId,
        name: "icon_heart.png",
        kind: "image",
        mimeType: "image/png",
        sizeBytes: 12,
        objectKey: `projects/${projectId}/assets/asset-1/icon_heart.png`,
        createdAt: "2026-05-08T00:00:00Z"
      }
    }),
    { status: 201 }
  );
}

function fontAssetUploadResponse(projectId = "project-1"): Response {
  return new Response(
    JSON.stringify({
      asset: {
        id: "font-1",
        projectId,
        name: "watch_digits.ttf",
        kind: "font",
        mimeType: "font/ttf",
        sizeBytes: 2048,
        objectKey: `projects/${projectId}/assets/font-1/watch_digits.ttf`,
        createdAt: "2026-05-08T00:00:00Z"
      }
    }),
    { status: 201 }
  );
}

function projectSaveResponse(projectId = "project-1"): Response {
  return new Response(JSON.stringify({ projectId, updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 });
}

function projectCreateResponse(projectId = "project-1"): Response {
  return new Response(
    JSON.stringify({
      project: {
        id: projectId,
        name: "My Watch UI",
        createdAt: "2026-05-08T00:00:00Z",
        updatedAt: "2026-05-08T00:00:00Z",
        doc: apiProjectDoc(projectId, "My Watch UI")
      }
    }),
    { status: 201 }
  );
}

function apiProjectDoc(id: string, name: string) {
  return createDefaultProjectDoc({
    id,
    name,
    updatedAt: "2026-05-08T00:00:00Z"
  });
}

function apiProject(id: string, name: string, doc: unknown) {
  return {
    id,
    name,
    doc,
    createdAt: "2026-05-08T00:00:00Z",
    updatedAt: "2026-05-08T00:00:00Z"
  };
}

function job(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "job-1",
    kind: "export_c",
    status: "queued",
    progress: 0,
    logs: [],
    ...overrides
  };
}

function signInForCloudSaves(): void {
  localStorage.setItem("lvgl-editor-token", "demo-token");
}

afterEach(() => {
  clearAuthToken();
  localStorage.removeItem("lvgl-editor-locale");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("EditorShell", () => {
  it("renders the complete LVGL editor workspace chrome", () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.text()).toContain("LVGL Online Editor");
    expect(wrapper.text()).toContain("Widgets");
    expect(wrapper.text()).toContain("Layers");
    expect(wrapper.text()).toContain("Canvas");
    expect(wrapper.text()).toContain("Inspector");
    expect(wrapper.text()).toContain("Events");
    expect(wrapper.text()).toContain("Layout");
    expect(wrapper.text()).toContain("Assets");
    expect(wrapper.text()).toContain("Console");
    expect(wrapper.text()).toContain("Simulator");
    expect(wrapper.text()).toContain("All changes saved");
    expect(wrapper.get('[data-testid="persistence-status"]').text()).toBe("Local project");
    expect(wrapper.get('[data-testid="persistence-status"]').classes()).toContain("status-pill");
    expect(wrapper.get('[data-testid="status-lvgl-version"]').classes()).toContain("status-pill");
    expect(wrapper.get('[data-testid="status-dpi"]').classes()).toContain("status-pill");
    expect(wrapper.get('[data-testid="status-coordinates"]').classes()).toContain("status-pill");
    expect(wrapper.text()).toContain("LVGL v8.3");
    expect(wrapper.text()).toContain("DPI: 240");
    expect(wrapper.get('[data-testid="project-name-input"]').attributes("aria-label")).toBe("Project name");
    expect(wrapper.get('[data-testid="project-name-input"]').attributes("title")).toBe("Project name");
    expect(wrapper.get('[data-testid="save-project-button"]').attributes("aria-label")).toBe("Save My Watch UI project");
    expect(wrapper.get('[data-testid="save-project-button"]').attributes("title")).toBe("Save My Watch UI project");
    expect(wrapper.get('[data-testid="target-settings-button"]').attributes("aria-label")).toBe("Open target settings for ESP32-S3 (480x480)");
    expect(wrapper.get('[data-testid="target-settings-button"]').attributes("title")).toBe("Open target settings for ESP32-S3 (480x480)");
    expect(wrapper.get('[data-testid="canvas-add-screen-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="canvas-add-screen-button"]').attributes("aria-label")).toBe("Add screen from canvas toolbar");
    expect(wrapper.get('[data-testid="canvas-add-screen-button"]').attributes("title")).toBe("Add screen from canvas toolbar");
    expect(wrapper.find('[data-testid="screen-row-screen-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="screen-row-heart-rate"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="screen-row-heart rate"]').exists()).toBe(false);
    expect((wrapper.get('[data-testid="layer-name-settings-button"]').element as HTMLInputElement).value).toBe("Settings_Button");
    expect(wrapper.get('[data-testid="canvas-widget-steps-metric"]').text()).toContain("7,842");
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Editor ready");
    expect(wrapper.get('[data-testid="status-activity"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="status-activity"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="status-activity"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.get('[data-testid="status-save-dot"]').attributes("role")).toBe("img");
    expect(wrapper.get('[data-testid="status-save-dot"]').attributes("aria-label")).toBe("Save status: All changes saved");
    expect(wrapper.get('[data-testid="status-save-dot"]').attributes("title")).toBe("Save status: All changes saved");
    expect(wrapper.text()).not.toContain("Build completed successfully");
  });

  it("switches toolbar chrome copy between English and Chinese", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="locale-select"]').element).toHaveProperty("value", "en-US");
    expect(wrapper.get('[data-testid="preview-button"]').text()).toBe("Preview");

    await wrapper.get('[data-testid="locale-select"]').setValue("zh-CN");

    expect(localStorage.getItem("lvgl-editor-locale")).toBe("zh-CN");
    expect(wrapper.get('[data-testid="preview-button"]').text()).toBe("预览");
    expect(wrapper.get('[data-testid="build-button"]').text()).toBe("登录后构建");
    expect(wrapper.text()).toContain("语言");
    expect(wrapper.get('[data-testid="widgets-nav-button"]').text()).toContain("控件");
    expect(wrapper.get('[data-testid="layers-nav-button"]').text()).toContain("图层");
    expect(wrapper.get('[data-testid="screens-nav-button"]').text()).toContain("屏幕");
    expect(wrapper.get('[data-testid="widget-search-input"]').attributes("placeholder")).toBe("搜索控件...");
    expect(wrapper.get('[data-testid="widget-card-button"]').text()).toContain("按钮");
    expect(wrapper.get('[data-testid="widget-card-label"]').text()).toContain("文本");
    expect(wrapper.get('[data-testid="widget-card-switch"]').attributes("aria-label")).toBe("添加 开关 控件");
    expect(wrapper.get('[data-testid="layer-list-header"]').text()).toContain("对象");
    expect(wrapper.get('[data-testid="screen-list-header"]').text()).toContain("屏幕");
    expect(wrapper.get('[data-testid="layer-row-time-label"]').attributes("aria-label")).toBe("选择 Time_Label 文本 图层");
    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("title")).toBe("选择并拖拽 Time_Label 文本 控件");

    await wrapper.get('[data-testid="resources-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="sample-asset-heart-png"]').attributes("aria-label")).toBe("选择参考资源 heart.png，图片，图片 64x64");
  });

  it("shows Chinese project menu and new project dialog copy", async () => {
    signInForCloudSaves();
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="locale-select"]').setValue("zh-CN");
    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("click");

    expect(wrapper.get('[data-testid="menu-project-count"]').text()).toBe("0 个云项目");
    expect(wrapper.get('[data-testid="menu-load-projects-button"]').text()).toBe("刷新云项目");
    expect(wrapper.get('[data-testid="menu-project-empty-state"]').text()).toContain("尚未加载云项目");
    expect(wrapper.get('[data-testid="menu-new-project-button"]').text()).toBe("创建云项目");
    expect(wrapper.get('[data-testid="menu-login-email-input"]').attributes("placeholder")).toBe("邮箱");
    expect(wrapper.get('[data-testid="menu-login-password-input"]').attributes("placeholder")).toBe("密码");
    expect(wrapper.get('[data-testid="menu-demo-login-button"]').text()).toBe("演示登录");

    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("click");
    await wrapper.get('[data-testid="new-project-button"]').trigger("click");

    expect(wrapper.get("#new-project-dialog-title").text()).toBe("创建云项目");
    expect(wrapper.get("#new-project-dialog-description").text()).toContain("创建到云端存储前");
    expect(wrapper.get('[data-testid="new-project-name-input"]').attributes("aria-label")).toBe("云项目名称");
    expect(wrapper.get('[data-testid="cancel-new-project-button"]').text()).toBe("取消");
    expect(wrapper.get('[data-testid="confirm-new-project-button"]').text()).toBe("创建项目");
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
      attachTo: document.body,
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
      attachTo: document.body,
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
      attachTo: document.body,
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

  it("uses the current locale for new widget default display text", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia]
      }
    });
    useLocaleStore(pinia).setLocale("zh-CN");
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-testid="widget-card-label"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-button"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-checkbox"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-dropdown"]').trigger("click");

    expect(wrapper.get('[data-testid="canvas-widget-label-1"]').text()).toContain("文本");
    expect(wrapper.get('[data-testid="canvas-widget-button-1"]').text()).toContain("按钮");
    expect(wrapper.get('[data-testid="canvas-widget-checkbox-1"] .checkbox-preview').text()).toContain("复选框");
    expect(wrapper.get('[data-testid="canvas-widget-dropdown-1"] .dropdown-preview').text()).toContain("选项 1");

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    const preview = wrapper.get('[data-testid="code-preview"]').text();
    expect(preview).toContain('lv_label_set_text(ui_Label_1, "文本");');
    expect(preview).toContain('lv_label_set_text(ui_Button_1_Label, "按钮");');
    expect(preview).toContain('lv_checkbox_set_text(ui_Checkbox_1, "复选框");');
    expect(preview).toContain('lv_dropdown_set_options(ui_Dropdown_1, "选项 1\\n选项 2");');
  });

  it("uses localized dropdown fallback text for legacy docs without options", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);
    useLocaleStore(pinia).setLocale("zh-CN");
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-testid="widget-card-dropdown"]').trigger("click");
    const dropdown = store.selectedWidget;
    if (!dropdown) {
      throw new Error("expected selected dropdown");
    }
    delete dropdown.props.options;
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="canvas-widget-dropdown-1"] .dropdown-preview').text()).toContain("选项 1");
    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    expect(wrapper.get('[data-testid="preview-control-dropdown-1"]').text()).toContain("选项 1");
    wrapper.unmount();
  });

  it("filters widgets from the palette search", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="widget-search-input"]').attributes("aria-label")).toBe("Search widgets");
    expect(wrapper.get('[data-testid="widget-search-input"]').attributes("title")).toBe("Search widgets");

    await wrapper.get('[data-testid="widget-search-input"]').setValue("slide");

    expect(wrapper.find('[data-testid="widget-card-slider"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="widget-card-slider"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="widget-card-slider"]').attributes("aria-label")).toBe("Add Slider widget");
    expect(wrapper.get('[data-testid="widget-card-slider"]').attributes("title")).toBe("Add Slider widget");
    expect(wrapper.find('[data-testid="widget-card-label"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="widget-card-button"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="widget-result-count"]').text()).toBe("1 widget");
    expect(wrapper.get('[data-testid="widget-result-count"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="widget-result-count"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="widget-result-count"]').attributes("aria-atomic")).toBe("true");

    await wrapper.get('[data-testid="widget-search-input"]').setValue("does-not-exist");

    expect(wrapper.get('[data-testid="widget-empty-state"]').text()).toContain("No widgets match");
    expect(wrapper.get('[data-testid="widget-empty-state"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="widget-empty-state"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="widget-empty-state"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.get('[data-testid="clear-widget-search-button"]').attributes("title")).toBe("Clear widget search");
    expect(wrapper.get('[data-testid="clear-widget-search-button"] svg').attributes("data-icon-name")).toBe("close");

    await wrapper.get('[data-testid="clear-widget-search-button"]').trigger("click");

    expect((wrapper.get('[data-testid="widget-search-input"]').element as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(wrapper.get('[data-testid="widget-search-input"]').element);
    expect(wrapper.find('[data-testid="widget-card-button"]').exists()).toBe(true);
  });

  it("disables undo and redo until history has matching actions", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="new-project-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="load-projects-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="save-project-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="undo-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="redo-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="copy-widget-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="paste-widget-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="delete-widget-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="grid-toggle"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="snap-toggle"]').attributes("type")).toBe("button");

    expect(wrapper.get('[data-testid="undo-button"]').element).toHaveProperty("disabled", true);
    expect(wrapper.get('[data-testid="redo-button"]').element).toHaveProperty("disabled", true);

    await wrapper.get('[data-testid="selected-text-input"]').setValue("12:45");

    expect(wrapper.get('[data-testid="undo-button"]').element).toHaveProperty("disabled", false);
    expect(wrapper.get('[data-testid="redo-button"]').element).toHaveProperty("disabled", true);

    await wrapper.get('[data-testid="undo-button"]').trigger("click");

    expect(wrapper.get('[data-testid="undo-button"]').element).toHaveProperty("disabled", true);
    expect(wrapper.get('[data-testid="redo-button"]').element).toHaveProperty("disabled", false);

    await wrapper.get('[data-testid="redo-button"]').trigger("click");

    expect(wrapper.get('[data-testid="undo-button"]').element).toHaveProperty("disabled", false);
    expect(wrapper.get('[data-testid="redo-button"]').element).toHaveProperty("disabled", true);
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
      store.project.styles.push({
        id: "style-primary",
        name: "Primary Button",
        style: {
          bgColor: "#2FBF71",
          textColor: "#FFFFFF",
          radius: 12,
          padding: { top: 0, right: 8, bottom: 0, left: 8 }
        }
      });
      timeLabel.style.textColor = "#abc";
      timeLabel.style.bgColor = "red";
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
      store.registerAsset({
        id: "asset-icon-heart-copy",
        projectId: store.project.id,
        name: "icon-heart.png",
        kind: "image",
        mimeType: "image/png",
        width: 16,
        height: 16,
        sizeBytes: 1024,
        objectKey: "projects/project-watch-demo/assets/icon-heart-copy.png",
        createdAt: "2026-05-08T00:00:00Z"
      });
      store.addWidgetFromCatalog("image", { x: 160, y: 60 });
      store.bindSelectedImageAsset("asset-icon-heart-copy");
    }

    await wrapper.get('[data-testid="widget-card-container"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-label"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-slider"]').trigger("click");
    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    const preview = wrapper.get('[data-testid="code-preview"]').text();
    expect(preview).toContain("lv_obj_t * ui_Time_Label;");
    expect(preview).toContain("lv_obj_t * ui_Settings_Button_Label;");
    expect(preview).toContain("static lv_style_t ui_style_Primary_Button;");
    expect(preview).toContain("static void ui_init_styles(void)");
    expect(preview).toContain("lv_style_init(&ui_style_Primary_Button);");
    expect(preview).toContain("lv_style_set_bg_color(&ui_style_Primary_Button, lv_color_hex(0x2FBF71));");
    expect(preview).toContain("lv_style_set_text_color(&ui_style_Primary_Button, lv_color_hex(0xFFFFFF));");
    expect(preview).toContain("lv_style_set_radius(&ui_style_Primary_Button, 12);");
    expect(preview).toContain("lv_style_set_pad_left(&ui_style_Primary_Button, 8);");
    expect(preview).toContain("lv_style_set_pad_right(&ui_style_Primary_Button, 8);");
    expect(preview).toContain("lv_label_create(ui_Screen_1)");
    expect(preview).toContain("ui_init_styles();");
    expect(preview).toContain("lv_obj_set_layout(ui_Screen_1, LV_LAYOUT_FLEX);");
    expect(preview).toContain("lv_obj_set_flex_flow(ui_Screen_1, LV_FLEX_FLOW_COLUMN_WRAP);");
    expect(preview).toContain("lv_obj_set_style_bg_color(ui_Screen_1, lv_color_hex(0x101010), LV_PART_MAIN | LV_STATE_DEFAULT);");
    expect(preview).toContain("lv_obj_align(ui_Time_Label, LV_ALIGN_CENTER, 150, 40);");
    expect(preview).toContain('lv_label_set_text(ui_Time_Label, "10:09");');
    expect(preview).toContain("lv_obj_add_event_cb(ui_Time_Label, time_label_clicked, LV_EVENT_CLICKED, NULL);");
    expect(preview).toContain("lv_obj_set_style_text_color(ui_Time_Label, lv_color_hex(0xAABBCC), LV_PART_MAIN | LV_STATE_DEFAULT);");
    expect(preview).toContain("void time_label_clicked(lv_event_t * e)");
    expect(preview).toContain("/* User code can be added here. */");
    expect(preview).toContain('lv_label_set_text(ui_Settings_Button_Label, "Settings");');
    expect(preview).toContain("ui_Label_1 = lv_label_create(ui_Container_1);");
    expect(preview).toContain("lv_slider_set_range(ui_Slider_1, 0, 100);");
    expect(preview).toContain("lv_img_set_src(ui_Image_1, &ui_img_icon_heart_png);");
    expect(preview).toContain("lv_img_set_src(ui_Image_2, &ui_img_icon_heart_png_2);");
    expect(preview).not.toContain("0xtransparent");
    expect(preview).not.toContain("0xred");
  });

  it("blocks the generated code preview when an image widget references a missing asset", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);
    const root = store.activeScreen?.root;
    if (!root) {
      throw new Error("expected active screen root");
    }
    root.children.push({
      id: "broken-image",
      type: "image",
      name: "Broken_Image",
      parentId: root.id,
      children: [],
      layout: { x: 10, y: 20, width: 96, height: 96 },
      props: { assetId: "missing-asset" },
      style: {},
      locked: false,
      hidden: false
    });

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    const preview = wrapper.get('[data-testid="code-preview"]').text();
    expect(preview).toContain("Code generation blocked: missing image asset missing-asset");
    expect(preview).not.toContain("lv_img_set_src");
    wrapper.unmount();
  });

  it("blocks the generated code preview when a custom font asset reference is missing", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);
    const root = store.activeScreen?.root;
    if (!root) {
      throw new Error("expected active screen root");
    }
    root.children[0].style.font = "missing-font-asset";

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    const preview = wrapper.get('[data-testid="code-preview"]').text();
    expect(preview).toContain("Code generation blocked: missing font asset missing-font-asset");
    expect(preview).not.toContain("metadata only");
    wrapper.unmount();
  });

  it("blocks the generated code preview for unsupported lv_font symbols and reusable style font gaps", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);
    const root = store.activeScreen?.root;
    if (!root) {
      throw new Error("expected active screen root");
    }
    root.children[0].style.font = "lv_font_custom_24";
    store.project.styles.push({
      id: "style-custom-font",
      name: "Custom Font",
      style: { font: "missing-style-font" }
    });

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    const preview = wrapper.get('[data-testid="code-preview"]').text();
    expect(preview).toContain("Code generation blocked: missing font asset lv_font_custom_24");
    expect(preview).toContain("Code generation blocked: missing font asset missing-style-font");
    expect(preview).not.toContain("&lv_font_custom_24");
    wrapper.unmount();
  });

  it("blocks the generated code preview when asset references have the wrong kind", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);
    store.registerAsset({
      id: "font-asset",
      projectId: store.project.id,
      name: "brand.ttf",
      kind: "font",
      mimeType: "font/ttf",
      sizeBytes: 2048,
      objectKey: "projects/project-watch-demo/assets/font-asset/brand.ttf",
      createdAt: "2026-05-08T00:00:00Z"
    });
    store.registerAsset({
      id: "image-asset",
      projectId: store.project.id,
      name: "icon.png",
      kind: "image",
      mimeType: "image/png",
      width: 16,
      height: 16,
      sizeBytes: 1024,
      objectKey: "projects/project-watch-demo/assets/image-asset/icon.png",
      createdAt: "2026-05-08T00:00:00Z"
    });
    const root = store.activeScreen?.root;
    if (!root) {
      throw new Error("expected active screen root");
    }
    root.children.push({
      id: "wrong-image",
      type: "image",
      name: "Wrong_Image",
      parentId: root.id,
      children: [],
      layout: { x: 10, y: 20, width: 96, height: 96 },
      props: { assetId: "font-asset" },
      style: { font: "image-asset" },
      locked: false,
      hidden: false
    });

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    const preview = wrapper.get('[data-testid="code-preview"]').text();
    expect(preview).toContain("Code generation blocked: image widget must reference an image asset font-asset");
    expect(preview).toContain("Code generation blocked: font style must reference a font asset image-asset");
    expect(preview).not.toContain("lv_img_set_src");
    wrapper.unmount();
  });

  it("keeps generated code preview symbols unique for duplicate widget names", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);
    const root = store.activeScreen!.root;
    const first = root.children.find((widget) => widget.id === "time-label")!;
    const second = root.children.find((widget) => widget.id === "date-label")!;
    first.name = "Duplicate";
    second.name = "Duplicate";
    first.type = "button";
    first.props = { text: "Primary" };
    second.type = "button";
    second.props = { text: "Secondary" };
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    const preview = wrapper.get('[data-testid="code-preview"]').text();
    expect(preview).toContain("lv_obj_t * ui_Duplicate;");
    expect(preview).toContain("lv_obj_t * ui_Duplicate_Label;");
    expect(preview).toContain("lv_obj_t * ui_Duplicate_2;");
    expect(preview).toContain("lv_obj_t * ui_Duplicate_Label_2;");
    expect(preview).toContain("ui_Duplicate = lv_btn_create(ui_Screen_1);");
    expect(preview).toContain("ui_Duplicate_Label = lv_label_create(ui_Duplicate);");
    expect(preview).toContain("ui_Duplicate_2 = lv_btn_create(ui_Screen_1);");
    expect(preview).toContain("ui_Duplicate_Label_2 = lv_label_create(ui_Duplicate_2);");
    expect(preview.match(/ui_Duplicate = lv_btn_create/g)).toHaveLength(1);
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

  it("exposes canvas widget selection state to assistive navigation", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="canvas-widget-date-label"]').attributes("aria-pressed")).toBe("false");

    await wrapper.get('[data-testid="canvas-widget-date-label"]').trigger("click");

    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("aria-pressed")).toBe("false");
    expect(wrapper.get('[data-testid="canvas-widget-date-label"]').attributes("aria-pressed")).toBe("true");
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

    expect(wrapper.get('[data-testid="theme-select"]').attributes("aria-label")).toBe("Project theme");
    expect(wrapper.get('[data-testid="theme-select"]').attributes("title")).toBe("Project theme");
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
    expect(wrapper.find('[data-testid="settings-summary-target"]').classes()).toContain("settings-summary-value");
    expect(wrapper.find('[data-testid="settings-summary-save"]').classes()).toContain("settings-summary-value");
    expect(wrapper.get('[data-testid="settings-back-to-canvas-button"]').attributes("aria-label")).toBe("Back to Screen_1 canvas");
    expect(wrapper.get('[data-testid="settings-back-to-canvas-button"]').attributes("title")).toBe("Back to Screen_1 canvas");

    await wrapper.get('[data-testid="settings-back-to-canvas-button"]').trigger("click");

    expect(wrapper.find('[data-testid="settings-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="canvas-stage"]').exists()).toBe(true);
  });

  it("keeps the left editor navigation active state in sync with the selected section", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="widgets-nav-button"]').classes()).toContain("active");
    expect(wrapper.get('[data-testid="widgets-nav-button"]').attributes("aria-current")).toBe("page");
    expect(wrapper.get('[data-testid="widgets-nav-button"]').attributes("title")).toBe("Widgets section selected");
    expect(wrapper.get('[data-testid="widgets-nav-button"]').attributes("aria-label")).toBe("Widgets section selected");
    expect(wrapper.get('[data-testid="layers-nav-button"]').attributes("title")).toBe("Open Layers section");
    expect(wrapper.get('[data-testid="layers-nav-button"]').attributes("aria-label")).toBe("Open Layers section");
    expect(wrapper.get('[data-testid="widgets-nav-button"]').attributes("type")).toBe("button");

    await wrapper.get('[data-testid="layers-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="layers-nav-button"]').classes()).toContain("active");
    expect(wrapper.get('[data-testid="layers-nav-button"]').attributes("aria-current")).toBe("page");
    expect(wrapper.get('[data-testid="layers-nav-button"]').attributes("title")).toBe("Layers section selected");
    expect(wrapper.get('[data-testid="layers-nav-button"]').attributes("aria-label")).toBe("Layers section selected");
    expect(wrapper.get('[data-testid="widgets-nav-button"]').attributes("aria-current")).toBeUndefined();
    expect(wrapper.get('[data-testid="widgets-nav-button"]').attributes("title")).toBe("Open Widgets section");
    expect(wrapper.get('[data-testid="widgets-nav-button"]').attributes("aria-label")).toBe("Open Widgets section");
    expect(wrapper.find('[data-testid="code-preview"]').exists()).toBe(false);

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="code-nav-button"]').classes()).toContain("active");
    expect(wrapper.find('[data-testid="code-preview"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="center-panel-title"]').text()).toBe("Code");

    await wrapper.get('[data-testid="settings-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="settings-nav-button"]').classes()).toContain("active");
    expect(wrapper.find('[data-testid="settings-panel"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="center-panel-title"]').text()).toBe("Settings");

    await wrapper.get('[data-testid="screens-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="screens-nav-button"]').classes()).toContain("active");
    expect(wrapper.find('[data-testid="code-preview"]').exists()).toBe(false);

    await wrapper.get('[data-testid="resources-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="resources-nav-button"]').classes()).toContain("active");
    expect(wrapper.get('[data-testid="resources-panel"]').classes()).toContain("active");
    expect(wrapper.get('[data-testid="resources-panel"]').attributes("aria-label")).toBe("Resources");
    expect(wrapper.get('[data-testid="resources-panel"]').text()).toContain("Resources");
    expect(wrapper.get('[data-testid="assets-empty-state"]').classes()).toContain("asset-list");
    expect(wrapper.get('[data-testid="asset-list-view-button"]').classes()).toContain("active");

    await wrapper.get('[data-testid="inspector-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="inspector-nav-button"]').classes()).toContain("active");
    expect(wrapper.find('[data-testid="settings-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="code-preview"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="selected-text-input"]').exists()).toBe(true);
  });

  it("exposes inspector tabs with selected state for assistive navigation", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get(".inspector-panel .tabs").attributes("role")).toBe("tablist");
    expect(wrapper.get('[data-testid="inspector-style-tab"]').attributes("role")).toBe("tab");
    expect(wrapper.get('[data-testid="inspector-style-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="inspector-style-tab"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="inspector-style-tab"]').attributes("tabindex")).toBe("0");
    expect(wrapper.get('[data-testid="inspector-events-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="inspector-events-tab"]').attributes("tabindex")).toBe("-1");

    await wrapper.get('[data-testid="inspector-events-tab"]').trigger("click");

    expect(wrapper.get('[data-testid="inspector-style-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="inspector-style-tab"]').attributes("tabindex")).toBe("-1");
    expect(wrapper.get('[data-testid="inspector-events-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="inspector-events-tab"]').attributes("tabindex")).toBe("0");
    expect(wrapper.get('[data-testid="inspector-layout-tab"]').attributes("aria-selected")).toBe("false");

    const styleTabFocus = vi.spyOn(wrapper.get('[data-testid="inspector-style-tab"]').element as HTMLElement, "focus");
    await wrapper.get('[data-testid="inspector-events-tab"]').trigger("keydown", { key: "ArrowLeft" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="inspector-style-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="inspector-events-tab"]').attributes("aria-selected")).toBe("false");
    expect(styleTabFocus).toHaveBeenCalled();

    const eventsTabFocus = vi.spyOn(wrapper.get('[data-testid="inspector-events-tab"]').element as HTMLElement, "focus");
    await wrapper.get('[data-testid="inspector-style-tab"]').trigger("keydown", { key: "ArrowRight" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="inspector-style-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="inspector-events-tab"]').attributes("aria-selected")).toBe("true");
    expect(eventsTabFocus).toHaveBeenCalled();

    const layoutTabFocus = vi.spyOn(wrapper.get('[data-testid="inspector-layout-tab"]').element as HTMLElement, "focus");
    await wrapper.get('[data-testid="inspector-events-tab"]').trigger("keydown", { key: "End" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="inspector-events-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="inspector-layout-tab"]').attributes("aria-selected")).toBe("true");
    expect(layoutTabFocus).toHaveBeenCalled();

    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("keydown", { key: "Home" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="inspector-style-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="inspector-layout-tab"]').attributes("aria-selected")).toBe("false");
    expect(styleTabFocus).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });

  it("provides code panel actions and visible copy feedback", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText }
    });
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="copy-code-button"]').attributes("aria-label")).toBe("Copy generated code for Screen_1.c");
    expect(wrapper.get('[data-testid="copy-code-button"]').attributes("title")).toBe("Copy generated code for Screen_1.c");
    expect(wrapper.get('[data-testid="code-copy-status"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="code-copy-status"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="code-copy-status"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.get('[data-testid="code-back-to-canvas-button"]').attributes("aria-label")).toBe("Back to Screen_1 canvas");
    expect(wrapper.get('[data-testid="code-back-to-canvas-button"]').attributes("title")).toBe("Back to Screen_1 canvas");
    await wrapper.get('[data-testid="copy-code-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("void ui_Screen_1_screen_init(void)"));
    expect(wrapper.get('[data-testid="code-copy-status"]').text()).toBe("Code copied");
    expect(wrapper.get('[data-testid="code-line-count"]').text()).toMatch(/\d+ lines/);

    await wrapper.get('[data-testid="code-back-to-canvas-button"]').trigger("click");

    expect(wrapper.find('[data-testid="code-preview"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="canvas-stage"]').exists()).toBe(true);
  });

  it("falls back to selection copy when Clipboard API write is rejected", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("clipboard permission denied");
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand
    });
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText }
    });
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    await wrapper.get('[data-testid="copy-code-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("void ui_Screen_1_screen_init(void)"));
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(wrapper.get('[data-testid="code-copy-status"]').text()).toBe("Code copied");

    wrapper.unmount();
  });

  it("adds a real screen from the canvas tab plus button", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();

    expect(store.project.screens).toHaveLength(1);

    await wrapper.get('[data-testid="canvas-add-screen-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(store.project.screens).toHaveLength(2);
    expect(wrapper.get('[data-testid="active-screen-label"]').text()).toContain("Screen_2");
  });

  it("adds log entries when Preview and Build are clicked", async () => {
    signInForCloudSaves();
    const revokeObjectURL = vi.fn().mockImplementation(() => {
      throw new Error("revoke blocked");
    });
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue("blob:export-zip"),
      revokeObjectURL
    });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(projectCreateResponse())
      .mockResolvedValueOnce(projectSaveResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-1" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-1",
          status: "succeeded",
          progress: 100,
          logs: [
            { time: "2026-05-08T00:00:00Z", level: "info", message: "Build started" },
            { time: "2026-05-08T00:00:01Z", level: "info", message: "Build completed successfully" }
          ],
          result: { downloadUrl: "/api/jobs/job-1/download" }
        })
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Blob(["zip"]), { status: 200, headers: { "Content-Type": "application/zip" } }));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="preview-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="preview-button"]').attributes("aria-label")).toBe("Preview current screen");
    expect(wrapper.get('[data-testid="preview-button"]').attributes("title")).toBe("Preview current screen");
    expect(wrapper.get('[data-testid="build-button"]').attributes("type")).toBe("button");
    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    await wrapper.get('[data-testid="build-button"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Preview updated");
    expect(wrapper.text()).toContain("Build completed successfully");
    expect(wrapper.find('[data-testid="build-status-succeeded"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="console-list-header"]').text()).toContain("Time");
    expect(wrapper.get('[data-testid="console-list-header"]').text()).toContain("Message");
    expect(wrapper.find('[data-testid="console-log-stream"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="console-log-entry"]').at(-1)?.text()).toContain("Build completed successfully");
    const lastLogEntry = wrapper.findAll('[data-testid="console-log-entry"]').at(-1);
    expect(lastLogEntry?.find('[data-log-cell="time"]').exists()).toBe(true);
    expect(lastLogEntry?.find('[data-log-cell="message"]').text()).toContain("Build completed successfully");
    expect(wrapper.find('[data-testid="download-export-button"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="download-export-button"] svg').attributes("data-icon-name")).toBe("download");
    expect(wrapper.get('[data-testid="download-export-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="download-export-button"]').attributes("aria-label")).toBe("Download My Watch UI LVGL C zip");
    expect(wrapper.get('[data-testid="download-export-button"]').attributes("title")).toBe("Download My Watch UI LVGL C zip");
    expect(wrapper.get('[data-testid="download-export-button"]').text()).toBe("");

    await wrapper.get('[data-testid="bottom-timeline-tab"]').trigger("click");
    expect(wrapper.get('[data-testid="build-summary"]').text()).toContain("succeeded");
    expect(wrapper.get('[data-testid="build-summary"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="build-summary"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="build-summary"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.find('[data-testid="download-export-build-tab-button"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="download-export-build-tab-button"] svg').attributes("data-icon-name")).toBe("download");
    expect(wrapper.get('[data-testid="download-export-build-tab-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="download-export-build-tab-button"]').attributes("aria-label")).toBe("Download My Watch UI LVGL C zip");
    expect(wrapper.get('[data-testid="download-export-build-tab-button"]').attributes("title")).toBe("Download My Watch UI LVGL C zip");
    expect(wrapper.get('[data-testid="download-export-build-tab-button"]').text()).toBe("");

    vi.useFakeTimers();
    await wrapper.get('[data-testid="download-export-build-tab-button"]').trigger("click");
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job-1/download", expect.objectContaining({ headers: expect.any(Object) }));
    expect(anchorClick).toHaveBeenCalled();
    expect(wrapper.text()).toContain("Export zip downloaded");
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:export-zip");
    await wrapper.get('[data-testid="bottom-log-tab"]').trigger("click");
    expect(wrapper.get('[data-testid="console-log-stream"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="console-log-stream"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="console-log-stream"]').attributes("aria-atomic")).toBe("false");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/projects", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/projects/project-1/doc", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/export/c", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job-1", expect.any(Object));
    wrapper.unmount();
  });

  it("exposes bottom dock tabs with selected state for assistive navigation", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get(".log-panel .tabs").attributes("role")).toBe("tablist");
    expect(wrapper.get('[data-testid="bottom-log-tab"]').attributes("role")).toBe("tab");
    expect(wrapper.get('[data-testid="bottom-log-tab"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="bottom-log-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="bottom-log-tab"]').attributes("tabindex")).toBe("0");
    expect(wrapper.get('[data-testid="bottom-log-tab"]').text()).toBe("Console");
    expect(wrapper.get('[data-testid="bottom-timeline-tab"]').text()).toBe("Timeline");
    expect(wrapper.get('[data-testid="bottom-timeline-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="bottom-timeline-tab"]').attributes("tabindex")).toBe("-1");

    await wrapper.get('[data-testid="bottom-timeline-tab"]').trigger("click");

    expect(wrapper.get('[data-testid="bottom-log-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="bottom-log-tab"]').attributes("tabindex")).toBe("-1");
    expect(wrapper.get('[data-testid="bottom-timeline-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="bottom-timeline-tab"]').attributes("tabindex")).toBe("0");

    const logTabFocus = vi.spyOn(wrapper.get('[data-testid="bottom-log-tab"]').element as HTMLElement, "focus");
    await wrapper.get('[data-testid="bottom-timeline-tab"]').trigger("keydown", { key: "ArrowLeft" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="bottom-log-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="bottom-log-tab"]').attributes("tabindex")).toBe("0");
    expect(wrapper.get('[data-testid="bottom-timeline-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="bottom-timeline-tab"]').attributes("tabindex")).toBe("-1");
    expect(logTabFocus).toHaveBeenCalled();

    const timelineTabFocus = vi.spyOn(wrapper.get('[data-testid="bottom-timeline-tab"]').element as HTMLElement, "focus");
    await wrapper.get('[data-testid="bottom-log-tab"]').trigger("keydown", { key: "ArrowRight" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="bottom-log-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="bottom-log-tab"]').attributes("tabindex")).toBe("-1");
    expect(wrapper.get('[data-testid="bottom-timeline-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="bottom-timeline-tab"]').attributes("tabindex")).toBe("0");
    expect(timelineTabFocus).toHaveBeenCalled();

    wrapper.unmount();
  });

  it("announces empty console and build activity states", async () => {
    const wrapper = mount(LogPanel, {
      attachTo: document.body,
      props: {
        modelValue: "log",
        buildStatus: "idle",
        exportDownloadUrl: null,
        logEntries: [],
        projectName: "My Watch UI",
        timelineItems: []
      }
    });

    expect(wrapper.get('[data-testid="console-empty-state"]').text()).toContain("No console messages yet.");
    expect(wrapper.get('[data-testid="console-empty-state"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="console-empty-state"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="console-empty-state"]').attributes("aria-atomic")).toBe("true");

    await wrapper.setProps({ modelValue: "timeline" });

    expect(wrapper.get('[data-testid="timeline-empty-state"]').text()).toContain("No project activity yet.");
    expect(wrapper.get('[data-testid="timeline-empty-state"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="timeline-empty-state"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="timeline-empty-state"]').attributes("aria-atomic")).toBe("true");

    wrapper.unmount();
  });

  it("polls build jobs until they finish", async () => {
    signInForCloudSaves();
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(projectCreateResponse())
      .mockResolvedValueOnce(projectSaveResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-2" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-2",
          status: "running",
          progress: 50,
          logs: [{ time: "2026-05-08T00:00:00Z", level: "info", message: "Generating code" }]
        })
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-2",
          status: "succeeded",
          progress: 100,
          logs: [{ time: "2026-05-08T00:00:01Z", level: "info", message: "Build completed successfully" }],
          result: { downloadUrl: "/api/jobs/job-2/download" }
        })
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="build-button"]').trigger("click");
    await flushPromises();

    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/jobs/job-2")).toHaveLength(1);
    expect(wrapper.find('[data-testid="build-status-running"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="build-button"]').text()).toBe("Building...");
    expect(wrapper.text()).toContain("Generating code");

    await vi.advanceTimersByTimeAsync(499);
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/jobs/job-2")).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    const jobPollCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/jobs/job-2");
    expect(jobPollCalls).toHaveLength(2);
    expect(wrapper.text()).toContain("Build completed successfully");
  });

  it("writes failed build status and error message to the log", async () => {
    signInForCloudSaves();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(projectCreateResponse())
      .mockResolvedValueOnce(projectSaveResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-failed" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-failed",
          status: "failed",
          progress: 100,
          logs: [],
          error: { code: "CODEGEN_FAILED", message: "image widget references missing asset" }
        })
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
    expect(wrapper.get('[data-testid="build-status-failed"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="build-status-failed"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="build-status-failed"]').attributes("aria-atomic")).toBe("true");
  });

  it("fails a build with a log entry when job polling times out", async () => {
    signInForCloudSaves();
    vi.useFakeTimers();
    const runningJobResponse = {
      job: job({
        id: "job-timeout",
        status: "running",
        progress: 50,
        logs: [{ time: "2026-05-08T00:00:00Z", level: "info", message: "Generating code" }]
      })
    };
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/projects") {
        return Promise.resolve(projectCreateResponse());
      }
      if (url.includes("/api/projects/") && url.endsWith("/doc")) {
        return Promise.resolve(projectSaveResponse());
      }
      if (url === "/api/projects/project-1/export/c") {
        return Promise.resolve(new Response(JSON.stringify({ jobId: "job-timeout" }), { status: 202 }));
      }
      if (url === "/api/jobs/job-timeout") {
        return Promise.resolve(new Response(JSON.stringify(runningJobResponse), { status: 200 }));
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="build-button"]').trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(4500);
    await flushPromises();

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/jobs/job-timeout")).length).toBe(10);
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

    expect(fetchMock).toHaveBeenCalledWith("/api/projects", expect.objectContaining({ method: "POST" }));
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/export/c"))).toBe(false);
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

    expect(wrapper.get('[data-testid="build-button"]').element).toHaveProperty("disabled", true);
    expect(wrapper.get('[data-testid="build-button"]').text()).toBe("Login to Build");

    await wrapper.get('[data-testid="build-button"]').trigger("click");
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="build-status-failed"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="build-button"]').attributes("title")).toBe("Sign in to build and export LVGL C code");
  });

  it("disables cloud build when session restore clears a stale token", async () => {
    setAuthToken("stale-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "missing or invalid token" } }), { status: 401 })
    ));
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });

    expect(wrapper.get('[data-testid="build-button"]').element).toHaveProperty("disabled", false);

    await useAuthStore(pinia).restoreSession();
    await flushPromises();

    expect(getAuthToken()).toBeNull();
    expect(wrapper.get('[data-testid="build-button"]').element).toHaveProperty("disabled", true);
    expect(wrapper.get('[data-testid="build-button"]').text()).toBe("Login to Build");
  });

  it("stops build when edits happen while the pre-build save is in flight", async () => {
    signInForCloudSaves();
    let resolveSave: (response: Response) => void = () => undefined;
    const savePromise = new Promise<Response>((resolve) => {
      resolveSave = resolve;
    });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && init?.method === "POST") {
        return Promise.resolve(projectCreateResponse());
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        return savePromise;
      }
      if (String(url).includes("/export/c")) {
        return Promise.resolve(new Response(JSON.stringify({ jobId: "job-stale" }), { status: 202 }));
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="build-button"]').trigger("click");
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/doc", expect.objectContaining({ method: "PUT" }));

    await wrapper.get('[data-testid="widget-card-label"]').trigger("click");
    resolveSave(new Response(JSON.stringify({ projectId: "project-1", updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 }));
    await flushPromises();

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/export/c"))).toBe(false);
    expect(wrapper.text()).toContain("Build stopped because there are new unsaved changes");
  });

  it("opens and closes a full device preview overlay", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    expect(wrapper.get('[data-testid="preview-overlay"]').text()).toContain("Preview");
    expect(wrapper.get('[data-testid="preview-overlay"]').attributes("role")).toBe("dialog");
    expect(wrapper.get('[data-testid="preview-overlay"]').attributes("aria-modal")).toBe("true");
    expect(wrapper.get('[data-testid="preview-overlay"]').attributes("aria-label")).toBe("Device preview");
    expect(wrapper.get('[data-testid="preview-overlay"]').attributes("aria-labelledby")).toBe("preview-dialog-title");
    expect(wrapper.get('[data-testid="preview-overlay"]').attributes("aria-describedby")).toBe("preview-screen-name preview-target-label preview-status-message");
    expect(wrapper.get("#preview-dialog-title").text()).toBe("Preview");
    expect(wrapper.get('[data-testid="preview-overlay"]').attributes("tabindex")).toBe("-1");
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(wrapper.get('[data-testid="preview-overlay"]').element);
    expect(wrapper.get('[data-testid="preview-status-message"]').text()).toBe("Live preview ready");
    expect(wrapper.get('[data-testid="preview-status-message"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="preview-status-message"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="preview-status-message"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.get('[data-testid="preview-widget-time-label"]').text()).toContain("10:09");
    expect(wrapper.get('[data-testid="preview-widget-time-label"]').element.tagName).toBe("DIV");
    expect(wrapper.get('[data-testid="refresh-preview-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="screenshot-preview-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="close-preview-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="close-preview-button"]').attributes("aria-label")).toBe("Close Screen_1 preview");
    expect(wrapper.get('[data-testid="close-preview-button"]').attributes("title")).toBe("Close Screen_1 preview");

    await wrapper.get('[data-testid="close-preview-button"]').trigger("click");
    expect(wrapper.find('[data-testid="preview-overlay"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("closes the full preview overlay with Escape", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="preview-overlay"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("returns focus to the preview button after closing the preview overlay", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });
    const previewButton = wrapper.get('[data-testid="preview-button"]').element as HTMLButtonElement;
    previewButton.focus();

    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-testid="close-preview-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="preview-overlay"]').exists()).toBe(false);
    expect(document.activeElement).toBe(previewButton);
    wrapper.unmount();
  });

  it("keeps Tab navigation inside the full preview overlay", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    await wrapper.vm.$nextTick();
    const refreshButton = wrapper.get('[data-testid="refresh-preview-button"]').element as HTMLButtonElement;
    const closeButton = wrapper.get('[data-testid="close-preview-button"]').element as HTMLButtonElement;
    closeButton.focus();

    await wrapper.get('[data-testid="close-preview-button"]').trigger("keydown", { key: "Tab" });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(refreshButton);

    await wrapper.get('[data-testid="refresh-preview-button"]').trigger("keydown", { key: "Tab", shiftKey: true });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(closeButton);
    wrapper.unmount();
  });

  it("blocks destructive editor shortcuts while the full preview overlay is open", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.find('[data-testid="canvas-widget-time-label"]').exists()).toBe(true);

    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    const deleteEvent = new KeyboardEvent("keydown", { key: "Delete", cancelable: true });
    document.dispatchEvent(deleteEvent);
    await wrapper.vm.$nextTick();

    expect(deleteEvent.defaultPrevented).toBe(true);
    expect(wrapper.find('[data-testid="preview-overlay"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="canvas-widget-time-label"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("renders widget-specific controls inside the full preview overlay", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    await wrapper.get('[data-testid="widget-card-chart"]').trigger("click");
    store.updateSelectedProps({ min: 20, max: 80, pointCount: 3, values: [0, 50, 120, 60] });
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-testid="widget-card-dropdown"]').trigger("click");
    await wrapper.get('[data-testid="prop-options-input"]').setValue("Auto\nManual\nOff");
    await wrapper.get('[data-testid="prop-selected-input"]').setValue("1");
    await wrapper.get('[data-testid="widget-card-switch"]').trigger("click");
    await wrapper.get('[data-testid="widget-card-slider"]').trigger("click");
    const beforeDoc = JSON.stringify(store.project);

    await wrapper.get('[data-testid="preview-button"]').trigger("click");

    expect(wrapper.findAll('[data-testid="preview-widget-chart-1"] .chart-preview span')).toHaveLength(3);
    expect(wrapper.get('[data-testid="preview-widget-chart-1"] .chart-preview span').attributes("style")).toContain("height: 4%");
    expect(wrapper.get('[data-testid="preview-widget-dropdown-1"] .dropdown-preview').text()).toContain("Manual");
    expect(wrapper.get('[data-testid="preview-control-switch-1"]').attributes("aria-pressed")).toBe("false");
    await wrapper.get('[data-testid="preview-control-switch-1"]').trigger("click");
    expect(wrapper.get('[data-testid="preview-control-switch-1"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="preview-status-message"]').text()).toBe("Preview interaction is temporary. Refresh preview before capturing a screenshot.");
    expect((wrapper.get('[data-testid="screenshot-preview-button"]').element as HTMLButtonElement).disabled).toBe(true);
    await wrapper.get('[data-testid="refresh-preview-button"]').trigger("click");
    expect((wrapper.get('[data-testid="screenshot-preview-button"]').element as HTMLButtonElement).disabled).toBe(false);
    await wrapper.get('[data-testid="preview-control-dropdown-1"]').setValue("2");
    expect((wrapper.get('[data-testid="preview-control-dropdown-1"]').element as HTMLSelectElement).value).toBe("2");
    await wrapper.get('[data-testid="preview-control-slider-1"]').setValue("80");
    expect((wrapper.get('[data-testid="preview-control-slider-1"]').element as HTMLInputElement).value).toBe("80");
    expect(JSON.stringify(store.project)).toBe(beforeDoc);
  });

  it("logs bound event handlers from interactive preview controls", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);
    store.addEventBinding("LV_EVENT_CLICKED", "on_start_clicked", "start-button");
    await wrapper.get('[data-testid="widget-card-switch"]').trigger("click");
    const switchId = store.selectedWidget?.id;
    if (!switchId) {
      throw new Error("expected selected switch");
    }
    store.addEventBinding("LV_EVENT_VALUE_CHANGED", "on_switch_changed", switchId);

    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    await wrapper.get('[data-testid="preview-control-start-button"]').trigger("click");

    expect(wrapper.get('[data-testid="preview-status-message"]').text()).toBe("Preview event LV_EVENT_CLICKED -> on_start_clicked");
    expect(wrapper.text()).toContain("Preview event LV_EVENT_CLICKED -> on_start_clicked");

    await wrapper.get('[data-testid="preview-control-switch-1"]').trigger("click");
    expect(wrapper.get('[data-testid="preview-status-message"]').text()).toBe("Preview event LV_EVENT_VALUE_CHANGED -> on_switch_changed");
    expect(wrapper.text()).toContain("Preview event LV_EVENT_VALUE_CHANGED -> on_switch_changed");
    expect((wrapper.get('[data-testid="screenshot-preview-button"]').element as HTMLButtonElement).disabled).toBe(true);
    wrapper.unmount();
  });

  it("supports preview refresh and screenshot controls without changing ProjectDoc", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
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
    expect(wrapper.get('[data-testid="preview-device"]').attributes("role")).toBe("img");
    expect(wrapper.get('[data-testid="preview-device"]').attributes("aria-label")).toBe("Screen_1 preview on ESP32-S3 (480x480)");
    expect(wrapper.get('[data-testid="preview-device"]').attributes("title")).toBe("Screen_1 preview on ESP32-S3 (480x480)");
    expect(wrapper.get('[data-testid="refresh-preview-button"]').attributes("aria-label")).toBe("Refresh Screen_1 preview");
    expect(wrapper.get('[data-testid="refresh-preview-button"]').attributes("title")).toBe("Refresh Screen_1 preview");
    expect(wrapper.get('[data-testid="screenshot-preview-button"]').attributes("aria-label")).toBe("Capture Screen_1 preview screenshot");
    expect(wrapper.get('[data-testid="screenshot-preview-button"]').attributes("title")).toBe("Capture Screen_1 preview screenshot");
    expect(wrapper.get('[data-testid="close-preview-button"]').attributes("aria-label")).toBe("Close Screen_1 preview");
    expect(wrapper.get('[data-testid="close-preview-button"]').attributes("title")).toBe("Close Screen_1 preview");
    expect(wrapper.get('[data-testid="refresh-preview-button"] svg').attributes("data-icon-name")).toBe("refresh");
    expect(wrapper.get('[data-testid="screenshot-preview-button"] svg').attributes("data-icon-name")).toBe("camera");
    expect(wrapper.get('[data-testid="close-preview-button"] svg').attributes("data-icon-name")).toBe("close");
    expect(wrapper.get('[data-testid="refresh-preview-button"]').text()).toBe("");
    expect(wrapper.get('[data-testid="screenshot-preview-button"]').text()).toBe("");
    expect(wrapper.get('[data-testid="close-preview-button"]').text()).toBe("");

    await wrapper.get('[data-testid="refresh-preview-button"]').trigger("click");
    expect(wrapper.get('[data-testid="preview-status-message"]').text()).toBe("Preview refreshed");
    const screenshotButton = wrapper.get('[data-testid="screenshot-preview-button"]').element as HTMLButtonElement;
    screenshotButton.focus();
    await wrapper.get('[data-testid="screenshot-preview-button"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="preview-screenshot-link"]').attributes("href")).toBe("data:image/png;base64,preview");
    expect(wrapper.get('[data-testid="preview-screenshot-link"]').attributes("aria-label")).toBe("Download Screen_1 preview screenshot");
    expect(wrapper.get('[data-testid="preview-screenshot-link"]').attributes("title")).toBe("Download Screen_1 preview screenshot");
    expect(wrapper.get('[data-testid="preview-screenshot-link"] svg').attributes("data-icon-name")).toBe("download");
    expect(wrapper.get('[data-testid="preview-screenshot-link"]').text()).toBe("");
    expect(document.activeElement).toBe(wrapper.get('[data-testid="preview-screenshot-link"]').element);
    expect(wrapper.get('[data-testid="preview-status-message"]').text()).toBe("Screenshot ready");
    expect(wrapper.text()).toContain("Preview screenshot ready");
    expect(JSON.stringify(store.project)).toBe(beforeDoc);
  });

  it("shows unavailable feedback when preview screenshot capture throws", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });
    const canvas = wrapper.get('[data-testid="simulator-canvas"]').element as HTMLCanvasElement;
    vi.spyOn(canvas, "toDataURL").mockImplementation(() => {
      throw new Error("canvas is tainted");
    });

    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    await wrapper.get('[data-testid="screenshot-preview-button"]').trigger("click");

    expect(wrapper.get('[data-testid="preview-status-message"]').text()).toBe("Screenshot unavailable");
    expect(wrapper.find('[data-testid="preview-screenshot-link"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Screenshot unavailable");

    wrapper.unmount();
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
    expect(timeline).toContain("Add Label widget");
    expect(wrapper.get('[data-testid="timeline-list-header"]').text()).toContain("Kind");
    expect(wrapper.get('[data-testid="timeline-list-header"]').text()).toContain("Item");
    expect(wrapper.get('[data-testid="timeline-list-header"]').text()).toContain("Status");
    expect(wrapper.find('[data-testid="timeline-list"] [data-timeline-cell="kind"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timeline-list"] [data-timeline-cell="item"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timeline-list"] [data-timeline-cell="status"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timeline-kind-screen"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timeline-kind-event"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="timeline-kind-command"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="timeline-status"]').length).toBeGreaterThanOrEqual(3);
  });

  it("localizes command entries in the Chinese timeline tab", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="locale-select"]').setValue("zh-CN");
    await wrapper.get('[data-testid="widget-card-label"]').trigger("click");
    await wrapper.get('[data-testid="bottom-timeline-tab"]').trigger("click");

    const timeline = wrapper.get('[data-testid="timeline-list"]').text();
    expect(timeline).toContain("屏幕");
    expect(timeline).toContain("命令");
    expect(timeline).toContain("添加 文本 控件");
    expect(timeline).not.toContain("Add ");
    expect(timeline).not.toContain("Label_1");
    expect(timeline).toContain("已完成");
    expect(wrapper.get('[data-testid="timeline-list-header"]').text()).toContain("类型");
    expect(wrapper.get('[data-testid="timeline-list-header"]').text()).toContain("项目");
    expect(wrapper.get('[data-testid="timeline-list-header"]').text()).toContain("状态");
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
    expect(wrapper.get('[data-testid="image-asset-select"]').attributes("aria-label")).toBe("Image asset");
    expect(wrapper.get('[data-testid="image-asset-select"]').attributes("title")).toBe("Image asset");
    expect(wrapper.get('[data-testid="image-binding-state"]').text()).toContain("No image assets imported");
    expect(wrapper.get('[data-testid="image-binding-state"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="image-binding-state"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="image-binding-state"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.get('[data-testid="canvas-widget-image-1"] .image-placeholder').text()).toContain("Select an asset");
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
    expect(wrapper.get('[data-testid="font-asset-export-note"]').text()).toContain("metadata only");
    expect(projectStore.selectedWidget?.style.font).toBe("font-1");

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="code-preview"]').text()).not.toContain("&font_1");
    expect(wrapper.get('[data-testid="code-preview"]').text()).toContain("Font asset font-1 is registered as metadata only");
  });

  it("warns in the inspector when a text widget uses an unsupported custom font symbol", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const projectStore = useProjectStore();
    if (!projectStore.selectedWidget) {
      throw new Error("expected a selected widget");
    }
    projectStore.selectedWidget.style.font = "lv_font_custom_24";
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="font-asset-warning"]').text()).toBe("Unknown font asset or unsupported LVGL font symbol: lv_font_custom_24");
    expect(wrapper.get('[data-testid="style-font-select"]').attributes("aria-describedby")).toBe("font-asset-warning");
    expect(wrapper.get('[data-testid="style-font-select"]').attributes("aria-invalid")).toBe("true");
  });

  it("updates selected widget style fields from the inspector", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="selected-text-input"]').attributes("aria-label")).toBe("Selected widget text");
    expect(wrapper.get('[data-testid="selected-text-input"]').attributes("title")).toBe("Selected widget text");
    expect(wrapper.get('[data-testid="style-font-select"]').attributes("aria-label")).toBe("Text font");
    expect(wrapper.get('[data-testid="style-align-select"]').attributes("aria-label")).toBe("Text alignment");
    expect(wrapper.get('[data-testid="style-text-color-input"]').attributes("aria-label")).toBe("Text color");
    expect(wrapper.get('[data-testid="style-bg-color-input"]').attributes("aria-label")).toBe("Background color");
    expect(wrapper.get('[data-testid="style-border-color-input"]').attributes("aria-label")).toBe("Border color");
    expect(wrapper.get('[data-testid="style-opacity-input"]').attributes("type")).toBe("number");
    expect(wrapper.get('[data-testid="style-opacity-input"]').attributes("aria-label")).toBe("Opacity");
    expect(wrapper.get('[data-testid="style-opacity-input"]').attributes("min")).toBe("0");
    expect(wrapper.get('[data-testid="style-opacity-input"]').attributes("max")).toBe("100");
    expect(wrapper.get('[data-testid="style-blend-mode-select"]').attributes("aria-label")).toBe("Blend mode");
    expect(wrapper.get('[data-testid="style-blend-mode-select"]').attributes("title")).toBe("Blend mode");
    expect(wrapper.get('[data-testid="style-radius-input"]').attributes("type")).toBe("number");
    expect(wrapper.get('[data-testid="style-radius-input"]').attributes("aria-label")).toBe("Radius");
    expect(wrapper.get('[data-testid="style-radius-input"]').attributes("title")).toBe("Radius");
    expect(wrapper.get('[data-testid="style-padding-top-input"]').attributes("type")).toBe("number");
    expect(wrapper.get('[data-testid="style-padding-top-input"]').attributes("aria-label")).toBe("Padding top");
    expect(wrapper.get('[data-testid="style-padding-top-input"]').attributes("title")).toBe("Padding top");
    expect(wrapper.get('[data-testid="style-padding-right-input"]').attributes("aria-label")).toBe("Padding right");
    expect(wrapper.get('[data-testid="style-padding-right-input"]').attributes("title")).toBe("Padding right");
    expect(wrapper.get('[data-testid="style-padding-bottom-input"]').attributes("aria-label")).toBe("Padding bottom");
    expect(wrapper.get('[data-testid="style-padding-bottom-input"]').attributes("title")).toBe("Padding bottom");
    expect(wrapper.get('[data-testid="style-padding-left-input"]').attributes("aria-label")).toBe("Padding left");
    expect(wrapper.get('[data-testid="style-padding-left-input"]').attributes("title")).toBe("Padding left");
    expect(wrapper.get('[data-testid="style-letter-space-input"]').attributes("aria-label")).toBe("Letter spacing");
    expect(wrapper.get('[data-testid="style-letter-space-input"]').attributes("title")).toBe("Letter spacing");
    expect(wrapper.get('[data-testid="style-line-space-input"]').attributes("aria-label")).toBe("Line spacing");
    expect(wrapper.get('[data-testid="style-line-space-input"]').attributes("title")).toBe("Line spacing");
    expect(wrapper.get('[data-testid="style-text-color-swatch"]').attributes("style")).toContain("background-color: rgb(255, 255, 255)");
    expect(wrapper.get('[data-testid="style-text-color-swatch"]').attributes("role")).toBe("img");
    expect(wrapper.get('[data-testid="style-text-color-swatch"]').attributes("aria-label")).toBe("Text color preview #FFFFFF");
    expect(wrapper.get('[data-testid="style-text-color-swatch"]').attributes("title")).toBe("Text color preview #FFFFFF");
    expect(wrapper.get('[data-testid="style-bg-color-swatch"]').attributes("style")).toContain("background-color: transparent");
    expect(wrapper.get('[data-testid="style-bg-color-swatch"]').attributes("role")).toBe("img");
    expect(wrapper.get('[data-testid="style-bg-color-swatch"]').attributes("aria-label")).toBe("Background color preview transparent");
    expect(wrapper.get('[data-testid="style-bg-color-swatch"]').attributes("title")).toBe("Background color preview transparent");
    expect(wrapper.get('[data-testid="style-border-color-swatch"]').attributes("style")).toContain("background-color: transparent");
    expect(wrapper.get('[data-testid="style-border-color-swatch"]').attributes("role")).toBe("img");
    expect(wrapper.get('[data-testid="style-border-color-swatch"]').attributes("aria-label")).toBe("Border color preview transparent");
    expect(wrapper.get('[data-testid="style-border-color-swatch"]').attributes("title")).toBe("Border color preview transparent");

    await wrapper.get('[data-testid="style-text-color-input"]').setValue("#00AEEF");
    await wrapper.get('[data-testid="style-bg-color-input"]').setValue("#101820");
    await wrapper.get('[data-testid="style-border-color-input"]').setValue("#FFCC00");
    await wrapper.get('[data-testid="style-font-select"]').setValue("lv_font_montserrat_32");
    await wrapper.get('[data-testid="style-align-select"]').setValue("right");
    await wrapper.get('[data-testid="style-blend-mode-select"]').setValue("multiply");
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
    expect(widget.attributes("style")).toContain("mix-blend-mode: multiply");
    expect(widget.attributes("style")).toContain("padding: 6px 8px 10px 12px");
    expect(widget.attributes("style")).toContain("text-align: right");
    expect(widget.attributes("style")).toContain("letter-spacing: 2px");
    expect(wrapper.get('[data-testid="style-text-color-swatch"]').attributes("style")).toContain("background-color: rgb(0, 174, 239)");
    expect(wrapper.get('[data-testid="style-text-color-swatch"]').attributes("aria-label")).toBe("Text color preview #00AEEF");
    expect(wrapper.get('[data-testid="style-text-color-swatch"]').attributes("title")).toBe("Text color preview #00AEEF");
    expect(wrapper.get('[data-testid="style-bg-color-swatch"]').attributes("style")).toContain("background-color: rgb(16, 24, 32)");
    expect(wrapper.get('[data-testid="style-bg-color-swatch"]').attributes("aria-label")).toBe("Background color preview #101820");
    expect(wrapper.get('[data-testid="style-bg-color-swatch"]').attributes("title")).toBe("Background color preview #101820");
    expect(wrapper.get('[data-testid="style-border-color-swatch"]').attributes("style")).toContain("background-color: rgb(255, 204, 0)");
    expect(wrapper.get('[data-testid="style-border-color-swatch"]').attributes("aria-label")).toBe("Border color preview #FFCC00");
    expect(wrapper.get('[data-testid="style-border-color-swatch"]').attributes("title")).toBe("Border color preview #FFCC00");
  });

  it("rejects invalid inspector color values before updating ProjectDoc", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();

    await wrapper.get('[data-testid="style-bg-color-input"]').setValue("red");

    expect(store.selectedWidget?.style.bgColor ?? "").toBe("");
    expect(wrapper.get('[data-testid="style-bg-color-error"]').text()).toBe("Background color must be a 3 or 6 digit hex color");
    expect(wrapper.get('[data-testid="style-bg-color-input"]').attributes("aria-invalid")).toBe("true");

    await wrapper.get('[data-testid="style-bg-color-input"]').setValue("#123abc");

    expect(store.selectedWidget?.style.bgColor).toBe("#123abc");
    expect(wrapper.find('[data-testid="style-bg-color-error"]').exists()).toBe(false);
  });

  it("edits widget-specific props from the inspector", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    expect(wrapper.get('[data-testid="selector-input"]').attributes("aria-label")).toBe("Selected widget name");
    expect(wrapper.get('[data-testid="selector-input"]').attributes("title")).toBe("Selected widget name");

    await wrapper.get('[data-testid="widget-card-slider"]').trigger("click");
    expect(wrapper.get('[data-testid="prop-min-input"]').attributes("aria-label")).toBe("Minimum value");
    expect(wrapper.get('[data-testid="prop-min-input"]').attributes("title")).toBe("Minimum value");
    expect(wrapper.get('[data-testid="prop-max-input"]').attributes("aria-label")).toBe("Maximum value");
    expect(wrapper.get('[data-testid="prop-value-input"]').attributes("aria-label")).toBe("Current value");
    await wrapper.get('[data-testid="prop-min-input"]').setValue("10");
    await wrapper.get('[data-testid="prop-max-input"]').setValue("200");
    await wrapper.get('[data-testid="prop-value-input"]').setValue("64");
    expect(store.selectedWidget?.props).toMatchObject({ min: 10, max: 200, value: 64 });

    await wrapper.get('[data-testid="widget-card-checkbox"]').trigger("click");
    expect(wrapper.get('[data-testid="prop-text-input"]').attributes("aria-label")).toBe("Checkbox text");
    expect(wrapper.get('[data-testid="prop-text-input"]').attributes("title")).toBe("Checkbox text");
    expect(wrapper.get('[data-testid="prop-checked-input"]').attributes("aria-label")).toBe("Checked");
    expect(wrapper.get('[data-testid="prop-checked-input"]').attributes("title")).toBe("Checked");
    await wrapper.get('[data-testid="prop-text-input"]').setValue("Enable logs");
    await wrapper.get('[data-testid="prop-checked-input"]').setValue(true);
    expect(store.selectedWidget?.props).toMatchObject({ text: "Enable logs", checked: true });

    await wrapper.get('[data-testid="widget-card-dropdown"]').trigger("click");
    await wrapper.get('[data-testid="selected-text-input"]').setValue("Mode");
    expect(wrapper.get('[data-testid="prop-options-input"]').attributes("aria-label")).toBe("Dropdown options");
    expect(wrapper.get('[data-testid="prop-options-input"]').attributes("title")).toBe("Dropdown options");
    expect(wrapper.get('[data-testid="prop-selected-input"]').attributes("aria-label")).toBe("Selected option index");
    await wrapper.get('[data-testid="prop-options-input"]').setValue("Auto\nManual\nOff");
    await wrapper.get('[data-testid="prop-selected-input"]').setValue("1");
    expect(wrapper.get('[data-testid="canvas-widget-dropdown-1"] .dropdown-preview').text()).toContain("Mode");
    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    expect(wrapper.get('[data-testid="code-preview"]').text()).toContain('lv_dropdown_set_text(ui_Dropdown_1, "Mode");');
    await wrapper.get('[data-testid="widgets-nav-button"]').trigger("click");
    expect(store.selectedWidget?.props).toMatchObject({ text: "Mode", options: "Auto\nManual\nOff", selected: 1 });

    await wrapper.get('[data-testid="widget-card-spinner"]').trigger("click");
    expect(wrapper.get('[data-testid="prop-spin-time-input"]').attributes("aria-label")).toBe("Spin time");
    expect(wrapper.get('[data-testid="prop-arc-length-input"]').attributes("aria-label")).toBe("Arc length");
    await wrapper.get('[data-testid="prop-spin-time-input"]').setValue("900");
    await wrapper.get('[data-testid="prop-arc-length-input"]').setValue("80");
    expect(store.selectedWidget?.props).toMatchObject({ spinTime: 900, arcLength: 80 });

    await wrapper.get('[data-testid="widget-card-chart"]').trigger("click");
    expect(wrapper.get('[data-testid="prop-point-count-input"]').attributes("aria-label")).toBe("Chart point count");
    expect(wrapper.get('[data-testid="prop-values-input"]').attributes("aria-label")).toBe("Chart values");
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
    expect(wrapper.get('[data-testid="prop-spin-time-error"]').text()).toBe("Spin Time must be greater than 0");
    expect(wrapper.get('[data-testid="prop-spin-time-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="prop-spin-time-error"]').attributes("id")).toBe("prop-spin-time-error");
    expect(wrapper.get('[data-testid="prop-spin-time-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="prop-spin-time-input"]').attributes("aria-describedby")).toBe("prop-spin-time-error");
    expect(store.selectedWidget?.props.spinTime).toBe(1000);

    await wrapper.get('[data-testid="prop-arc-length-input"]').setValue("-1");
    expect(wrapper.get('[data-testid="prop-arc-length-error"]').text()).toBe("Arc Length must be greater than 0");
    expect(wrapper.get('[data-testid="prop-arc-length-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="prop-arc-length-error"]').attributes("id")).toBe("prop-arc-length-error");
    expect(wrapper.get('[data-testid="prop-arc-length-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="prop-arc-length-input"]').attributes("aria-describedby")).toBe("prop-arc-length-error");
    expect(store.selectedWidget?.props.arcLength).toBe(60);

    await wrapper.get('[data-testid="widget-card-chart"]').trigger("click");
    await wrapper.get('[data-testid="prop-point-count-input"]').setValue("0");
    expect(wrapper.get('[data-testid="prop-point-count-error"]').text()).toBe("Point Count must be greater than 0");
    expect(wrapper.get('[data-testid="prop-point-count-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="prop-point-count-error"]').attributes("id")).toBe("prop-point-count-error");
    expect(wrapper.get('[data-testid="prop-point-count-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="prop-point-count-input"]').attributes("aria-describedby")).toBe("prop-point-count-error");
    expect(store.selectedWidget?.props.pointCount).toBe(8);

    await wrapper.get('[data-testid="widget-card-dropdown"]').trigger("click");
    await wrapper.get('[data-testid="prop-selected-input"]').setValue("-1");
    expect(wrapper.get('[data-testid="prop-selected-error"]').text()).toBe("Selected must be non-negative");
    expect(wrapper.get('[data-testid="prop-selected-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="prop-selected-error"]').attributes("id")).toBe("prop-selected-error");
    expect(wrapper.get('[data-testid="prop-selected-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="prop-selected-input"]').attributes("aria-describedby")).toBe("prop-selected-error");
    expect(store.selectedWidget?.props.selected).toBe(0);

    await wrapper.get('[data-testid="prop-selected-input"]').setValue("1");
    expect(wrapper.find('[data-testid="prop-selected-error"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="prop-selected-input"]').attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.get('[data-testid="prop-selected-input"]').attributes("aria-describedby")).toBeUndefined();
    expect(store.selectedWidget?.props.selected).toBe(1);

    await wrapper.get('[data-testid="prop-selected-input"]').setValue("2");
    expect(wrapper.get('[data-testid="prop-selected-error"]').text()).toBe("Selected must be between 0 and 1");
    expect(wrapper.get('[data-testid="prop-selected-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="prop-selected-input"]').attributes("aria-describedby")).toBe("prop-selected-error");
    expect(store.selectedWidget?.props.selected).toBe(1);

    await wrapper.get('[data-testid="prop-options-input"]').setValue("Only");
    expect(store.selectedWidget?.props).toMatchObject({ options: "Only", selected: 0 });
    expect(wrapper.find('[data-testid="prop-selected-error"]').exists()).toBe(false);

    await wrapper.get('[data-testid="widget-card-slider"]').trigger("click");
    await wrapper.get('[data-testid="prop-max-input"]').setValue("-1");
    expect(wrapper.get('[data-testid="prop-max-error"]').text()).toBe("Max must be greater than Min");
    expect(wrapper.get('[data-testid="prop-max-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="prop-max-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="prop-max-input"]').attributes("aria-describedby")).toBe("prop-max-error");
    expect(store.selectedWidget?.props.max).toBe(100);

    await wrapper.get('[data-testid="prop-max-input"]').setValue("120");
    expect(wrapper.find('[data-testid="prop-max-error"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="prop-max-input"]').attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.get('[data-testid="prop-max-input"]').attributes("aria-describedby")).toBeUndefined();
    expect(store.selectedWidget?.props.max).toBe(120);

    await wrapper.get('[data-testid="prop-value-input"]').setValue("121");
    expect(wrapper.get('[data-testid="prop-value-error"]').text()).toBe("Value must be between 0 and 120");
    expect(wrapper.get('[data-testid="prop-value-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="prop-value-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="prop-value-input"]').attributes("aria-describedby")).toBe("prop-value-error");
    expect(store.selectedWidget?.props.value).toBe(0);

    await wrapper.get('[data-testid="prop-value-input"]').setValue("80");
    expect(wrapper.find('[data-testid="prop-value-error"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="prop-value-input"]').attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.get('[data-testid="prop-value-input"]').attributes("aria-describedby")).toBeUndefined();
    expect(store.selectedWidget?.props.value).toBe(80);
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
    store.updateSelectedProps({ min: 20, max: 80, pointCount: 3, values: [0, 50, 120, 60] });
    await wrapper.vm.$nextTick();

    expect(store.selectedWidget?.props).toMatchObject({
      min: 20,
      max: 80,
      values: [0, 50, 120, 60],
      pointCount: 3
    });
    expect(wrapper.findAll('[data-testid="canvas-widget-chart-1"] .chart-preview span')).toHaveLength(3);
    expect(wrapper.get('[data-testid="canvas-widget-chart-1"] .chart-preview span').attributes("style")).toContain("height: 4%");

    await wrapper.get('[data-testid="code-nav-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    const preview = wrapper.get('[data-testid="code-preview"]').text();
    expect(preview).toContain("lv_chart_series_t * ui_Chart_1_series = lv_chart_add_series(ui_Chart_1, lv_palette_main(LV_PALETTE_BLUE), LV_CHART_AXIS_PRIMARY_Y);");
    expect(preview).toContain("lv_chart_set_next_value(ui_Chart_1, ui_Chart_1_series, 20);");
    expect(preview).toContain("lv_chart_set_next_value(ui_Chart_1, ui_Chart_1_series, 50);");
    expect(preview).toContain("lv_chart_set_next_value(ui_Chart_1, ui_Chart_1_series, 80);");
    expect(preview).not.toContain("lv_chart_set_next_value(ui_Chart_1, ui_Chart_1_series, 60);");
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

    expect(wrapper.get('[data-testid="prop-values-error"]').text()).toBe("Values must be comma, space or newline separated numbers");
    expect(wrapper.get('[data-testid="prop-values-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="prop-values-error"]').attributes("id")).toBe("prop-values-error");
    expect(wrapper.get('[data-testid="prop-values-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="prop-values-input"]').attributes("aria-describedby")).toBe("prop-values-error");
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
    expect(wrapper.get('[data-testid="canvas-widget-date-label"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="canvas-widget-date-label"]').attributes("aria-label")).toBe("Select and drag Date_Label label widget");
    expect(wrapper.get('[data-testid="canvas-widget-date-label"]').attributes("title")).toBe("Select and drag Date_Label label widget");
    await wrapper.get('[data-testid="canvas-widget-date-label"]').trigger("click");

    expect(wrapper.get('[data-testid="selector-input"]').element).toHaveProperty("value", "Date_Label");
    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");

    expect(wrapper.get('[data-testid="layout-x-input"]').attributes("type")).toBe("number");
    expect(wrapper.get('[data-testid="layout-x-input"]').attributes("aria-label")).toBe("Layout X");
    expect(wrapper.get('[data-testid="layout-y-input"]').attributes("aria-label")).toBe("Layout Y");
    expect(wrapper.get('[data-testid="layout-width-input"]').attributes("type")).toBe("number");
    expect(wrapper.get('[data-testid="layout-width-input"]').attributes("aria-label")).toBe("Layout width");
    expect(wrapper.get('[data-testid="layout-width-input"]').attributes("min")).toBe("1");
    expect(wrapper.get('[data-testid="layout-height-input"]').attributes("aria-label")).toBe("Layout height");
    expect(wrapper.get('[data-testid="layout-align-select"]').attributes("aria-label")).toBe("Layout alignment");

    await wrapper.get('[data-testid="layout-x-input"]').setValue("190");
    await wrapper.get('[data-testid="layout-y-input"]').setValue("120");
    await wrapper.get('[data-testid="layout-width-input"]').setValue("170");
    await wrapper.get('[data-testid="layout-height-input"]').setValue("28");
    await wrapper.get('[data-testid="layout-align-select"]').setValue("center");
    expect(wrapper.find('[data-testid="layout-flex-direction-select"]').exists()).toBe(false);

    await wrapper.get('[data-testid="canvas-widget-container-1"]').trigger("click");
    expect(wrapper.get('[data-testid="layout-flex-direction-select"]').attributes("aria-label")).toBe("Flex direction");
    expect(wrapper.get('[data-testid="layout-gap-input"]').attributes("aria-label")).toBe("Flex gap");
    expect(wrapper.get('[data-testid="layout-flex-wrap-input"]').attributes("aria-label")).toBe("Flex wrap");
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

    expect(wrapper.get('[data-testid="layout-width-error"]').text()).toBe("Width must be greater than 0");
    expect(wrapper.get('[data-testid="layout-width-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="layout-width-error"]').attributes("id")).toBe("layout-width-error");
    expect(wrapper.get('[data-testid="layout-width-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="layout-width-input"]').attributes("aria-describedby")).toBe("layout-width-error");
    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("style")).toContain("width: 180px");

    await wrapper.get('[data-testid="layout-width-input"]').setValue("200");

    expect(wrapper.find('[data-testid="layout-width-error"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="layout-width-input"]').attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.get('[data-testid="layout-width-input"]').attributes("aria-describedby")).toBeUndefined();
    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("style")).toContain("width: 200px");

    await wrapper.get('[data-testid="layout-height-input"]').setValue("0");

    expect(wrapper.get('[data-testid="layout-height-error"]').text()).toBe("Height must be greater than 0");
    expect(wrapper.get('[data-testid="layout-height-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="layout-height-error"]').attributes("id")).toBe("layout-height-error");
    expect(wrapper.get('[data-testid="layout-height-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="layout-height-input"]').attributes("aria-describedby")).toBe("layout-height-error");

    await wrapper.get('[data-testid="layout-height-input"]').setValue("56");

    expect(wrapper.find('[data-testid="layout-height-error"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="layout-height-input"]').attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.get('[data-testid="layout-height-input"]').attributes("aria-describedby")).toBeUndefined();
  });

  it("rejects fractional LVGL integer fields before updating ProjectDoc", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();
    const initialX = store.selectedWidget?.layout.x;

    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    await wrapper.get('[data-testid="layout-x-input"]').setValue("10.5");
    expect(wrapper.get('[data-testid="layout-x-error"]').text()).toBe("X must be an integer");
    expect(wrapper.get('[data-testid="layout-x-input"]').attributes("aria-invalid")).toBe("true");
    expect(store.selectedWidget?.layout.x).toBe(initialX);

    await wrapper.get('[data-testid="inspector-style-tab"]').trigger("click");
    await wrapper.get('[data-testid="style-radius-input"]').setValue("4.5");
    expect(wrapper.get('[data-testid="style-radius-error"]').text()).toBe("Radius must be an integer");
    expect(wrapper.get('[data-testid="style-radius-input"]').attributes("aria-invalid")).toBe("true");
    expect(store.selectedWidget?.style.radius).toBeUndefined();

    await wrapper.get('[data-testid="widget-card-dropdown"]').trigger("click");
    const initialSelected = store.selectedWidget?.props.selected;
    await wrapper.get('[data-testid="prop-selected-input"]').setValue("0.5");
    expect(wrapper.get('[data-testid="prop-selected-error"]').text()).toBe("Selected must be an integer");
    expect(wrapper.get('[data-testid="prop-selected-input"]').attributes("aria-invalid")).toBe("true");
    expect(store.selectedWidget?.props.selected).toBe(initialSelected);

    await wrapper.get('[data-testid="layer-row-screen-root"]').trigger("click");
    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    const initialGap = store.selectedWidget?.layout.flex?.gap;
    await wrapper.get('[data-testid="layout-gap-input"]').setValue("3.5");
    expect(wrapper.get('[data-testid="layout-gap-error"]').text()).toBe("Gap must be an integer");
    expect(wrapper.get('[data-testid="layout-gap-input"]').attributes("aria-invalid")).toBe("true");
    expect(store.selectedWidget?.layout.flex?.gap).toBe(initialGap);

    wrapper.unmount();
  });

  it("rejects invalid style padding, radius and flex gap from the inspector", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();

    await wrapper.get('[data-testid="style-radius-input"]').setValue("-1");
    expect(wrapper.get('[data-testid="style-radius-error"]').text()).toBe("Radius must be non-negative");
    expect(wrapper.get('[data-testid="style-radius-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="style-radius-error"]').attributes("id")).toBe("style-radius-error");
    expect(wrapper.get('[data-testid="style-radius-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="style-radius-input"]').attributes("aria-describedby")).toBe("style-radius-error");
    expect(store.selectedWidget?.style.radius).toBeUndefined();

    await wrapper.get('[data-testid="style-letter-space-input"]').setValue("-2");
    expect(wrapper.get('[data-testid="style-letter-space-error"]').text()).toBe("Letter Space must be non-negative");
    expect(wrapper.get('[data-testid="style-letter-space-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="style-letter-space-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="style-letter-space-input"]').attributes("aria-describedby")).toBe("style-letter-space-error");
    expect(store.selectedWidget?.style.letterSpace).toBeUndefined();

    await wrapper.get('[data-testid="style-line-space-input"]').setValue("-3");
    expect(wrapper.get('[data-testid="style-line-space-error"]').text()).toBe("Line Space must be non-negative");
    expect(wrapper.get('[data-testid="style-line-space-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="style-line-space-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="style-line-space-input"]').attributes("aria-describedby")).toBe("style-line-space-error");
    expect(store.selectedWidget?.style.lineSpace).toBeUndefined();

    await wrapper.get('[data-testid="style-padding-top-input"]').setValue("-4");
    expect(wrapper.get('[data-testid="style-padding-top-error"]').text()).toBe("Padding Top must be non-negative");
    expect(wrapper.get('[data-testid="style-padding-top-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="style-padding-top-error"]').attributes("id")).toBe("style-padding-top-error");
    expect(wrapper.get('[data-testid="style-padding-top-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="style-padding-top-input"]').attributes("aria-describedby")).toBe("style-padding-top-error");
    expect(store.selectedWidget?.style.padding).toBeUndefined();

    await wrapper.get('[data-testid="layer-row-screen-root"]').trigger("click");
    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    await wrapper.get('[data-testid="layout-gap-input"]').setValue("-8");

    expect(wrapper.get('[data-testid="layout-gap-error"]').text()).toBe("Gap must be non-negative");
    expect(wrapper.get('[data-testid="layout-gap-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="layout-gap-error"]').attributes("id")).toBe("layout-gap-error");
    expect(wrapper.get('[data-testid="layout-gap-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="layout-gap-input"]').attributes("aria-describedby")).toBe("layout-gap-error");
    expect(store.activeScreen?.root.layout.flex).toBeUndefined();

    await wrapper.get('[data-testid="layout-gap-input"]').setValue("8");
    expect(wrapper.find('[data-testid="layout-gap-error"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="layout-gap-input"]').attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.get('[data-testid="layout-gap-input"]').attributes("aria-describedby")).toBeUndefined();
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
    expect(wrapper.get('[data-testid="resize-handle-date-label"]').attributes("title")).toBe("Resize Date_Label widget");

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

  it("coalesces canvas drag and resize into one undo entry each", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    const historyBefore = store.historyEntries.length;
    await wrapper.get('[data-testid="canvas-widget-date-label"]').trigger("mousedown", {
      clientX: 168,
      clientY: 105
    });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 180, clientY: 115 }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 198, clientY: 125 }));
    await wrapper.vm.$nextTick();

    expect(store.historyEntries).toHaveLength(historyBefore);

    document.dispatchEvent(new MouseEvent("mouseup"));
    await wrapper.vm.$nextTick();

    expect(store.historyEntries).toHaveLength(historyBefore + 1);
    expect(store.historyEntries.at(-1)?.label).toBe("Move widget");

    await wrapper.get('[data-testid="resize-handle-date-label"]').trigger("mousedown", {
      clientX: 348,
      clientY: 149
    });
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 360, clientY: 154 }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 378, clientY: 159 }));
    await wrapper.vm.$nextTick();

    expect(store.historyEntries).toHaveLength(historyBefore + 1);

    document.dispatchEvent(new MouseEvent("mouseup"));
    await wrapper.vm.$nextTick();

    expect(store.historyEntries).toHaveLength(historyBefore + 2);
    expect(store.historyEntries.at(-1)?.label).toBe("Resize widget");

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

    expect(wrapper.get('[data-testid="zoom-select"]').attributes("aria-label")).toBe("Canvas zoom");
    expect(wrapper.get('[data-testid="zoom-select"]').attributes("title")).toBe("Canvas zoom");
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
    expect(wrapper.get('[data-testid="snap-toggle"]').attributes("title")).toBe("Enable snap");
    expect(wrapper.get('[data-testid="snap-toggle"]').attributes("aria-label")).toBe("Enable snap");
    expect(wrapper.get('[data-testid="grid-toggle"]').attributes("title")).toBe("Hide grid");
    expect(wrapper.get('[data-testid="grid-toggle"]').attributes("aria-label")).toBe("Hide grid");
    expect(wrapper.get('[data-testid="grid-toggle"]').classes()).toContain("active");
    expect(wrapper.get('[data-testid="grid-toggle"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="snap-toggle"]').attributes("aria-pressed")).toBe("false");
    await wrapper.get('[data-testid="grid-toggle"]').trigger("click");
    expect(wrapper.get(".artboard").classes()).not.toContain("show-grid");
    expect(wrapper.get('[data-testid="grid-toggle"]').attributes("aria-pressed")).toBe("false");
    expect(wrapper.get('[data-testid="grid-toggle"]').attributes("title")).toBe("Show grid");
    expect(wrapper.get('[data-testid="grid-toggle"]').attributes("aria-label")).toBe("Show grid");
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

    const fitButton = wrapper.get('[data-testid="fit-view-button"]');
    expect(fitButton.attributes("type")).toBe("button");
    expect(fitButton.attributes("aria-label")).toBe("Fit Screen_1 canvas view");
    expect(fitButton.attributes("title")).toBe("Fit Screen_1 canvas view");

    await fitButton.trigger("click");

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

    const fullscreenButton = wrapper.get('[data-testid="fullscreen-canvas-button"]');
    expect(fullscreenButton.attributes("type")).toBe("button");
    expect(fullscreenButton.attributes("aria-label")).toBe("Open Screen_1 canvas fullscreen");
    expect(fullscreenButton.attributes("title")).toBe("Open Screen_1 canvas fullscreen");

    await fullscreenButton.trigger("click");

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Canvas fullscreen opened");
    });
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

    expect(wrapper.get('[data-testid="add-screen-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="duplicate-screen-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="delete-screen-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="duplicate-screen-button"]').attributes("aria-label")).toBe("Duplicate Screen_1 screen");
    expect(wrapper.get('[data-testid="duplicate-screen-button"]').attributes("title")).toBe("Duplicate Screen_1 screen");
    expect(wrapper.get('[data-testid="delete-screen-button"]').attributes("aria-label")).toBe("Delete Screen_1 screen");
    expect(wrapper.get('[data-testid="delete-screen-button"]').attributes("title")).toBe("Delete Screen_1 screen");
    expect(wrapper.get('[data-testid="active-screen-name-input"]').attributes("aria-label")).toBe("Rename Screen_1 screen");
    expect(wrapper.get('[data-testid="active-screen-name-input"]').attributes("title")).toBe("Rename Screen_1 screen");
    expect(wrapper.get('[data-testid="screen-summary"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="screen-summary"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="screen-summary"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.get('[data-testid="screen-row-screen-1"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="screen-row-screen-1"]').attributes("aria-label")).toBe("Open Screen_1 screen, Active, 7 widgets");
    expect(wrapper.get('[data-testid="screen-row-screen-1"]').attributes("title")).toBe("Open Screen_1 screen, Active, 7 widgets");
    expect(wrapper.get('[data-testid="screen-row-screen-1"]').attributes("aria-pressed")).toBe("true");

    await wrapper.get('[data-testid="add-screen-button"]').trigger("click");
    expect(wrapper.text()).toContain("Screen_2");
    expect(wrapper.get('[data-testid="screen-summary"]').text()).toContain("2 screens");
    expect(wrapper.get('[data-testid="screen-row-screen-2"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="screen-row-screen-1"]').attributes("aria-pressed")).toBe("false");
    expect(wrapper.get('[data-testid="duplicate-screen-button"]').attributes("aria-label")).toBe("Duplicate Screen_2 screen");
    expect(wrapper.get('[data-testid="delete-screen-button"]').attributes("aria-label")).toBe("Delete Screen_2 screen");
    expect(wrapper.get('[data-testid="active-screen-name-input"]').attributes("aria-label")).toBe("Rename Screen_2 screen");
    expect(wrapper.get('[data-testid="active-screen-name-input"]').attributes("title")).toBe("Rename Screen_2 screen");

    await wrapper.get('[data-testid="screen-row-screen-2"]').trigger("click");
    expect(wrapper.get('[data-testid="active-screen-label"]').text()).toBe("Screen_2");
    expect(wrapper.get('[data-testid="screen-row-screen-2"]').attributes("aria-pressed")).toBe("true");

    await wrapper.get('[data-testid="duplicate-screen-button"]').trigger("click");
    expect(wrapper.text()).toContain("Screen_2_1");
    expect(wrapper.get('[data-testid="active-screen-label"]').text()).toBe("Screen_2_1");
    expect(wrapper.get('[data-testid="duplicate-screen-button"]').attributes("title")).toBe("Duplicate Screen_2_1 screen");
    expect(wrapper.get('[data-testid="delete-screen-button"]').attributes("title")).toBe("Delete Screen_2_1 screen");

    await wrapper.get('[data-testid="delete-screen-button"]').trigger("click");
    expect(wrapper.find('[data-testid="screen-row-screen-2-1"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="active-screen-label"]').text()).toBe("Screen_2");
  });

  it("keeps the screens panel bound to real ProjectDoc screens only", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();

    expect(store.project.screens).toHaveLength(1);
    expect(wrapper.get('[data-testid="screen-summary"]').text()).toContain("1 screen");
    expect(wrapper.find('[data-testid="screen-row-screen-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="screen-row-activity"]').exists()).toBe(false);
    expect(wrapper.find(".screen-row.ghost").exists()).toBe(false);

    await wrapper.get('[data-testid="add-screen-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(store.project.screens.map((screen) => screen.name)).toEqual(["Screen_1", "Screen_2"]);
    expect(wrapper.get('[data-testid="active-screen-label"]').text()).toBe("Screen_2");
    expect(wrapper.get('[data-testid="screen-summary"]').text()).toContain("2 screens");
    expect(wrapper.find('[data-testid="screen-row-activity"]').exists()).toBe(false);
    expect(wrapper.find(".screen-row.ghost").exists()).toBe(false);
  });

  it("uses singular labels for one screen and one widget in the screens list", () => {
    const screen = {
      id: "screen-home",
      name: "Home",
      root: {
        id: "root-home",
        parentId: null,
        name: "Home_Root",
        type: "screen",
        layout: { x: 0, y: 0, width: 480, height: 480 },
        style: {},
        props: {},
        locked: false,
        hidden: false,
        children: [
          {
            id: "label-1",
            parentId: "root-home",
            name: "Title_Label",
            type: "label",
            layout: { x: 0, y: 0, width: 120, height: 40 },
            style: {},
            props: { text: "Title" },
            locked: false,
            hidden: false,
            children: []
          }
        ]
      }
    } satisfies ScreenNode;
    const wrapper = mount(ScreensPanel, {
      global: {
        plugins: [createPinia()]
      },
      props: {
        activeScreen: screen,
        screens: [screen],
        hasDuplicateScreenNames: false
      }
    });

    expect(wrapper.get('[data-testid="screen-summary"]').text()).toBe("1 screen");
    expect(wrapper.get('[data-testid="screen-row-home"]').text()).toContain("1 widget");
    expect(wrapper.get('[data-testid="screen-list-header"]').text()).toContain("Screen");
    expect(wrapper.get('[data-testid="screen-list-header"]').text()).toContain("Widgets");
    expect(wrapper.get('[data-testid="screen-list-header"]').text()).toContain("State");
    expect(wrapper.get('[data-testid="screen-row-home"] [data-screen-cell="name"]').text()).toContain("Home");
    expect(wrapper.get('[data-testid="screen-row-home"] [data-screen-cell="widgets"]').text()).toBe("1 widget");
    expect(wrapper.get('[data-testid="screen-row-home"] [data-screen-cell="state"]').text()).toBe("Active");
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

    const warning = wrapper.get('[data-testid="screen-name-warning"]');
    expect(warning.text()).toBe("Screen names should be unique.");
    expect(warning.attributes("id")).toBe("screen-name-warning");
    expect(warning.attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="active-screen-name-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="active-screen-name-input"]').attributes("aria-describedby")).toBe("screen-name-warning");
    expect(wrapper.get('[data-testid="active-screen-label"]').text()).toBe("Screen_1");
  });

  it("reorders and deletes widgets from the layers panel", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="layer-row-screen-root"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="layer-row-screen-root"]').attributes("aria-pressed")).toBe("false");
    expect(wrapper.get('[data-testid="layer-row-screen-root"]').attributes("aria-label")).toBe("Select screen root Screen_1");
    expect(wrapper.get('[data-testid="layer-row-screen-root"]').attributes("title")).toBe("Select screen root Screen_1");
    expect(wrapper.get('[data-testid="layer-row-date-label"]').attributes("role")).toBe("button");
    expect(wrapper.get('[data-testid="layer-row-date-label"]').attributes("tabindex")).toBe("0");
    expect(wrapper.get('[data-testid="layer-row-date-label"]').attributes("aria-label")).toBe("Select Date_Label label layer");
    expect(wrapper.get('[data-testid="layer-row-date-label"]').attributes("title")).toBe("Select Date_Label label layer");
    expect(wrapper.get('[data-testid="layer-row-date-label"]').attributes("aria-pressed")).toBe("false");
    expect(wrapper.get('[data-testid="layer-name-date-label"]').attributes("aria-label")).toBe("Rename Date_Label layer");
    expect(wrapper.get('[data-testid="layer-name-date-label"]').attributes("title")).toBe("Rename Date_Label layer");
    expect(wrapper.get('[data-testid="layer-state-date-label"] .layer-eye-status').attributes("role")).toBe("img");
    expect(wrapper.get('[data-testid="layer-state-date-label"] .layer-eye-status').attributes("aria-label")).toBe("Layer visible");
    expect(wrapper.get('[data-testid="layer-state-date-label"] .layer-eye-status').attributes("title")).toBe("Layer visible");
    expect(wrapper.get('[data-testid="layer-lock-date-label"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="layer-hide-date-label"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="layer-up-date-label"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="layer-up-date-label"]').attributes("title")).toBe("Move Date_Label layer up");
    expect(wrapper.get('[data-testid="layer-up-date-label"]').attributes("aria-label")).toBe("Move Date_Label layer up");
    expect(wrapper.get('[data-testid="layer-down-date-label"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="layer-down-date-label"]').attributes("title")).toBe("Move Date_Label layer down");
    expect(wrapper.get('[data-testid="layer-delete-time-label"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="layer-delete-time-label"]').attributes("title")).toBe("Delete Time_Label layer");
    expect(wrapper.get('[data-testid="layer-delete-time-label"]').attributes("aria-label")).toBe("Delete Time_Label layer");

    await wrapper.get('[data-testid="layer-row-date-label"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="layer-row-date-label"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="layer-row-screen-root"]').attributes("aria-pressed")).toBe("false");

    await wrapper.get('[data-testid="layer-row-screen-root"]').trigger("click");
    await wrapper.get('[data-testid="layer-row-date-label"]').trigger("keydown", { key: "Enter" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="layer-row-date-label"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="layer-row-screen-root"]').attributes("aria-pressed")).toBe("false");

    await wrapper.get('[data-testid="layer-row-screen-root"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="layer-row-screen-root"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="layer-row-date-label"]').attributes("aria-pressed")).toBe("false");

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

  it("filters layer rows by layer search text", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="layer-search-input"]').attributes("aria-label")).toBe("Search layers");
    expect(wrapper.get('[data-testid="layer-search-input"]').attributes("title")).toBe("Search layers");

    await wrapper.get('[data-testid="layer-search-input"]').setValue("bpm");
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="layer-search-result-count"]').text()).toBe("1 layer");
    expect(wrapper.get('[data-testid="layer-search-result-count"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="layer-search-result-count"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="layer-search-result-count"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.find('[data-testid="layer-row-bpm-metric"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="layer-row-time-label"]').exists()).toBe(false);

    await wrapper.get('[data-testid="layer-search-input"]').setValue("missing");
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="layer-search-result-count"]').text()).toBe("0 layers");
    expect(wrapper.get('[data-testid="layer-empty-state"]').text()).toContain("No layers match");
    expect(wrapper.get('[data-testid="layer-empty-state"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="layer-empty-state"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="layer-empty-state"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.get('[data-testid="clear-layer-search-button"]').attributes("title")).toBe("Clear layer search");
    expect(wrapper.get('[data-testid="clear-layer-search-button"] svg').attributes("data-icon-name")).toBe("close");

    await wrapper.get('[data-testid="clear-layer-search-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="layer-row-time-label"]').exists()).toBe(true);
    expect((wrapper.get('[data-testid="layer-search-input"]').element as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(wrapper.get('[data-testid="layer-search-input"]').element);
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
    expect(wrapper.get('[data-testid="event-empty-state"]').text()).toContain("No events bound");
    expect(wrapper.get('[data-testid="event-empty-state"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="event-empty-state"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="event-empty-state"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.get('[data-testid="event-type-select"]').attributes("aria-label")).toBe("Event type");
    expect(wrapper.get('[data-testid="event-target-select"]').attributes("aria-label")).toBe("Event target");
    expect(wrapper.get('[data-testid="event-handler-input"]').attributes("aria-label")).toBe("Event handler");
    expect(wrapper.get('[data-testid="event-handler-input"]').attributes("title")).toBe("Event handler");
    expect(wrapper.get('[data-testid="add-event-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="add-event-button"]').attributes("aria-label")).toBe("Add LV_EVENT_CLICKED event to Time_Label");
    expect(wrapper.get('[data-testid="add-event-button"]').attributes("title")).toBe("Add LV_EVENT_CLICKED event to Time_Label");
    await wrapper.get('[data-testid="event-type-select"]').setValue("LV_EVENT_CLICKED");
    await wrapper.get('[data-testid="event-handler-input"]').setValue("on_time_clicked");
    expect(wrapper.get('[data-testid="add-event-button"]').attributes("aria-label")).toBe("Add LV_EVENT_CLICKED event to Time_Label");
    expect(wrapper.get('[data-testid="add-event-button"]').attributes("title")).toBe("Add LV_EVENT_CLICKED event to Time_Label");
    await wrapper.get('[data-testid="add-event-button"]').trigger("click");

    expect(wrapper.text()).toContain("LV_EVENT_CLICKED");
    expect(wrapper.text()).toContain("on_time_clicked");
    expect(wrapper.text()).toContain("Time_Label");
    expect(wrapper.get('[data-testid="event-list-header"]').text()).toContain("Target");
    expect(wrapper.get('[data-testid="event-list-header"]').text()).toContain("Event");
    expect(wrapper.get('[data-testid="event-list-header"]').text()).toContain("Handler");
    expect(wrapper.get('[data-testid="event-list-header"]').text()).toContain("Action");
    expect(wrapper.find('[data-testid="event-list"] [data-event-cell="target"]').text()).toContain("Time_Label");
    expect(wrapper.find('[data-testid="event-list"] [data-event-cell="event"]').text()).toBe("LV_EVENT_CLICKED");
    expect(wrapper.find('[data-testid="event-list"] [data-event-cell="handler"]').text()).toBe("on_time_clicked");
    expect(wrapper.find('[data-testid="event-list"] [data-event-cell="action"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid^="remove-event-"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid^="remove-event-"]').attributes("aria-label")).toBe("Remove LV_EVENT_CLICKED event from Time_Label handled by on_time_clicked");
    expect(wrapper.get('[data-testid^="remove-event-"]').attributes("title")).toBe("Remove LV_EVENT_CLICKED event from Time_Label handled by on_time_clicked");
    expect(wrapper.get('[data-testid^="remove-event-"] svg').attributes("data-icon-name")).toBe("close");
    expect(wrapper.find('[data-testid="event-empty-state"]').exists()).toBe(false);
  });

  it("shows event bindings immediately when adding them to a different target widget", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    await wrapper.get('[data-testid="inspector-events-tab"]').trigger("click");
    await wrapper.get('[data-testid="event-target-select"]').setValue("start-button");
    await wrapper.get('[data-testid="event-handler-input"]').setValue("on_start_clicked");
    await wrapper.get('[data-testid="add-event-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(store.project.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        widgetId: "start-button",
        event: "LV_EVENT_CLICKED",
        handlerName: "on_start_clicked"
      })
    ]));
    expect(wrapper.find('[data-testid="event-empty-state"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="event-list"] [data-event-cell="target"]').text()).toContain("Start_Button");
    expect(wrapper.find('[data-testid="event-list"] [data-event-cell="handler"]').text()).toBe("on_start_clicked");

    await wrapper.get('[data-testid^="remove-event-"]').trigger("click");
    expect(store.project.events.some((event) => event.handlerName === "on_start_clicked")).toBe(false);
  });

  it("submits event bindings with Enter and disables empty handlers", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    await wrapper.get('[data-testid="inspector-events-tab"]').trigger("click");
    await wrapper.get('[data-testid="event-handler-input"]').setValue("");

    expect(wrapper.get('[data-testid="add-event-button"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="add-event-button"]').attributes("aria-label")).toBe("Enter handler to add LV_EVENT_CLICKED event to Time_Label");
    expect(wrapper.get('[data-testid="add-event-button"]').attributes("title")).toBe("Enter handler to add LV_EVENT_CLICKED event to Time_Label");

    await wrapper.get('[data-testid="event-handler-input"]').setValue("on_enter_ready");
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="add-event-button"]').attributes("aria-label")).toBe("Add LV_EVENT_CLICKED event to Time_Label");
    expect(wrapper.get('[data-testid="add-event-button"]').attributes("title")).toBe("Add LV_EVENT_CLICKED event to Time_Label");
    await wrapper.get('[data-testid="event-handler-input"]').trigger("keydown.enter");

    expect(store.project.events).toContainEqual(expect.objectContaining({
      widgetId: "time-label",
      handlerName: "on_enter_ready"
    }));
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
    expect(wrapper.text()).toContain("Date_Label");
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
                objectKey: "projects/project-1/assets/asset-1/icon_heart.png",
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
      attachTo: document.body,
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
      attachTo: document.body,
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
      },
      {
        id: "asset-font",
        projectId: "project-watch-demo",
        name: "watch_digits.ttf",
        kind: "font",
        mimeType: "font/ttf",
        sizeBytes: 8192,
        objectKey: "projects/project-watch-demo/assets/watch_digits.ttf",
        createdAt: "2026-05-08T00:00:00Z"
      }
    ];
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("icon_heart.png");
    expect(wrapper.text()).toContain("brand_logo.jpg");
    expect(wrapper.text()).toContain("watch_digits.ttf");
    expect(wrapper.get(".asset-tabs").attributes("role")).toBe("tablist");
    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("role")).toBe("tab");
    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("aria-label")).toBe("Show asset resources");
    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("title")).toBe("Show asset resources");
    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("tabindex")).toBe("0");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("aria-label")).toBe("Show font resources");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("title")).toBe("Show font resources");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("tabindex")).toBe("-1");
    expect(wrapper.get('[data-testid="asset-search-input"]').attributes("aria-label")).toBe("Filter resources");
    expect(wrapper.get('[data-testid="asset-search-input"]').attributes("title")).toBe("Filter resources");
    expect(wrapper.get('[data-testid="asset-kind-filter"]').attributes("aria-label")).toBe("Asset filter");
    expect(wrapper.get('[data-testid="asset-kind-filter"]').attributes("title")).toBe("Asset filter");

    await wrapper.get('[data-testid="asset-search-input"]').setValue("jpeg");

    expect(wrapper.text()).not.toContain("icon_heart.png");
    expect(wrapper.text()).toContain("brand_logo.jpg");
    expect(wrapper.text()).not.toContain("watch_digits.ttf");

    await wrapper.get('[data-testid="asset-search-input"]').setValue("");
    await wrapper.get('[data-testid="asset-fonts-tab"]').trigger("click");

    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("tabindex")).toBe("-1");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("tabindex")).toBe("0");
    expect(wrapper.text()).not.toContain("brand_logo.jpg");
    expect(wrapper.text()).toContain("watch_digits.ttf");

    const assetsTabFocus = vi.spyOn(wrapper.get('[data-testid="asset-assets-tab"]').element as HTMLElement, "focus");
    await wrapper.get('[data-testid="asset-fonts-tab"]').trigger("keydown", { key: "ArrowLeft" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("tabindex")).toBe("0");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("tabindex")).toBe("-1");
    expect(assetsTabFocus).toHaveBeenCalled();
    expect(wrapper.text()).toContain("brand_logo.jpg");

    const fontsTabFocus = vi.spyOn(wrapper.get('[data-testid="asset-fonts-tab"]').element as HTMLElement, "focus");
    await wrapper.get('[data-testid="asset-assets-tab"]').trigger("keydown", { key: "ArrowRight" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("tabindex")).toBe("-1");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("tabindex")).toBe("0");
    expect(fontsTabFocus).toHaveBeenCalled();
    expect(wrapper.text()).toContain("watch_digits.ttf");

    await wrapper.get('[data-testid="asset-assets-tab"]').trigger("click");
    await wrapper.get('[data-testid="asset-kind-filter"]').setValue("image");

    expect(wrapper.text()).toContain("brand_logo.jpg");
    expect(wrapper.text()).not.toContain("watch_digits.ttf");
    expect(wrapper.get('[data-testid="asset-list-view-button"]').attributes("title")).toBe("Resources are shown as a list");
    expect(wrapper.get('[data-testid="asset-list-view-button"]').attributes("aria-label")).toBe("Resources are shown as a list");
    expect(wrapper.get('[data-testid="asset-grid-view-button"]').attributes("title")).toBe("Show resources as a grid");
    expect(wrapper.get('[data-testid="asset-grid-view-button"]').attributes("aria-label")).toBe("Show resources as a grid");
    expect(wrapper.get('[data-testid="asset-list-view-button"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="asset-grid-view-button"]').attributes("aria-pressed")).toBe("false");
    expect(wrapper.get('[data-testid="asset-import-control"]').attributes("title")).toBe("Import asset");
    expect(wrapper.get('[data-testid="asset-import-control"]').attributes("role")).toBe("button");
    expect(wrapper.get('[data-testid="asset-import-control"]').attributes("tabindex")).toBe("0");
    const fileInputClick = vi.spyOn(wrapper.get('[data-testid="asset-file-input"]').element as HTMLInputElement, "click");

    await wrapper.get('[data-testid="asset-import-control"]').trigger("keydown", { key: "Enter" });

    expect(fileInputClick).toHaveBeenCalled();

    await wrapper.get('[data-testid="asset-grid-view-button"]').trigger("click");

    expect(wrapper.get('[data-testid="asset-list-view-button"]').attributes("aria-pressed")).toBe("false");
    expect(wrapper.get('[data-testid="asset-list-view-button"]').attributes("title")).toBe("Show resources as a list");
    expect(wrapper.get('[data-testid="asset-list-view-button"]').attributes("aria-label")).toBe("Show resources as a list");
    expect(wrapper.get('[data-testid="asset-grid-view-button"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="asset-grid-view-button"]').attributes("title")).toBe("Resources are shown as a grid");
    expect(wrapper.get('[data-testid="asset-grid-view-button"]').attributes("aria-label")).toBe("Resources are shown as a grid");

    await wrapper.get('[data-testid="asset-fonts-tab"]').trigger("keydown", { key: "Home" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("tabindex")).toBe("0");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("tabindex")).toBe("-1");

    await wrapper.get('[data-testid="asset-assets-tab"]').trigger("keydown", { key: "End" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("aria-selected")).toBe("false");
    expect(wrapper.get('[data-testid="asset-assets-tab"]').attributes("tabindex")).toBe("-1");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-testid="asset-fonts-tab"]').attributes("tabindex")).toBe("0");

    await wrapper.get('[data-testid="asset-assets-tab"]').trigger("click");
    await wrapper.get('[data-testid="asset-list-view-button"]').trigger("click");

    expect(wrapper.get('[data-testid="asset-list-view-button"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="asset-list-view-button"]').attributes("title")).toBe("Resources are shown as a list");
    expect(wrapper.get('[data-testid="asset-list-view-button"]').attributes("aria-label")).toBe("Resources are shown as a list");
    expect(wrapper.get('[data-testid="asset-grid-view-button"]').attributes("aria-pressed")).toBe("false");
    expect(wrapper.get('[data-testid="asset-grid-view-button"]').attributes("title")).toBe("Show resources as a grid");
    expect(wrapper.get('[data-testid="asset-grid-view-button"]').attributes("aria-label")).toBe("Show resources as a grid");
    expect(wrapper.get('[data-testid="asset-results"]').classes()).toContain("asset-list");
    expect(wrapper.get('[data-testid="asset-result-count"]').text()).toBe("2 resources");
    expect(wrapper.get('[data-testid="asset-result-count"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="asset-result-count"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="asset-result-count"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.get('[data-testid="delete-asset-asset-logo"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="delete-asset-asset-logo"]').attributes("title")).toBe("Delete brand_logo.jpg resource");
    expect(wrapper.get('[data-testid="delete-asset-asset-logo"]').attributes("aria-label")).toBe("Delete brand_logo.jpg resource");

    await wrapper.get('[data-testid="asset-search-input"]').setValue("missing");

    expect(wrapper.get('[data-testid="asset-result-count"]').text()).toBe("0 resources");
    expect(wrapper.get('[data-testid="clear-asset-search-button"] svg').attributes("data-icon-name")).toBe("close");
    expect(wrapper.get('[data-testid="assets-empty-state"]').text()).toContain("No matching assets");
    expect(wrapper.get('[data-testid="assets-empty-state"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="assets-empty-state"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="assets-empty-state"]').attributes("aria-atomic")).toBe("true");

    await wrapper.get('[data-testid="clear-asset-search-button"]').trigger("click");

    expect((wrapper.get('[data-testid="asset-search-input"]').element as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(wrapper.get('[data-testid="asset-search-input"]').element);
    expect(wrapper.text()).toContain("brand_logo.jpg");
  });

  it("treats the SquareLine-style sample resources as a searchable selectable resource list", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="asset-result-count"]').text()).toBe("8 resources");
    expect(wrapper.get('[data-testid="sample-asset-heart-png"]').attributes("role")).toBe("button");
    expect(wrapper.get('[data-testid="sample-asset-heart-png"]').attributes("aria-label")).toBe("Select reference resource heart.png, Image, image 64x64");
    expect(wrapper.get('[data-testid="sample-asset-heart-png"]').attributes("title")).toBe("Select reference resource heart.png, Image, image 64x64");
    expect(wrapper.get('[data-testid="sample-asset-heart-png"]').attributes("aria-pressed")).toBe("false");

    await wrapper.get('[data-testid="asset-search-input"]').setValue("heart");

    expect(wrapper.get('[data-testid="asset-result-count"]').text()).toBe("1 resource");
    expect(wrapper.get('[data-testid="sample-asset-heart-png"]').text()).toContain("heart.png");
    expect(wrapper.find('[data-testid="sample-asset-bg-png"]').exists()).toBe(false);

    await wrapper.get('[data-testid="sample-asset-heart-png"]').trigger("click");

    expect(wrapper.get('[data-testid="sample-asset-heart-png"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="asset-selection-bar"]').text()).toContain("heart.png");
    expect(wrapper.get('[data-testid="asset-selection-bar"]').text()).toContain("Reference Resource");
    expect(wrapper.get('[data-testid="asset-selection-bar"]').text()).toContain("Import to bind");
    expect(wrapper.get('[data-testid="asset-selection-bar"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="asset-selection-bar"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="asset-selection-bar"]').attributes("aria-atomic")).toBe("true");

    await wrapper.get('[data-testid="asset-search-input"]').setValue("missing");

    expect(wrapper.get('[data-testid="asset-result-count"]').text()).toBe("0 resources");
    expect(wrapper.get('[data-testid="assets-empty-state"]').text()).toContain("No matching resources");
    expect(wrapper.get('[data-testid="assets-empty-state"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="assets-empty-state"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="assets-empty-state"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.find('[data-testid="asset-selection-bar"]').exists()).toBe(false);

    await wrapper.get('[data-testid="asset-search-input"]').setValue("");
    await wrapper.get('[data-testid="asset-fonts-tab"]').trigger("click");

    expect(wrapper.get('[data-testid="asset-result-count"]').text()).toBe("4 resources");
    expect(wrapper.get('[data-testid="sample-asset-lv-font-montserrat-14"]').text()).toContain("lv_font_montserrat_14");
    expect(wrapper.get('[data-testid="sample-asset-lv-font-montserrat-14"]').attributes("aria-label")).toBe("Select reference resource lv_font_montserrat_14, Font, font 14px");

    await wrapper.get('[data-testid="asset-kind-filter"]').setValue("image");

    expect(wrapper.get('[data-testid="asset-result-count"]').text()).toBe("0 resources");
    expect(wrapper.get('[data-testid="assets-empty-state"]').text()).toContain("No matching resources");
    expect(wrapper.find('[data-testid="sample-asset-lv-font-montserrat-14"]').exists()).toBe(false);
  });

  it("imports a reference image resource and binds it to the selected image widget", async () => {
    signInForCloudSaves();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn().mockReturnValue("blob:heart") });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && init?.method === "POST") {
        return Promise.resolve(projectCreateResponse());
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        return Promise.resolve(projectSaveResponse());
      }
      if (url === "/api/projects/project-1/assets" && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({
          asset: {
            id: "asset-heart",
            projectId: "project-1",
            name: "heart.png",
            kind: "image",
            mimeType: "image/png",
            width: 1,
            height: 1,
            sizeBytes: 68,
            objectKey: "projects/project-1/assets/asset-heart/heart.png",
            createdAt: "2026-05-08T00:00:00Z"
          }
        }), { status: 201 }));
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-image"]').trigger("click");
    await wrapper.get('[data-testid="asset-search-input"]').setValue("heart");
    await wrapper.get('[data-testid="sample-asset-heart-png"]').trigger("click");
    expect(wrapper.get('[data-testid="import-selected-reference-button"]').text()).toBe("Import Reference");

    await wrapper.get('[data-testid="import-selected-reference-button"]').trigger("click");
    await flushPromises();

    const uploadRequest = fetchMock.mock.calls.find(([url, init]) => url === "/api/projects/project-1/assets" && init?.method === "POST");
    expect(uploadRequest).toBeTruthy();
    expect(wrapper.text()).toContain("heart.png");
    expect(wrapper.get('[data-testid="image-binding-state"]').text()).toContain("Bound to heart.png");
    expect(wrapper.get('[data-testid="canvas-widget-image-1"] img').attributes("src")).toBe("blob:heart");
  });

  it("imports and binds a reference image locally when cloud save is unavailable", async () => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn().mockReturnValue("blob:local-heart") });
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-image"]').trigger("click");
    await wrapper.get('[data-testid="asset-search-input"]').setValue("heart");
    await wrapper.get('[data-testid="sample-asset-heart-png"]').trigger("click");
    await wrapper.get('[data-testid="import-selected-reference-button"]').trigger("click");
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalledWith("/api/projects/project-watch-demo/assets", expect.anything());
    expect(wrapper.text()).toContain("Asset imported locally: heart.png");
    expect(wrapper.get('[data-testid="image-binding-state"]').text()).toContain("Bound to heart.png");
    expect(wrapper.get('[data-testid="canvas-widget-image-1"] img').attributes("src")).toBe("blob:local-heart");
  });

  it("uploads local resources and rewrites references before exporting a migrated cloud project", async () => {
    signInForCloudSaves();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn().mockReturnValue("blob:local-heart") });
    const savedDocs: unknown[] = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects" && init?.method === "POST") {
        return Promise.resolve(projectCreateResponse("project-1"));
      }
      if (url === "/api/projects/project-1/doc" && init?.method === "PUT") {
        savedDocs.push(JSON.parse(String(init.body)).doc);
        return Promise.resolve(projectSaveResponse());
      }
      if (url === "/api/projects/project-1/assets" && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              asset: {
                id: "asset-heart-cloud",
                projectId: "project-1",
                name: "heart.png",
                kind: "image",
                mimeType: "image/png",
                width: 1,
                height: 1,
                sizeBytes: 3,
                objectKey: "projects/project-1/assets/asset-heart-cloud/heart.png",
                createdAt: "2026-05-08T00:00:00Z"
              }
            }),
            { status: 201 }
          )
        );
      }
      if (url === "/api/projects/project-1/export/c" && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ jobId: "job-local-sync" }), { status: 202 }));
      }
      if (url === "/api/jobs/job-local-sync") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              job: job({
                id: "job-local-sync",
                status: "succeeded",
                progress: 100,
                logs: [{ time: "2026-05-08T00:00:01Z", level: "info", message: "Build completed successfully" }],
                result: { downloadUrl: "/api/jobs/job-local-sync/download" }
              })
            }),
            { status: 200 }
          )
        );
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const projectStore = useProjectStore(pinia);
    const assetsStore = useAssetsStore(pinia);
    await projectStore.addWidgetFromCatalog("image", { x: 12, y: 16 });
    const localAsset = assetsStore.importLocalAsset(projectStore.project.id, new File(["png"], "heart.png", { type: "image/png" }));
    expect(localAsset).not.toBeNull();
    projectStore.registerAsset(localAsset!);
    projectStore.bindSelectedImageAsset(localAsset!.id);
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-testid="build-button"]').trigger("click");
    await flushPromises();

    const exportCallIndex = fetchMock.mock.calls.findIndex(([url]) => url === "/api/projects/project-1/export/c");
    const uploadCallIndex = fetchMock.mock.calls.findIndex(([url]) => url === "/api/projects/project-1/assets");
    const finalDoc = savedDocs.at(-1) as {
      assets: Array<{ id: string; objectKey: string }>;
      screens: Array<{ root: { children: Array<{ type: string; props: { assetId?: string } }> } }>;
    };
    const syncedImage = finalDoc.screens[0].root.children.find((child) => child.type === "image");
    expect(uploadCallIndex).toBeGreaterThan(-1);
    expect(exportCallIndex).toBeGreaterThan(uploadCallIndex);
    expect(savedDocs).toHaveLength(2);
    expect(finalDoc.assets).toContainEqual(expect.objectContaining({ id: "asset-heart-cloud" }));
    expect(finalDoc.assets.some((asset) => asset.objectKey.startsWith("local://"))).toBe(false);
    expect(syncedImage?.props.assetId).toBe("asset-heart-cloud");
    expect(projectStore.project.assets.some((asset) => asset.id === localAsset!.id)).toBe(false);
    expect(assetsStore.assets.some((asset) => asset.id === localAsset!.id)).toBe(false);
    expect(wrapper.text()).toContain("Build completed successfully");
  });

  it("deletes a local-only resource without calling the asset API", async () => {
    const pinia = createPinia();
    const revokeObjectURL = vi.fn();
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn().mockReturnValue("blob:local-heart"), revokeObjectURL });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia]
      }
    });
    const assetsStore = useAssetsStore(pinia);
    const projectStore = useProjectStore(pinia);
    const asset = assetsStore.importLocalAsset(projectStore.project.id, new File(["png"], "heart.png", { type: "image/png" }));
    expect(asset).not.toBeNull();
    projectStore.registerAsset(asset!);
    await wrapper.vm.$nextTick();

    await wrapper.get(`[data-testid="delete-asset-${asset!.id}"]`).trigger("click");
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalledWith(`/api/projects/${projectStore.project.id}/assets/${asset!.id}`, expect.anything());
    expect(projectStore.project.assets.some((item) => item.id === asset!.id)).toBe(false);
    expect(assetsStore.assets.some((item) => item.id === asset!.id)).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-heart");
    expect(wrapper.find(`[data-testid="asset-card-${asset!.id}"]`).exists()).toBe(false);
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Asset deleted: heart.png");
  });

  it("selects a resource card and binds an image asset from the assets panel", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const assetsStore = useAssetsStore(pinia);
    const projectStore = useProjectStore(pinia);
    const asset = {
      id: "asset-heart",
      projectId: "project-watch-demo",
      name: "icon_heart.png",
      kind: "image" as const,
      mimeType: "image/png",
      width: 24,
      height: 24,
      sizeBytes: 2048,
      objectKey: "projects/project-watch-demo/assets/icon_heart.png",
      createdAt: "2026-05-08T00:00:00Z"
    };
    assetsStore.assets = [asset];
    projectStore.registerAsset(asset);
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="asset-card-asset-heart"]').attributes("aria-label")).toBe("Select resource icon_heart.png, Image, 24x24, 2 KB, Unused");
    expect(wrapper.get('[data-testid="asset-card-asset-heart"]').attributes("title")).toBe("Select resource icon_heart.png, Image, 24x24, 2 KB, Unused");
    expect(wrapper.get('[data-testid="asset-card-asset-heart"]').attributes("aria-pressed")).toBe("false");

    await wrapper.get('[data-testid="asset-card-asset-heart"]').trigger("click");

    expect(wrapper.get('[data-testid="asset-card-asset-heart"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="asset-selection-bar"]').text()).toContain("icon_heart.png");
    expect(wrapper.get('[data-testid="asset-selection-bar"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="asset-selection-bar"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="asset-selection-bar"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.get('[data-testid="bind-selected-asset-button"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="bind-selected-asset-button"]').attributes("aria-describedby")).toBe("asset-bind-hint");
    expect(wrapper.get('[data-testid="bind-selected-asset-button"]').attributes("aria-label")).toBe("Bind icon_heart.png to selected image widget");
    expect(wrapper.get('[data-testid="bind-selected-asset-button"]').attributes("title")).toBe("Select an unlocked image widget to bind this resource.");
    expect(wrapper.get('[data-testid="asset-bind-hint"]').text()).toBe("Select an unlocked image widget to bind this resource.");
    expect(wrapper.get('[data-testid="asset-bind-hint"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="asset-bind-hint"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="asset-bind-hint"]').attributes("aria-atomic")).toBe("true");

    await projectStore.addWidgetFromCatalog("image", { x: 20, y: 20 });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="asset-bind-hint"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="bind-selected-asset-button"]').attributes("aria-describedby")).toBeUndefined();
    expect(wrapper.get('[data-testid="bind-selected-asset-button"]').attributes("aria-label")).toBe("Bind icon_heart.png to selected image widget");
    expect(wrapper.get('[data-testid="bind-selected-asset-button"]').attributes("title")).toBe("Bind icon_heart.png to selected image widget");

    await wrapper.get('[data-testid="bind-selected-asset-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(projectStore.selectedWidget?.props.assetId).toBe("asset-heart");
    expect(wrapper.get('[data-testid="asset-usage-asset-heart"]').text()).toBe("Used 1");
  });

  it("does not show image binding guidance for selected font resources", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });
    const assetsStore = useAssetsStore(pinia);
    const projectStore = useProjectStore(pinia);
    const fontAsset = {
      id: "font-asset",
      projectId: "project-watch-demo",
      name: "brand.ttf",
      kind: "font" as const,
      mimeType: "font/ttf",
      sizeBytes: 2048,
      objectKey: "projects/project-watch-demo/assets/brand.ttf",
      createdAt: "2026-05-08T00:00:00Z"
    };
    assetsStore.assets = [fontAsset];
    projectStore.registerAsset(fontAsset);
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-testid="asset-fonts-tab"]').trigger("click");
    await wrapper.get('[data-testid="asset-card-font-asset"]').trigger("click");

    expect(wrapper.get('[data-testid="asset-selection-bar"]').text()).toContain("brand.ttf");
    expect(wrapper.find('[data-testid="bind-selected-asset-button"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="asset-bind-hint"]').exists()).toBe(false);
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
    expect(wrapper.text()).toContain("Sign in before uploading assets");
    const assetError = wrapper.get(".asset-error");
    expect(assetError.attributes("id")).toBe("asset-error");
    expect(assetError.attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="asset-import-control"]').attributes("aria-describedby")).toBe("asset-error");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token: "demo-token",
          user: { id: "user-demo", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }
        }),
        { status: 200 }
      )
    );
    await wrapper.get('[data-testid="demo-login-button"]').trigger("click");
    await flushPromises();

    expect(wrapper.find(".asset-error").exists()).toBe(false);
    expect(wrapper.get('[data-testid="asset-import-control"]').attributes("aria-describedby")).toBeUndefined();
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
      attachTo: document.body,
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
    expect(wrapper.get('[data-testid="image-binding-state"]').text()).toContain("Bound to icon_heart.png");
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
    expect(wrapper.get('[data-testid="image-binding-state"]').text()).toContain("Bound to icon_heart.png");

    await wrapper.get('[data-testid="preview-button"]').trigger("click");
    expect(wrapper.get('[data-testid="preview-widget-image-1"] .image-placeholder').text()).toContain("Missing preview");
  });

  it("warns when an image widget references a project asset that no longer exists", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [pinia]
      }
    });

    await wrapper.get('[data-testid="widget-card-image"]').trigger("click");
    const store = useProjectStore(pinia);
    store.updateSelectedProps({ assetId: "asset-missing" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="image-binding-state"]').text()).toContain("Selected image asset is missing");
  });

  it("deletes an asset from the assets panel and ProjectDoc", async () => {
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
      attachTo: document.body,
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
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Asset uploaded: icon_heart.png");
    fetchMock.mockClear();
    savedDocs.length = 0;

    await wrapper.get('[data-testid="delete-asset-asset-1"]').trigger("click");
    await flushPromises();

    const deleteCallIndex = fetchMock.mock.calls.findIndex(([url, init]) =>
      url === "/api/projects/project-1/assets/asset-1" && init?.method === "DELETE"
    );
    const saveBeforeDelete = [...fetchMock.mock.calls]
      .slice(0, deleteCallIndex)
      .reverse()
      .find(([url, init]) => url === "/api/projects/project-1/doc" && init?.method === "PUT");
    const savedBeforeDeleteDoc = JSON.parse(String(saveBeforeDelete?.[1]?.body)).doc as { assets: unknown[] };
    expect(savedBeforeDeleteDoc.assets).toEqual([]);
    expect(savedDocs.at(-1)).toMatchObject({ assets: [] });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/assets/asset-1", expect.objectContaining({ method: "DELETE" }));
    expect(wrapper.find('[data-testid="asset-card-asset-1"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Asset deleted: icon_heart.png");
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(wrapper.get('[data-testid="asset-list-view-button"]').element);
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
      attachTo: document.body,
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

    const assetDeleteButton = wrapper.get('[data-testid="delete-asset-asset-1"]').element as HTMLButtonElement;
    assetDeleteButton.focus();
    await wrapper.get('[data-testid="delete-asset-asset-1"]').trigger("click");
    await flushPromises();

    const assetDeleteConfirm = wrapper.get('[data-testid="asset-delete-confirm"]');
    expect(assetDeleteConfirm.text()).toContain("icon_heart.png");
    expect(assetDeleteConfirm.attributes("role")).toBe("dialog");
    expect(assetDeleteConfirm.attributes("aria-modal")).toBe("true");
    expect(assetDeleteConfirm.attributes("aria-labelledby")).toBe("asset-delete-confirm-title");
    expect(assetDeleteConfirm.attributes("aria-describedby")).toBe("asset-delete-confirm-description");
    expect(wrapper.get("#asset-delete-confirm-title").text()).toBe("Delete referenced asset?");
    expect(wrapper.get("#asset-delete-confirm-description").text()).toContain("Deleting it will clear those resource references.");
    expect(wrapper.get("#asset-delete-confirm-description").attributes("role")).toBe("alert");
    expect(document.activeElement).toBe(wrapper.get('[data-testid="cancel-delete-asset-button"]').element);
    expect(wrapper.get('[data-testid="cancel-delete-asset-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="cancel-delete-asset-button"]').attributes("aria-label")).toBe("Cancel deleting icon_heart.png asset");
    expect(wrapper.get('[data-testid="cancel-delete-asset-button"]').attributes("title")).toBe("Cancel deleting icon_heart.png asset");
    expect(wrapper.get('[data-testid="confirm-delete-asset-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="confirm-delete-asset-button"]').attributes("aria-label")).toBe("Delete icon_heart.png asset");
    expect(wrapper.get('[data-testid="confirm-delete-asset-button"]').attributes("title")).toBe("Delete icon_heart.png asset");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/projects/project-1/assets/asset-1", expect.objectContaining({ method: "DELETE" }));

    const cancelDeleteButton = wrapper.get('[data-testid="cancel-delete-asset-button"]').element as HTMLButtonElement;
    const confirmDeleteButton = wrapper.get('[data-testid="confirm-delete-asset-button"]').element as HTMLButtonElement;
    confirmDeleteButton.focus();
    await wrapper.get('[data-testid="confirm-delete-asset-button"]').trigger("keydown", { key: "Tab" });
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(cancelDeleteButton);

    await wrapper.get('[data-testid="cancel-delete-asset-button"]').trigger("keydown", { key: "Tab", shiftKey: true });
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(confirmDeleteButton);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="asset-delete-confirm"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="selector-input"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="selector-input"]').element).toHaveProperty("value", "Image_1");

    await wrapper.get('[data-testid="cancel-delete-asset-button"]').trigger("click");
    expect(wrapper.find('[data-testid="asset-delete-confirm"]').exists()).toBe(false);
    expect(document.activeElement).toBe(assetDeleteButton);
    expect(wrapper.text()).toContain("icon_heart.png");

    await wrapper.get('[data-testid="delete-asset-asset-1"]').trigger("click");
    await flushPromises();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="asset-delete-confirm"]').exists()).toBe(false);
    expect(document.activeElement).toBe(assetDeleteButton);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/projects/project-1/assets/asset-1", expect.objectContaining({ method: "DELETE" }));

    await wrapper.get('[data-testid="delete-asset-asset-1"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="asset-delete-confirm"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="asset-delete-confirm"]').exists()).toBe(false);
    expect(document.activeElement).toBe(assetDeleteButton);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/projects/project-1/assets/asset-1", expect.objectContaining({ method: "DELETE" }));

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
    expect(wrapper.find('[data-testid="asset-card-asset-1"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Asset deleted: icon_heart.png");
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(wrapper.get('[data-testid="asset-list-view-button"]').element);
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
    expect(wrapper.get("#asset-delete-confirm-description").text()).toContain("resource reference");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/projects/project-1/assets/font-1", expect.objectContaining({ method: "DELETE" }));
  });

  it("counts reusable style font asset usage and confirms before deleting the font", async () => {
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

    await wrapper.get('[data-testid="settings-nav-button"]').trigger("click");
    await wrapper.get('[data-testid="add-project-style-button"]').trigger("click");
    await wrapper.get('[data-testid="project-style-font-select"]').setValue("font-1");
    await flushPromises();

    expect(wrapper.get('[data-testid="asset-usage-font-1"]').text()).toBe("Used 1");

    await wrapper.get('[data-testid="delete-asset-font-1"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="asset-delete-confirm"]').text()).toContain("watch_digits.ttf");
    expect(wrapper.get("#asset-delete-confirm-description").text()).toContain("resource reference");
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

  it("does not delete an unreferenced asset when removing it from ProjectDoc cannot be saved", async () => {
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
    const input = wrapper.get('[data-testid="asset-file-input"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["png"], "icon_heart.png", { type: "image/png" })]
    });
    await input.trigger("change");
    await flushPromises();

    await wrapper.get('[data-testid="delete-asset-asset-1"]').trigger("click");
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

    const deleteEvent = new KeyboardEvent("keydown", { key: "Delete", cancelable: true });
    await document.dispatchEvent(deleteEvent);
    await wrapper.vm.$nextTick();

    expect(deleteEvent.defaultPrevented).toBe(true);
    expect(wrapper.text()).not.toContain("Label_1");
    expect(wrapper.get('[data-testid="inspector-empty-state"]').text()).toContain("No widget selected");
    expect(wrapper.get('[data-testid="inspector-empty-state"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="inspector-empty-state"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="inspector-empty-state"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.find('[data-testid="selector-input"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("prevents browser navigation when Backspace deletes the selected widget", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="widget-card-label"]').trigger("click");
    expect(wrapper.find('[data-testid="layer-row-label-1"]').exists()).toBe(true);

    const backspaceEvent = new KeyboardEvent("keydown", { key: "Backspace", cancelable: true });
    await document.dispatchEvent(backspaceEvent);
    await wrapper.vm.$nextTick();

    expect(backspaceEvent.defaultPrevented).toBe(true);
    expect(wrapper.find('[data-testid="layer-row-label-1"]').exists()).toBe(false);
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

  it("copies and pastes the selected widget from toolbar actions", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="canvas-widget-time-label"]').trigger("click");
    expect(wrapper.get('[data-testid="paste-widget-button"]').element).toHaveProperty("disabled", true);
    expect(wrapper.get('[data-testid="paste-widget-button"]').attributes("aria-label")).toBe("Paste copied widget");
    expect(wrapper.get('[data-testid="paste-widget-button"]').attributes("title")).toBe("Paste copied widget");
    expect(wrapper.get('[data-testid="copy-widget-button"] svg').attributes("data-icon-name")).toBe("copy");
    expect(wrapper.get('[data-testid="copy-widget-button"]').attributes("aria-label")).toBe("Copy Time_Label widget");
    expect(wrapper.get('[data-testid="copy-widget-button"]').attributes("title")).toBe("Copy Time_Label widget");
    expect(wrapper.get('[data-testid="paste-widget-button"] svg').attributes("data-icon-name")).toBe("paste");

    await wrapper.get('[data-testid="copy-widget-button"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="paste-widget-button"]').element).toHaveProperty("disabled", false);
    expect(wrapper.get('[data-testid="paste-widget-button"]').attributes("aria-label")).toBe("Paste Time_Label widget");
    expect(wrapper.get('[data-testid="paste-widget-button"]').attributes("title")).toBe("Paste Time_Label widget");

    await wrapper.get('[data-testid="paste-widget-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="canvas-widget-time-label-1"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="selector-input"]').element).toHaveProperty("value", "Time_Label_1");
  });

  it("opens desktop menus and runs visible menu commands", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="toolbar-menu-button"]').attributes("aria-label")).toBe("Open project menu");
    expect(wrapper.get('[data-testid="toolbar-menu-button"]').attributes("title")).toBe("Open project menu");
    expect(wrapper.get('[data-testid="toolbar-menu-button"]').attributes("aria-haspopup")).toBe("menu");
    expect(wrapper.get('[data-testid="toolbar-menu-button"]').attributes("aria-expanded")).toBe("false");
    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("aria-label")).toBe("Open File menu");
    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("title")).toBe("Open File menu");
    expect(wrapper.get('[data-testid="desktop-menu-edit-button"]').attributes("aria-label")).toBe("Open Edit menu");
    expect(wrapper.get('[data-testid="desktop-menu-view-button"]').attributes("title")).toBe("Open View menu");
    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("aria-haspopup")).toBe("menu");
    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("aria-expanded")).toBe("false");

    await wrapper.get('[data-testid="desktop-menu-file-button"]').trigger("click");
    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("aria-expanded")).toBe("true");
    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("aria-label")).toBe("File menu open");
    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("title")).toBe("File menu open");
    expect(wrapper.get('[data-testid="desktop-menu-file-popover"]').attributes("role")).toBe("menu");
    expect(wrapper.get('[data-testid="desktop-menu-file-popover"] .desktop-menu-divider').attributes("role")).toBe("separator");
    expect(wrapper.get('[data-testid="desktop-menu-command-new"]').attributes("role")).toBe("menuitem");
    expect(wrapper.get('[data-testid="desktop-menu-command-save"]').attributes("role")).toBe("menuitem");
    expect(wrapper.get('[data-testid="desktop-menu-file-popover"]').text()).toContain("New Project");
    expect(wrapper.get('[data-testid="desktop-menu-file-popover"]').text()).toContain("Save");

    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("click");
    expect(wrapper.get('[data-testid="toolbar-menu-button"]').attributes("aria-expanded")).toBe("true");
    expect(wrapper.get('[data-testid="toolbar-menu-button"]').attributes("aria-label")).toBe("Project menu open");
    expect(wrapper.get('[data-testid="toolbar-menu-button"]').attributes("title")).toBe("Project menu open");

    await wrapper.get('[data-testid="desktop-menu-file-button"]').trigger("keydown", { key: "ArrowRight" });
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("aria-expanded")).toBe("false");
    expect(wrapper.get('[data-testid="desktop-menu-edit-button"]').attributes("aria-expanded")).toBe("true");
    expect(wrapper.find('[data-testid="desktop-menu-file-popover"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="desktop-menu-edit-popover"]').exists()).toBe(true);
    expect(document.activeElement).toBe(wrapper.get('[data-testid="desktop-menu-edit-button"]').element);

    await wrapper.get('[data-testid="desktop-menu-edit-button"]').trigger("keydown", { key: "ArrowLeft" });
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("aria-expanded")).toBe("true");
    expect(wrapper.get('[data-testid="desktop-menu-edit-button"]').attributes("aria-expanded")).toBe("false");
    expect(wrapper.find('[data-testid="desktop-menu-file-popover"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="desktop-menu-edit-popover"]').exists()).toBe(false);
    expect(document.activeElement).toBe(wrapper.get('[data-testid="desktop-menu-file-button"]').element);

    await wrapper.get('[data-testid="desktop-menu-view-button"]').trigger("click");
    await wrapper.get('[data-testid="desktop-menu-command-preview"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="preview-overlay"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Preview updated");

    await wrapper.get('[data-testid="close-preview-button"]').trigger("click");
    await wrapper.get('[data-testid="desktop-menu-view-button"]').trigger("click");
    await wrapper.get('[data-testid="desktop-menu-command-simulator"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".bottom-dock.simulator-hidden").exists()).toBe(true);

    expect(wrapper.get('[data-testid="load-projects-button"] svg').attributes("data-icon-name")).toBe("folder");
    expect(wrapper.get('[data-testid="save-project-button"] svg').attributes("data-icon-name")).toBe("save");

    await wrapper.get('[data-testid="canvas-widget-time-label"]').trigger("click");
    await wrapper.get('[data-testid="desktop-menu-edit-button"]').trigger("click");
    await wrapper.get('[data-testid="desktop-menu-command-copy"]').trigger("click");
    await wrapper.get('[data-testid="desktop-menu-edit-button"]').trigger("click");
    await wrapper.get('[data-testid="desktop-menu-command-paste"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="canvas-widget-time-label-1"]').exists()).toBe(true);
  });

  it("moves keyboard focus through desktop menu commands", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="desktop-menu-file-button"]').trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(wrapper.get('[data-testid="desktop-menu-command-new"]').element);

    await wrapper.get('[data-testid="desktop-menu-command-new"]').trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.get('[data-testid="desktop-menu-command-open"]').element);

    await wrapper.get('[data-testid="desktop-menu-command-open"]').trigger("keydown", { key: "ArrowUp" });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.get('[data-testid="desktop-menu-command-new"]').element);
    wrapper.unmount();
  });

  it("returns focus to the desktop menu button after running a menu command", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="desktop-menu-file-button"]').trigger("click");
    const fileMenuButton = wrapper.get('[data-testid="desktop-menu-file-button"]').element as HTMLButtonElement;

    await wrapper.get('[data-testid="desktop-menu-command-save"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="desktop-menu-file-popover"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(fileMenuButton);
    wrapper.unmount();
  });

  it("keeps focus in the preview overlay after opening it from a desktop menu command", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="desktop-menu-view-button"]').trigger("click");
    await wrapper.get('[data-testid="desktop-menu-command-preview"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="desktop-menu-view-popover"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="preview-overlay"]').exists()).toBe(true);
    expect(document.activeElement).toBe(wrapper.get('[data-testid="preview-overlay"]').element);
    wrapper.unmount();
  });

  it("returns focus to the desktop menu button after closing a preview opened from its command", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="desktop-menu-view-button"]').trigger("click");
    const viewMenuButton = wrapper.get('[data-testid="desktop-menu-view-button"]').element as HTMLButtonElement;
    await wrapper.get('[data-testid="desktop-menu-command-preview"]').trigger("click");
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-testid="close-preview-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="preview-overlay"]').exists()).toBe(false);
    expect(document.activeElement).toBe(viewMenuButton);
    wrapper.unmount();
  });

  it("opens desktop menus from the last enabled command with ArrowUp", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="desktop-menu-file-button"]').trigger("keydown", { key: "ArrowUp" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("aria-expanded")).toBe("true");
    expect(wrapper.find('[data-testid="desktop-menu-file-popover"]').exists()).toBe(true);
    expect(document.activeElement).toBe(wrapper.get('[data-testid="desktop-menu-command-save"]').element);
    wrapper.unmount();
  });

  it("moves keyboard focus to first and last desktop menu buttons", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="desktop-menu-edit-button"]').trigger("click");
    await wrapper.get('[data-testid="desktop-menu-edit-button"]').trigger("keydown", { key: "End" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="desktop-menu-edit-button"]').attributes("aria-expanded")).toBe("false");
    expect(wrapper.get('[data-testid="desktop-menu-help-button"]').attributes("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(wrapper.get('[data-testid="desktop-menu-help-button"]').element);

    await wrapper.get('[data-testid="desktop-menu-help-button"]').trigger("keydown", { key: "Home" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("aria-expanded")).toBe("true");
    expect(wrapper.get('[data-testid="desktop-menu-help-button"]').attributes("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(wrapper.get('[data-testid="desktop-menu-file-button"]').element);
    wrapper.unmount();
  });

  it("switches between desktop menus from an open menu command", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="selected-text-input"]').setValue("12:45");
    await wrapper.get('[data-testid="desktop-menu-file-button"]').trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();
    await wrapper.get('[data-testid="desktop-menu-command-new"]').trigger("keydown", { key: "ArrowRight" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="desktop-menu-file-button"]').attributes("aria-expanded")).toBe("false");
    expect(wrapper.get('[data-testid="desktop-menu-edit-button"]').attributes("aria-expanded")).toBe("true");
    expect(wrapper.find('[data-testid="desktop-menu-file-popover"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="desktop-menu-edit-popover"]').exists()).toBe(true);
    expect(document.activeElement).toBe(wrapper.get('[data-testid="desktop-menu-command-undo"]').element);
    wrapper.unmount();
  });

  it("closes toolbar menus with Escape", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="desktop-menu-file-button"]').trigger("click");
    expect(wrapper.find('[data-testid="desktop-menu-file-popover"]').exists()).toBe(true);
    const fileMenuButton = wrapper.get('[data-testid="desktop-menu-file-button"]').element as HTMLButtonElement;
    (wrapper.get('[data-testid="desktop-menu-command-save"]').element as HTMLButtonElement).focus();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="desktop-menu-file-popover"]').exists()).toBe(false);
    expect(document.activeElement).toBe(fileMenuButton);

    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("click");
    expect(wrapper.find('[data-testid="toolbar-project-menu"]').exists()).toBe(true);
    const toolbarMenuButton = wrapper.get('[data-testid="toolbar-menu-button"]').element as HTMLButtonElement;
    (wrapper.get('[data-testid="menu-load-projects-button"]').element as HTMLButtonElement).focus();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="toolbar-project-menu"]').exists()).toBe(false);
    expect(document.activeElement).toBe(toolbarMenuButton);
  });

  it("opens the project menu from the keyboard and focuses its first action", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="toolbar-menu-button"]').attributes("aria-expanded")).toBe("true");
    expect(wrapper.find('[data-testid="toolbar-project-menu"]').exists()).toBe(true);
    expect(document.activeElement).toBe(wrapper.get('[data-testid="menu-load-projects-button"]').element);
    wrapper.unmount();
  });

  it("opens the project menu from the last action with ArrowUp", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("keydown", { key: "ArrowUp" });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="toolbar-menu-button"]').attributes("aria-expanded")).toBe("true");
    expect(wrapper.find('[data-testid="toolbar-project-menu"]').exists()).toBe(true);
    expect(document.activeElement).toBe(wrapper.get('[data-testid="menu-demo-login-button"]').element);
    wrapper.unmount();
  });

  it("moves keyboard focus through project menu actions", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();

    await wrapper.get('[data-testid="menu-load-projects-button"]').trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.get('[data-testid="menu-new-project-button"]').element);

    await wrapper.get('[data-testid="menu-new-project-button"]').trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.get('[data-testid="menu-login-email-input"]').element);

    await wrapper.get('[data-testid="menu-login-email-input"]').trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.get('[data-testid="menu-login-password-input"]').element);

    await wrapper.get('[data-testid="menu-login-password-input"]').trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.get('[data-testid="menu-login-button"]').element);

    await wrapper.get('[data-testid="menu-login-button"]').trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.get('[data-testid="menu-demo-login-button"]').element);

    await wrapper.get('[data-testid="menu-login-email-input"]').trigger("keydown", { key: "ArrowUp" });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.get('[data-testid="menu-new-project-button"]').element);

    await wrapper.get('[data-testid="menu-load-projects-button"]').trigger("keydown", { key: "End" });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.get('[data-testid="menu-demo-login-button"]').element);

    await wrapper.get('[data-testid="menu-demo-login-button"]').trigger("keydown", { key: "Home" });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(wrapper.get('[data-testid="menu-load-projects-button"]').element);
    wrapper.unmount();
  });

  it("keeps project and desktop menu popovers mutually exclusive", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="desktop-menu-file-button"]').trigger("click");
    expect(wrapper.find('[data-testid="desktop-menu-file-popover"]').exists()).toBe(true);

    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="toolbar-project-menu"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="desktop-menu-file-popover"]').exists()).toBe(false);

    await wrapper.get('[data-testid="desktop-menu-view-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="toolbar-project-menu"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="desktop-menu-view-popover"]').exists()).toBe(true);
  });

  it("switches desktop menu popovers on hover after a menu is open", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="desktop-menu-file-button"]').trigger("click");
    expect(wrapper.find('[data-testid="desktop-menu-file-popover"]').exists()).toBe(true);

    await wrapper.get('[data-testid="desktop-menu-edit-button"]').trigger("mouseenter");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="desktop-menu-file-popover"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="desktop-menu-edit-popover"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="desktop-menu-edit-button"]').classes()).toContain("active");

    await wrapper.get('[data-testid="desktop-menu-edit-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="desktop-menu-edit-popover"]').exists()).toBe(true);
  });

  it("shows an explicit cloud project menu empty state before projects are loaded", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("click");

    expect(wrapper.get('[data-testid="toolbar-project-menu"]').attributes("role")).toBe("menu");
    expect(wrapper.get('[data-testid="menu-project-count"]').text()).toBe("0 cloud projects");
    expect(wrapper.get('[data-testid="menu-project-empty-state"]').text()).toContain("No cloud projects loaded");
    expect(wrapper.get('[data-testid="menu-project-empty-state"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="menu-project-empty-state"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="menu-project-empty-state"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.get('[data-testid="menu-project-select"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="menu-load-projects-button"]').attributes("role")).toBe("menuitem");
    expect(wrapper.get('[data-testid="menu-project-select"]').attributes("role")).toBe("menuitem");
    expect(wrapper.get('[data-testid="menu-new-project-button"]').attributes("role")).toBe("menuitem");
    expect(wrapper.get('[data-testid="menu-demo-login-button"]').attributes("role")).toBe("menuitem");
    expect(wrapper.get('[data-testid="menu-project-select"] option').text()).toContain("Current: My Watch UI");
    expect(wrapper.get('[data-testid="menu-load-projects-button"]').attributes("aria-label")).toBe("Refresh cloud projects");
    expect(wrapper.get('[data-testid="menu-load-projects-button"]').attributes("title")).toBe("Refresh cloud projects");
    expect(wrapper.get('[data-testid="menu-new-project-button"]').attributes("aria-label")).toBe("Create cloud project");
    expect(wrapper.get('[data-testid="menu-new-project-button"]').attributes("title")).toBe("Create cloud project");
    expect(wrapper.find('[data-testid="menu-login-form"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="menu-login-email-input"]').attributes("aria-label")).toBe("Email for cloud login");
    expect(wrapper.get('[data-testid="menu-login-email-input"]').attributes("title")).toBe("Email for cloud login");
    expect(wrapper.get('[data-testid="menu-login-password-input"]').attributes("aria-label")).toBe("Password for cloud login");
    expect(wrapper.get('[data-testid="menu-login-password-input"]').attributes("title")).toBe("Password for cloud login");
    expect(wrapper.get('[data-testid="menu-login-button"]').attributes("aria-label")).toBe("Log in from project menu");
    expect(wrapper.get('[data-testid="menu-login-button"]').attributes("title")).toBe("Log in from project menu");
    expect(wrapper.get('[data-testid="menu-demo-login-button"]').attributes("aria-label")).toBe("Use demo account");
    expect(wrapper.get('[data-testid="menu-demo-login-button"]').attributes("title")).toBe("Use demo account");
  });

  it("closes the project menu after running its refresh command", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("click");
    expect(wrapper.find('[data-testid="toolbar-project-menu"]').exists()).toBe(true);
    const toolbarMenuButton = wrapper.get('[data-testid="toolbar-menu-button"]').element as HTMLButtonElement;

    await wrapper.get('[data-testid="menu-load-projects-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="toolbar-project-menu"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Sign in before loading cloud projects");
    expect(document.activeElement).toBe(toolbarMenuButton);
  });

  it("returns focus to the project menu button after opening a cloud project from the menu", async () => {
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
          JSON.stringify({ projects: [apiProject("project-2", "Factory Panel", openedDoc)] }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ project: apiProject("project-2", "Factory Panel", openedDoc) }), {
          status: 200
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ assets: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="load-projects-button"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("click");
    const toolbarMenuButton = wrapper.get('[data-testid="toolbar-menu-button"]').element as HTMLButtonElement;

    await wrapper.get('[data-testid="menu-project-select"]').setValue("project-2");
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="toolbar-project-menu"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Project opened");
    expect(document.activeElement).toBe(toolbarMenuButton);
  });

  it("returns focus to the project menu button after canceling cloud project creation from the menu", async () => {
    signInForCloudSaves();
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("click");
    const toolbarMenuButton = wrapper.get('[data-testid="toolbar-menu-button"]').element as HTMLButtonElement;
    await wrapper.get('[data-testid="menu-new-project-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="toolbar-project-menu"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="new-project-dialog"]').exists()).toBe(true);
    expect(document.activeElement).toBe(wrapper.get('[data-testid="new-project-name-input"]').element);

    await wrapper.get('[data-testid="cancel-new-project-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="new-project-dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(toolbarMenuButton);
    wrapper.unmount();
  });

  it("disables toolbar copy and delete actions for locked widgets", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="copy-widget-button"]').element).toHaveProperty("disabled", false);
    expect(wrapper.get('[data-testid="delete-widget-button"]').element).toHaveProperty("disabled", false);

    await wrapper.get('[data-testid="layer-lock-time-label"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="copy-widget-button"]').element).toHaveProperty("disabled", true);
    expect(wrapper.get('[data-testid="delete-widget-button"]').element).toHaveProperty("disabled", true);
  });

  it("deletes the selected widget from the toolbar action", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="canvas-widget-time-label"]').trigger("click");
    expect(wrapper.get('[data-testid="delete-widget-button"]').attributes("aria-label")).toBe("Delete Time_Label widget");
    expect(wrapper.get('[data-testid="delete-widget-button"]').attributes("title")).toBe("Delete Time_Label widget");
    await wrapper.get('[data-testid="delete-widget-button"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="canvas-widget-time-label"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="selector-input"]').exists()).toBe(false);
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

  it("coalesces repeated keyboard nudges into one undo entry per key session", async () => {
    const pinia = createPinia();
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia]
      }
    });
    const store = useProjectStore(pinia);

    await wrapper.get('[data-testid="canvas-widget-time-label"]').trigger("click");
    const historyBefore = store.historyEntries.length;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true }));
    await wrapper.vm.$nextTick();

    expect(store.historyEntries).toHaveLength(historyBefore);
    expect(store.selectedWidget?.layout).toMatchObject({ x: 152, y: 50 });

    document.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight" }));
    await wrapper.vm.$nextTick();

    expect(store.historyEntries).toHaveLength(historyBefore + 1);
    expect(store.historyEntries.at(-1)?.label).toBe("Move widget");

    store.undo();
    await wrapper.vm.$nextTick();

    expect(store.selectedWidget?.layout).toMatchObject({ x: 150, y: 40 });
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

  it("runs advertised file menu shortcuts for save, open and new project", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });
    await wrapper.vm.$nextTick();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true }));
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Project saved");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "o", metaKey: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Sign in before loading cloud projects");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "n", metaKey: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Sign in before creating cloud projects");
    expect(wrapper.find('[data-testid="new-project-dialog"]').exists()).toBe(false);
    wrapper.unmount();
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

  it("provides inline simulator refresh screenshot background and fullscreen controls", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });
    await flushPromises();
    const canvas = wrapper.get('[data-testid="simulator-canvas"]').element as HTMLCanvasElement & { requestFullscreen?: () => Promise<void> };
    vi.spyOn(canvas, "toDataURL").mockReturnValue("data:image/png;base64,simulator");
    const requestFullscreen = vi.fn(async () => undefined);
    canvas.requestFullscreen = requestFullscreen;
    const screenshotButton = wrapper.get('[data-testid="simulator-screenshot-button"]').element as HTMLButtonElement;

    expect(wrapper.get('[data-testid="simulator-refresh-button"]').attributes("title")).toBe("Refresh Screen_1 simulator");
    expect(wrapper.get('[data-testid="simulator-refresh-button"]').attributes("aria-label")).toBe("Refresh Screen_1 simulator");
    expect(wrapper.get('[data-testid="simulator-screenshot-button"]').attributes("title")).toBe("Capture Screen_1 simulator screenshot");
    expect(wrapper.get('[data-testid="simulator-screenshot-button"]').attributes("aria-label")).toBe("Capture Screen_1 simulator screenshot");
    expect(wrapper.get('[data-testid="simulator-background-button"]').attributes("aria-label")).toBe("Switch simulator to light background");
    expect(wrapper.get('[data-testid="simulator-background-button"]').attributes("title")).toBe("Switch simulator to light background");
    expect(wrapper.get('[data-testid="simulator-background-button"]').attributes("aria-pressed")).toBe("false");
    expect(wrapper.get('[data-testid="simulator-fullscreen-button"]').attributes("title")).toBe("Open Screen_1 simulator fullscreen");
    expect(wrapper.get('[data-testid="simulator-fullscreen-button"]').attributes("aria-label")).toBe("Open Screen_1 simulator fullscreen");
    expect(wrapper.get('[data-testid="simulator-runtime-kind"]').text()).toBe("Canvas fallback");
    expect(wrapper.get('[data-testid="simulator-runtime-kind"]').attributes("aria-label")).toBe("Simulator runtime: Canvas fallback");
    expect(wrapper.get('[data-testid="simulator-runtime-kind"]').attributes("title")).toBe("Simulator runtime: Canvas fallback");
    expect(wrapper.get('[data-testid="simulator-refresh-button"] svg').attributes("data-icon-name")).toBe("refresh");
    expect(wrapper.get('[data-testid="simulator-screenshot-button"] svg').attributes("data-icon-name")).toBe("camera");
    expect(wrapper.get('[data-testid="simulator-background-button"] svg').attributes("data-icon-name")).toBe("grid");
    expect(wrapper.get('[data-testid="simulator-fullscreen-button"] svg').attributes("data-icon-name")).toBe("fullscreen");
    expect(wrapper.get('[data-testid="simulator-message"]').attributes("role")).toBe("status");
    expect(wrapper.get('[data-testid="simulator-message"]').attributes("aria-live")).toBe("polite");
    expect(wrapper.get('[data-testid="simulator-message"]').attributes("aria-atomic")).toBe("true");
    expect(wrapper.get('[data-testid="simulator-status-ready"]').attributes("role")).toBe("img");
    expect(wrapper.get('[data-testid="simulator-status-ready"]').attributes("aria-label")).toBe("Simulator status: ready");
    expect(wrapper.get('[data-testid="simulator-status-ready"]').attributes("title")).toBe("Simulator status: ready");

    await wrapper.get('[data-testid="simulator-refresh-button"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Simulator refreshed");

    screenshotButton.focus();
    await wrapper.get('[data-testid="simulator-screenshot-button"]').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-testid="simulator-screenshot-link"]').attributes("href")).toBe("data:image/png;base64,simulator");
    expect(wrapper.get('[data-testid="simulator-screenshot-link"]').attributes("aria-label")).toBe("Download Screen_1 simulator screenshot");
    expect(wrapper.get('[data-testid="simulator-screenshot-link"]').attributes("title")).toBe("Download Screen_1 simulator screenshot");
    expect(wrapper.get('[data-testid="simulator-screenshot-link"] svg').attributes("data-icon-name")).toBe("download");
    expect(document.activeElement).toBe(wrapper.get('[data-testid="simulator-screenshot-link"]').element);
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Simulator screenshot ready");

    await wrapper.get('[data-testid="simulator-background-button"]').trigger("click");
    expect(wrapper.get('[data-testid="simulator-panel"]').classes()).toContain("simulator-bg-light");
    expect(wrapper.get('[data-testid="simulator-background-button"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="simulator-background-button"]').attributes("aria-label")).toBe("Switch simulator to dark background");
    expect(wrapper.get('[data-testid="simulator-background-button"]').attributes("title")).toBe("Switch simulator to dark background");

    await wrapper.get('[data-testid="simulator-fullscreen-button"]').trigger("click");
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Simulator fullscreen opened");
    wrapper.unmount();
  });

  it("logs unavailable feedback when simulator screenshot capture throws", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });
    await flushPromises();
    const canvas = wrapper.get('[data-testid="simulator-canvas"]').element as HTMLCanvasElement;
    vi.spyOn(canvas, "toDataURL").mockImplementation(() => {
      throw new Error("canvas is tainted");
    });

    await wrapper.get('[data-testid="simulator-screenshot-button"]').trigger("click");

    expect(wrapper.find('[data-testid="simulator-screenshot-link"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Simulator screenshot unavailable");

    wrapper.unmount();
  });

  it("collapses and resizes the bottom dock without losing the dock panels", async () => {
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="bottom-dock"]').classes()).not.toContain("collapsed");
    expect(wrapper.get('[data-testid="bottom-dock-collapse-button"]').attributes("aria-expanded")).toBe("true");
    expect(wrapper.get('[data-testid="bottom-dock-collapse-button"]').attributes("aria-label")).toBe("Collapse console simulator and build dock");
    expect(wrapper.get('[data-testid="bottom-dock-collapse-button"]').attributes("title")).toBe("Collapse console simulator and build dock");
    expect(wrapper.get('[data-testid="bottom-dock-resize-handle"]').attributes("aria-valuetext")).toBe("Bottom dock height 248 pixels");
    expect(wrapper.findAll('[data-testid="bottom-dock"] > .panel')).toHaveLength(3);

    await wrapper.get('[data-testid="bottom-dock-collapse-button"]').trigger("click");
    expect(wrapper.get('[data-testid="bottom-dock"]').classes()).toContain("collapsed");
    expect(wrapper.get('[data-testid="bottom-dock-collapse-button"]').attributes("aria-expanded")).toBe("false");
    expect(wrapper.get('[data-testid="bottom-dock-collapse-button"]').attributes("aria-label")).toBe("Expand console simulator and build dock");
    expect(wrapper.get('[data-testid="bottom-dock-collapse-button"]').attributes("title")).toBe("Expand console simulator and build dock");
    expect(wrapper.get('[data-testid="bottom-dock-collapse-button"] svg').attributes("data-icon-name")).toBe("arrowUp");

    await wrapper.get('[data-testid="bottom-dock-collapse-button"]').trigger("click");
    expect(wrapper.get('[data-testid="bottom-dock"]').classes()).not.toContain("collapsed");
    expect(wrapper.get('[data-testid="bottom-dock-collapse-button"]').attributes("aria-expanded")).toBe("true");

    await wrapper.get('[data-testid="bottom-dock-resize-handle"]').trigger("mousedown", {
      clientY: 700,
      preventDefault: vi.fn()
    });
    document.dispatchEvent(new MouseEvent("mousemove", { clientY: 640 }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="bottom-dock"]').attributes("style")).toContain("--bottom-dock-height: 308px");
    expect(wrapper.get('[data-testid="bottom-dock-resize-handle"]').attributes("tabindex")).toBe("0");
    expect(wrapper.get('[data-testid="bottom-dock-resize-handle"]').attributes("aria-valuemin")).toBe("180");
    expect(wrapper.get('[data-testid="bottom-dock-resize-handle"]').attributes("aria-valuemax")).toBe("420");
    expect(wrapper.get('[data-testid="bottom-dock-resize-handle"]').attributes("aria-valuenow")).toBe("308");
    expect(wrapper.get('[data-testid="bottom-dock-resize-handle"]').attributes("aria-valuetext")).toBe("Bottom dock height 308 pixels");
    expect(wrapper.get('[data-testid="bottom-dock-resize-handle"]').attributes("title")).toBe("Resize bottom dock");

    await wrapper.get('[data-testid="bottom-dock-resize-handle"]').trigger("keydown", { key: "ArrowUp", preventDefault: vi.fn() });
    expect(wrapper.get('[data-testid="bottom-dock"]').attributes("style")).toContain("--bottom-dock-height: 324px");
    expect(wrapper.get('[data-testid="bottom-dock-resize-handle"]').attributes("aria-valuenow")).toBe("324");
    expect(wrapper.get('[data-testid="bottom-dock-resize-handle"]').attributes("aria-valuetext")).toBe("Bottom dock height 324 pixels");

    await wrapper.get('[data-testid="bottom-dock-resize-handle"]').trigger("keydown", { key: "Home", preventDefault: vi.fn() });
    expect(wrapper.get('[data-testid="bottom-dock"]').attributes("style")).toContain("--bottom-dock-height: 180px");
    expect(wrapper.get('[data-testid="bottom-dock-resize-handle"]').attributes("aria-valuenow")).toBe("180");

    await wrapper.get('[data-testid="bottom-dock-resize-handle"]').trigger("keydown", { key: "End", preventDefault: vi.fn() });
    expect(wrapper.get('[data-testid="bottom-dock"]').attributes("style")).toContain("--bottom-dock-height: 420px");
    expect(wrapper.get('[data-testid="bottom-dock-resize-handle"]').attributes("aria-valuenow")).toBe("420");
    wrapper.unmount();
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
    expect(wrapper.get('[data-testid="simulator-toggle-button"]').attributes("aria-label")).toBe("Hide simulator");
    expect(wrapper.get('[data-testid="simulator-toggle-button"]').attributes("title")).toBe("Hide simulator");

    await wrapper.get('[data-testid="simulator-toggle-button"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="simulator-canvas"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="simulator-toggle-button"]').attributes("aria-pressed")).toBe("false");
    expect(wrapper.get('[data-testid="simulator-toggle-button"]').attributes("aria-label")).toBe("Show simulator");
    expect(wrapper.get('[data-testid="simulator-toggle-button"]').attributes("title")).toBe("Show simulator");

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

  it("relocalizes simulator status messages after switching locale", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="simulator-message"]').text()).toBe("Preview updated");

    await wrapper.get('[data-testid="locale-select"]').setValue("zh-CN");
    await wrapper.vm.$nextTick();

    expect(wrapper.get('[data-testid="simulator-message"]').text()).toBe("预览已更新");
    expect(wrapper.get('[data-testid="simulator-runtime-kind"]').attributes("title")).toBe("模拟器运行时：画布回退");
  });

  it("shows a missing preview placeholder for image assets without preview content", async () => {
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
      assets: [{
        id: "missing-asset",
        projectId: "project-broken",
        name: "missing.png",
        kind: "image",
        mimeType: "image/png",
        width: 96,
        height: 96,
        sizeBytes: 128,
        objectKey: "projects/project-broken/assets/missing-asset/missing.png",
        createdAt: "2026-05-08T00:00:00Z"
      }],
      styles: [],
      events: [],
      updatedAt: "2026-05-08T00:00:00Z"
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ project: apiProject("project-broken", "Broken Image UI", brokenDoc) }), {
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

    expect(wrapper.text()).toContain("Missing preview missing.png");
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
        new Response(JSON.stringify({ project: apiProject("project-2", "Factory Panel", returnedDoc) }), { status: 201 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ assets: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    const newProjectButton = wrapper.get('[data-testid="new-project-button"]').element as HTMLButtonElement;
    newProjectButton.focus();
    await wrapper.get('[data-testid="new-project-button"]').trigger("click");
    const newProjectDialog = wrapper.get('[data-testid="new-project-dialog"]');
    expect(newProjectDialog.text()).toContain("Create cloud project");
    expect(newProjectDialog.attributes("role")).toBe("dialog");
    expect(newProjectDialog.attributes("aria-modal")).toBe("true");
    expect(newProjectDialog.attributes("aria-labelledby")).toBe("new-project-dialog-title");
    expect(newProjectDialog.attributes("aria-describedby")).toBe("new-project-dialog-description");
    expect(wrapper.get("#new-project-dialog-title").text()).toBe("Create cloud project");
    expect(wrapper.get("#new-project-dialog-description").text()).toContain("Name the LVGL project");
    expect(document.activeElement).toBe(wrapper.get('[data-testid="new-project-name-input"]').element);
    expect(wrapper.get('[data-testid="new-project-name-input"]').attributes("aria-label")).toBe("Cloud project name");
    expect(wrapper.get('[data-testid="new-project-name-input"]').attributes("title")).toBe("Cloud project name");
    expect(wrapper.get('[data-testid="cancel-new-project-button"]').attributes("type")).toBe("button");
    expect(wrapper.get('[data-testid="cancel-new-project-button"]').attributes("aria-label")).toBe("Cancel creating cloud project");
    expect(wrapper.get('[data-testid="cancel-new-project-button"]').attributes("title")).toBe("Cancel creating cloud project");
    expect(wrapper.get('[data-testid="confirm-new-project-button"]').attributes("type")).toBe("submit");
    expect(wrapper.get('[data-testid="confirm-new-project-button"]').attributes("aria-label")).toBe("Create Untitled LVGL UI cloud project");
    expect(wrapper.get('[data-testid="confirm-new-project-button"]').attributes("title")).toBe("Create Untitled LVGL UI cloud project");
    await wrapper.get('[data-testid="new-project-name-input"]').setValue("   ");
    expect(wrapper.get('[data-testid="confirm-new-project-button"]').attributes("aria-label")).toBe("Create cloud project");
    expect(wrapper.get('[data-testid="confirm-new-project-button"]').attributes("title")).toBe("Create cloud project");
    await wrapper.get('[data-testid="confirm-new-project-button"]').trigger("submit");
    await wrapper.vm.$nextTick();
    const newProjectNameInput = wrapper.get('[data-testid="new-project-name-input"]');
    const newProjectNameError = wrapper.get('[data-testid="new-project-name-error"]');
    expect(newProjectNameInput.attributes("aria-invalid")).toBe("true");
    expect(newProjectNameInput.attributes("aria-describedby")).toBe("new-project-name-error");
    expect(newProjectNameError.attributes("id")).toBe("new-project-name-error");
    expect(newProjectNameError.attributes("role")).toBe("alert");

    await wrapper.get('[data-testid="new-project-name-input"]').setValue("Factory Panel");

    expect(wrapper.find('[data-testid="new-project-name-error"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="new-project-name-input"]').attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.get('[data-testid="new-project-name-input"]').attributes("aria-describedby")).toBeUndefined();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="new-project-dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(newProjectButton);

    await wrapper.get('[data-testid="new-project-button"]').trigger("click");
    await wrapper.get('[data-testid="new-project-dialog"]').trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="new-project-dialog"]').exists()).toBe(false);

    await wrapper.get('[data-testid="new-project-button"]').trigger("click");
    await wrapper.get('[data-testid="new-project-name-input"]').setValue("Factory Panel");
    expect(wrapper.get('[data-testid="confirm-new-project-button"]').attributes("aria-label")).toBe("Create Factory Panel cloud project");
    expect(wrapper.get('[data-testid="confirm-new-project-button"]').attributes("title")).toBe("Create Factory Panel cloud project");
    await wrapper.get('[data-testid="confirm-new-project-button"]').trigger("submit");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/projects", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).name).toBe("Factory Panel");
    expect(wrapper.text()).toContain("Factory Panel");
    expect(wrapper.find('[data-testid="new-project-dialog"]').exists()).toBe(false);
  });

  it("keeps Tab navigation inside the new cloud project dialog", async () => {
    signInForCloudSaves();
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="new-project-button"]').trigger("click");
    await wrapper.vm.$nextTick();
    const nameInput = wrapper.get('[data-testid="new-project-name-input"]').element as HTMLInputElement;
    const confirmButton = wrapper.get('[data-testid="confirm-new-project-button"]').element as HTMLButtonElement;
    confirmButton.focus();

    await wrapper.get('[data-testid="confirm-new-project-button"]').trigger("keydown", { key: "Tab" });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(nameInput);

    await wrapper.get('[data-testid="new-project-name-input"]').trigger("keydown", { key: "Tab", shiftKey: true });
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(confirmButton);
    wrapper.unmount();
  });

  it("blocks command shortcuts from leaking out of the new cloud project dialog input", async () => {
    signInForCloudSaves();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      attachTo: document.body,
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="new-project-button"]').trigger("click");
    await wrapper.vm.$nextTick();
    const nameInput = wrapper.get('[data-testid="new-project-name-input"]').element as HTMLInputElement;
    nameInput.focus();
    const saveEvent = new KeyboardEvent("keydown", { key: "s", metaKey: true, cancelable: true });
    nameInput.dispatchEvent(saveEvent);
    await wrapper.vm.$nextTick();

    expect(saveEvent.defaultPrevented).toBe(true);
    expect(wrapper.find('[data-testid="new-project-dialog"]').exists()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(nameInput);
    wrapper.unmount();
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

    const cloudProjectListOrCreateCalls = fetchMock.mock.calls.filter(([url]) => url === "/api/projects");
    expect(cloudProjectListOrCreateCalls).toHaveLength(0);
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
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token: "user-token",
          user: { id: "user-demo", email: "demo@hiveton.dev", displayName: "Hiveton Demo" }
        }),
        { status: 200 }
      )
    )
      .mockResolvedValueOnce(projectCreateResponse())
      .mockResolvedValueOnce(projectSaveResponse());
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.get('[data-testid="login-email-input"]').attributes("aria-label")).toBe("Email");
    expect(wrapper.get('[data-testid="login-email-input"]').attributes("title")).toBe("Email");
    expect(wrapper.get('[data-testid="login-email-input"]').attributes("placeholder")).toBe("Email");
    expect(wrapper.get('[data-testid="login-password-input"]').attributes("aria-label")).toBe("Password");
    expect(wrapper.get('[data-testid="login-password-input"]').attributes("title")).toBe("Password");
    expect(wrapper.get('[data-testid="login-password-input"]').attributes("placeholder")).toBe("Password");
    expect(wrapper.get('[data-testid="login-button"]').attributes("aria-label")).toBe("Log in");
    expect(wrapper.get('[data-testid="login-button"]').attributes("title")).toBe("Log in");
    expect(wrapper.get('[data-testid="demo-login-button"]').attributes("aria-label")).toBe("Use demo account");
    expect(wrapper.get('[data-testid="demo-login-button"]').attributes("title")).toBe("Use demo account");

    await wrapper.get('[data-testid="login-email-input"]').setValue("demo@hiveton.dev");
    await wrapper.get('[data-testid="login-password-input"]').setValue("password");
    await wrapper.get('[data-testid="login-button"]').trigger("submit");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "demo@hiveton.dev", password: "password" })
    }));
    expect(wrapper.text()).toContain("Hiveton Demo");
    expect(wrapper.get('[data-testid="logout-button"]').attributes("aria-label")).toBe("Logout");
    expect(wrapper.get('[data-testid="logout-button"]').attributes("title")).toBe("Logout");
    expect(wrapper.get('[data-testid="logout-button"] svg').attributes("data-icon-name")).toBe("logout");
    expect(wrapper.get('[data-testid="logout-button"]').text()).toBe("");

    await wrapper.get('[data-testid="save-project-button"]').trigger("click");
    await wrapper.get('[data-testid="logout-button"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="current-user"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="login-button"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="persistence-status"]').text()).toBe("Local project");
    expect(wrapper.get('[data-testid="status-activity"]').text()).toBe("Signed out; local editing remains");
  });

  it("shows login failures next to the toolbar login form", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "INVALID_CREDENTIALS", message: "invalid credentials" }
        }),
        { status: 401 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="login-email-input"]').setValue("demo@hiveton.dev");
    await wrapper.get('[data-testid="login-password-input"]').setValue("wrong-password");
    await wrapper.get('[data-testid="login-button"]').trigger("submit");
    await flushPromises();

    expect(wrapper.find('[data-testid="current-user"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="login-error"]').text()).toBe("Invalid email or password");
    expect(wrapper.get('[data-testid="login-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="login-error"]').attributes("id")).toBe("toolbar-login-error");
    expect(wrapper.get('[data-testid="login-email-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="login-email-input"]').attributes("aria-describedby")).toBe("toolbar-login-error");
    expect(wrapper.get('[data-testid="login-password-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="login-password-input"]').attributes("aria-describedby")).toBe("toolbar-login-error");
    expect(wrapper.text()).toContain("Login failed: Invalid email or password");

    await wrapper.get('[data-testid="login-password-input"]').setValue("password");

    expect(wrapper.find('[data-testid="login-error"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="login-email-input"]').attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.get('[data-testid="login-email-input"]').attributes("aria-describedby")).toBeUndefined();
    expect(wrapper.get('[data-testid="login-password-input"]').attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.get('[data-testid="login-password-input"]').attributes("aria-describedby")).toBeUndefined();
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
              apiProject("project-watch-demo", "My Watch UI", apiProjectDoc("project-watch-demo", "My Watch UI")),
              apiProject("project-same-name", "My Watch UI", apiProjectDoc("project-same-name", "My Watch UI")),
              apiProject("project-2", "Factory Panel", openedDoc)
            ]
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ project: apiProject("project-2", "Factory Panel", openedDoc) }), {
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
    expect(wrapper.get('[data-testid="project-select"]').attributes("aria-label")).toBe("Open cloud project");
    expect(wrapper.get('[data-testid="project-select"]').attributes("title")).toBe("Open cloud project");
    const options = wrapper.findAll('[data-testid="project-select"] option').map((option) => option.text());
    expect(options).toEqual(["My Watch UI (tch-demo)", "My Watch UI (ame-name)", "Factory Panel"]);
    await wrapper.get('[data-testid="toolbar-menu-button"]').trigger("click");
    expect(wrapper.get('[data-testid="menu-project-count"]').text()).toBe("2 cloud projects");
    expect(wrapper.get('[data-testid="menu-project-select"]').attributes("disabled")).toBeUndefined();
    expect(wrapper.find('[data-testid="menu-project-empty-state"]').exists()).toBe(false);
    await wrapper.get('[data-testid="project-select"]').setValue("project-2");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/projects", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-2", expect.any(Object));
    expect(wrapper.text()).toContain("Factory Panel");
  });

  it("does not load assets for a stale cloud project open request", async () => {
    signInForCloudSaves();
    let resolveProjectOne: (response: Response) => void = () => undefined;
    let resolveProjectTwo: (response: Response) => void = () => undefined;
    const projectOneResponse = new Promise<Response>((resolve) => {
      resolveProjectOne = resolve;
    });
    const projectTwoResponse = new Promise<Response>((resolve) => {
      resolveProjectTwo = resolve;
    });
    const projectOneDoc = apiProjectDoc("project-1", "Project One");
    const projectTwoDoc = apiProjectDoc("project-2", "Project Two");
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/projects") {
        return Promise.resolve(new Response(JSON.stringify({
          projects: [
            apiProject("project-1", "Project One", projectOneDoc),
            apiProject("project-2", "Project Two", projectTwoDoc)
          ]
        }), { status: 200 }));
      }
      if (url === "/api/projects/project-1") {
        return projectOneResponse;
      }
      if (url === "/api/projects/project-2") {
        return projectTwoResponse;
      }
      if (url === "/api/projects/project-1/assets" || url === "/api/projects/project-2/assets") {
        return Promise.resolve(new Response(JSON.stringify({ assets: [] }), { status: 200 }));
      }
      return Promise.reject(new Error(`unexpected request ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="load-projects-button"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-testid="project-select"]').setValue("project-1");
    await flushPromises();
    await wrapper.get('[data-testid="project-select"]').setValue("project-2");
    await flushPromises();

    resolveProjectTwo(new Response(JSON.stringify({
      project: apiProject("project-2", "Project Two", projectTwoDoc)
    }), { status: 200 }));
    await flushPromises();
    resolveProjectOne(new Response(JSON.stringify({
      project: apiProject("project-1", "Project One", projectOneDoc)
    }), { status: 200 }));
    await flushPromises();

    expect(wrapper.text()).toContain("Project Two");
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/projects/project-2/assets")).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/projects/project-1/assets")).toBe(false);
  });

  it("hides widgets from canvas and locks layout edits from the layers panel", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    expect(wrapper.find('[data-testid="canvas-widget-date-label"]').exists()).toBe(true);

    await wrapper.get('[data-testid="layer-row-date-label"]').trigger("click");
    expect(wrapper.find('[data-testid="layer-state-date-label"] button').exists()).toBe(false);
    expect(wrapper.get('[data-testid="layer-hide-date-label"]').attributes("title")).toBe("Hide Date_Label layer");
    expect(wrapper.get('[data-testid="layer-hide-date-label"]').attributes("aria-label")).toBe("Hide Date_Label layer");
    await wrapper.get('[data-testid="layer-hide-date-label"]').trigger("click");
    expect(wrapper.find('[data-testid="canvas-widget-date-label"]').exists()).toBe(false);
    expect((wrapper.get('[data-testid="layer-name-date-label"]').element as HTMLInputElement).value).toBe("Date_Label");
    expect(wrapper.get('[data-testid="layer-state-date-label"]').text()).toContain("Hidden");
    expect(wrapper.get('[data-testid="layer-hide-date-label"]').attributes("title")).toBe("Show Date_Label layer");
    expect(wrapper.get('[data-testid="layer-hide-date-label"]').attributes("aria-label")).toBe("Show Date_Label layer");

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
    expect(wrapper.get('[data-testid="add-event-button"]').attributes("aria-label")).toBe("Unlock Date_Label to add events");
    expect(wrapper.get('[data-testid="add-event-button"]').attributes("title")).toBe("Unlock Date_Label to add events");

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
    expect(wrapper.get('[data-testid="target-device-name-input"]').attributes("aria-label")).toBe("Target device name");
    expect(wrapper.get('[data-testid="target-device-name-input"]').attributes("title")).toBe("Target device name");
    expect(wrapper.get('[data-testid="target-lvgl-version-select"]').attributes("aria-label")).toBe("Target LVGL version");
    expect(wrapper.get('[data-testid="target-lvgl-version-select"]').attributes("title")).toBe("Target LVGL version");
    expect(wrapper.get('[data-testid="target-width-input"]').attributes("type")).toBe("number");
    expect(wrapper.get('[data-testid="target-width-input"]').attributes("aria-label")).toBe("Target width");
    expect(wrapper.get('[data-testid="target-width-input"]').attributes("title")).toBe("Target width");
    expect(wrapper.get('[data-testid="target-width-input"]').attributes("min")).toBe("1");
    expect(wrapper.get('[data-testid="target-height-input"]').attributes("aria-label")).toBe("Target height");
    expect(wrapper.get('[data-testid="target-height-input"]').attributes("title")).toBe("Target height");
    expect(wrapper.get('[data-testid="target-dpi-input"]').attributes("type")).toBe("number");
    expect(wrapper.get('[data-testid="target-dpi-input"]').attributes("aria-label")).toBe("Target DPI");
    expect(wrapper.get('[data-testid="target-dpi-input"]').attributes("title")).toBe("Target DPI");
    expect(wrapper.get('[data-testid="target-color-depth-select"]').attributes("aria-label")).toBe("Target color depth");
    expect(wrapper.get('[data-testid="target-color-depth-select"]').attributes("title")).toBe("Target color depth");
    await wrapper.get('[data-testid="target-device-name-input"]').setValue("STM32-HMI");
    await wrapper.get('[data-testid="target-lvgl-version-select"]').setValue("8.3");
    await wrapper.get('[data-testid="target-width-input"]').setValue("320");
    await wrapper.get('[data-testid="target-height-input"]').setValue("240");
    await wrapper.get('[data-testid="target-dpi-input"]').setValue("160");
    await wrapper.get('[data-testid="target-color-depth-select"]').setValue("32");
    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();

    expect(wrapper.text()).toContain("STM32-HMI (320x240)");
    expect(wrapper.get('[data-testid="target-summary-card"]').text()).toContain("STM32-HMI");
    expect(wrapper.get('[data-testid="target-summary-card"]').text()).toContain("320 x 240 · 160 DPI · 32-bit");
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

    expect(wrapper.get('[data-testid="target-width-error"]').text()).toBe("Width must be greater than 0");
    expect(wrapper.get('[data-testid="target-width-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="target-width-error"]').attributes("id")).toBe("target-width-error");
    expect(wrapper.get('[data-testid="target-width-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="target-width-input"]').attributes("aria-describedby")).toBe("target-width-error");
    expect(store.project.target.width).toBe(480);

    await wrapper.get('[data-testid="target-width-input"]').setValue("320");
    expect(wrapper.find('[data-testid="target-width-error"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="target-width-input"]').attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.get('[data-testid="target-width-input"]').attributes("aria-describedby")).toBeUndefined();
    expect(store.project.target.width).toBe(320);

    const canvasTargetButton = wrapper.get('[data-testid="canvas-target-settings-button"]');
    expect(canvasTargetButton.attributes("type")).toBe("button");
    expect(canvasTargetButton.attributes("aria-label")).toBe("Open target settings for 320 x 480");
    expect(canvasTargetButton.attributes("title")).toBe("Open target settings for 320 x 480");

    await canvasTargetButton.trigger("click");
    expect(wrapper.get('[data-testid="settings-project-name-input"]').attributes("aria-label")).toBe("Project name");
    expect(wrapper.get('[data-testid="settings-project-name-input"]').attributes("title")).toBe("Project name");
    expect(wrapper.get('[data-testid="settings-target-device-name-input"]').attributes("aria-label")).toBe("Target device name");
    expect(wrapper.get('[data-testid="settings-target-lvgl-version-select"]').attributes("aria-label")).toBe("Target LVGL version");
    expect(wrapper.get('[data-testid="settings-target-width-input"]').attributes("type")).toBe("number");
    expect(wrapper.get('[data-testid="settings-target-width-input"]').attributes("aria-label")).toBe("Target width");
    expect(wrapper.get('[data-testid="settings-target-width-input"]').attributes("min")).toBe("1");
    expect(wrapper.get('[data-testid="settings-target-height-input"]').attributes("aria-label")).toBe("Target height");
    expect(wrapper.get('[data-testid="settings-target-dpi-input"]').attributes("type")).toBe("number");
    expect(wrapper.get('[data-testid="settings-target-dpi-input"]').attributes("aria-label")).toBe("Target DPI");
    expect(wrapper.get('[data-testid="settings-target-color-depth-select"]').attributes("aria-label")).toBe("Target color depth");
    expect(wrapper.get('[data-testid="settings-theme-select"]').attributes("aria-label")).toBe("Project theme");
    await wrapper.get('[data-testid="settings-target-height-input"]').setValue("-1");
    await wrapper.get('[data-testid="settings-target-dpi-input"]').setValue("0");

    expect(wrapper.get('[data-testid="settings-target-height-error"]').text()).toBe("Height must be greater than 0");
    expect(wrapper.get('[data-testid="settings-target-dpi-error"]').text()).toBe("DPI must be greater than 0");
    expect(wrapper.get('[data-testid="settings-target-height-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="settings-target-dpi-error"]').attributes("role")).toBe("alert");
    expect(wrapper.get('[data-testid="settings-target-height-error"]').attributes("id")).toBe("settings-target-height-error");
    expect(wrapper.get('[data-testid="settings-target-dpi-error"]').attributes("id")).toBe("settings-target-dpi-error");
    expect(wrapper.get('[data-testid="settings-target-height-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="settings-target-dpi-input"]').attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-testid="settings-target-height-input"]').attributes("aria-describedby")).toBe("settings-target-height-error");
    expect(wrapper.get('[data-testid="settings-target-dpi-input"]').attributes("aria-describedby")).toBe("settings-target-dpi-error");
    expect(store.project.target.height).toBe(480);
    expect(store.project.target.dpi).toBe(240);

    await wrapper.get('[data-testid="target-width-input"]').setValue("320.5");
    await wrapper.get('[data-testid="settings-target-dpi-input"]').setValue("160.5");

    expect(wrapper.get('[data-testid="target-width-error"]').text()).toBe("Width must be an integer");
    expect(wrapper.get('[data-testid="settings-target-dpi-error"]').text()).toBe("DPI must be an integer");
    expect(store.project.target.width).toBe(320);
    expect(store.project.target.dpi).toBe(240);
  });

  it("lets project settings create edit and apply reusable styles", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });
    const store = useProjectStore();

    await wrapper.get('[data-testid="settings-nav-button"]').trigger("click");

    expect(wrapper.get('[data-testid="project-styles-empty"]').text()).toBe("No reusable styles yet.");
    await wrapper.get('[data-testid="add-project-style-button"]').trigger("click");

    const styleId = store.project.styles[0]?.id;
    expect(styleId).toBeTruthy();
    expect(wrapper.get('[data-testid="project-style-name-input"]').attributes("aria-label")).toBe("Reusable style name");
    expect((wrapper.get('[data-testid="project-style-name-input"]').element as HTMLInputElement).value).toBe("Style_1");

    await wrapper.get('[data-testid="project-style-name-input"]').setValue("Primary Metric");
    const initialProjectStyleBg = store.project.styles[0]?.style.bgColor;
    await wrapper.get('[data-testid="project-style-bg-color-input"]').setValue("red");
    expect(store.project.styles[0]?.style.bgColor).toBe(initialProjectStyleBg);
    expect(wrapper.get('[data-testid="project-style-bg-color-error"]').text()).toBe("Background color must be a 3 or 6 digit hex color");
    expect(wrapper.get('[data-testid="project-style-bg-color-input"]').attributes("aria-invalid")).toBe("true");

    await wrapper.get('[data-testid="project-style-bg-color-input"]').setValue("#123456");
    expect(wrapper.find('[data-testid="project-style-bg-color-error"]').exists()).toBe(false);
    await wrapper.get('[data-testid="project-style-text-color-input"]').setValue("#F8FAFC");
    await wrapper.get('[data-testid="project-style-border-color-input"]').setValue("#C084FC");
    await wrapper.get('[data-testid="project-style-font-select"]').setValue("lv_font_montserrat_32");
    await wrapper.get('[data-testid="project-style-align-select"]').setValue("right");
    await wrapper.get('[data-testid="project-style-radius-input"]').setValue("-1");
    expect(store.project.styles[0]?.style.radius).not.toBe(-1);
    expect(wrapper.get('[data-testid="project-style-radius-error"]').text()).toBe("Radius must be non-negative");
    expect(wrapper.get('[data-testid="project-style-radius-input"]').attributes("aria-invalid")).toBe("true");

    await wrapper.get('[data-testid="project-style-radius-input"]').setValue("16");
    expect(wrapper.find('[data-testid="project-style-radius-error"]').exists()).toBe(false);
    await wrapper.get('[data-testid="project-style-opacity-input"]').setValue("120");
    expect(store.project.styles[0]?.style.opacity).not.toBe(120);
    expect(wrapper.get('[data-testid="project-style-opacity-error"]').text()).toBe("Opacity must be between 0 and 100");
    expect(wrapper.get('[data-testid="project-style-opacity-input"]').attributes("aria-invalid")).toBe("true");

    await wrapper.get('[data-testid="project-style-opacity-input"]').setValue("80");
    expect(wrapper.find('[data-testid="project-style-opacity-error"]').exists()).toBe(false);
    await wrapper.get('[data-testid="project-style-letter-space-input"]').setValue("-2");
    expect(store.project.styles[0]?.style.letterSpace).not.toBe(-2);
    expect(wrapper.get('[data-testid="project-style-letter-space-error"]').text()).toBe("Letter Space must be non-negative");
    expect(wrapper.get('[data-testid="project-style-letter-space-input"]').attributes("aria-invalid")).toBe("true");

    await wrapper.get('[data-testid="project-style-letter-space-input"]').setValue("2");
    expect(wrapper.find('[data-testid="project-style-letter-space-error"]').exists()).toBe(false);
    await wrapper.get('[data-testid="project-style-line-space-input"]').setValue("-4");
    expect(store.project.styles[0]?.style.lineSpace).not.toBe(-4);
    expect(wrapper.get('[data-testid="project-style-line-space-error"]').text()).toBe("Line Space must be non-negative");
    expect(wrapper.get('[data-testid="project-style-line-space-input"]').attributes("aria-invalid")).toBe("true");

    await wrapper.get('[data-testid="project-style-line-space-input"]').setValue("4");
    expect(wrapper.find('[data-testid="project-style-line-space-error"]').exists()).toBe(false);
    await wrapper.get('[data-testid="project-style-padding-top-input"]').setValue("-6");
    expect(store.project.styles[0]?.style.padding?.top).not.toBe(-6);
    expect(wrapper.get('[data-testid="project-style-padding-top-error"]').text()).toBe("Padding Top must be non-negative");
    expect(wrapper.get('[data-testid="project-style-padding-top-input"]').attributes("aria-invalid")).toBe("true");

    await wrapper.get('[data-testid="project-style-padding-top-input"]').setValue("6");
    expect(wrapper.find('[data-testid="project-style-padding-top-error"]').exists()).toBe(false);
    await wrapper.get('[data-testid="project-style-padding-right-input"]').setValue("8");
    await wrapper.get('[data-testid="project-style-padding-bottom-input"]').setValue("10");
    await wrapper.get('[data-testid="project-style-padding-left-input"]').setValue("12");
    await wrapper.get('[data-testid="apply-project-style-button"]').trigger("click");

    expect(store.project.styles[0]).toMatchObject({
      name: "Primary Metric",
      style: {
        bgColor: "#123456",
        textColor: "#F8FAFC",
        borderColor: "#C084FC",
        font: "lv_font_montserrat_32",
        align: "right",
        opacity: 80,
        radius: 16,
        letterSpace: 2,
        lineSpace: 4,
        padding: { top: 6, right: 8, bottom: 10, left: 12 }
      }
    });
    expect(store.selectedWidget?.style).toMatchObject({
      bgColor: "#123456",
      textColor: "#F8FAFC",
      borderColor: "#C084FC",
      font: "lv_font_montserrat_32",
      align: "right",
      opacity: 80,
      radius: 16,
      letterSpace: 2,
      lineSpace: 4,
      padding: { top: 6, right: 8, bottom: 10, left: 12 }
    });
    await wrapper.get('[data-testid="settings-back-to-canvas-button"]').trigger("click");
    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("style")).toContain("font-size: 32px");
    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("style")).toContain("text-align: right");
    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("style")).toContain("letter-spacing: 2px");
    expect(wrapper.get('[data-testid="canvas-widget-time-label"]').attributes("style")).toContain("padding: 6px 8px 10px 12px");

    await wrapper.get('[data-testid="settings-nav-button"]').trigger("click");
    await wrapper.get('[data-testid="delete-project-style-button"]').trigger("click");
    expect(store.project.styles).toHaveLength(0);
    expect(wrapper.get('[data-testid="project-styles-empty"]').text()).toBe("No reusable styles yet.");
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

    expect(wrapper.get('[data-testid="target-device-name-error"]').text()).toBe("Device name is required");
    expect(store.project.target.deviceName).toBe("ESP32-S3");

    await wrapper.get('[data-testid="target-device-name-input"]').setValue("STM32-HMI");
    expect(wrapper.find('[data-testid="target-device-name-error"]').exists()).toBe(false);
    expect(store.project.target.deviceName).toBe("STM32-HMI");

    await wrapper.get('[data-testid="canvas-target-settings-button"]').trigger("click");
    await wrapper.get('[data-testid="settings-target-device-name-input"]').setValue("");

    expect(wrapper.get('[data-testid="settings-target-device-name-error"]').text()).toBe("Device name is required");
    expect(store.project.target.deviceName).toBe("STM32-HMI");
  });

  it("shows Chinese inspector and target validation errors", async () => {
    const wrapper = mount(EditorShell, {
      global: {
        plugins: [createPinia()]
      }
    });

    await wrapper.get('[data-testid="locale-select"]').setValue("zh-CN");
    await wrapper.get('[data-testid="inspector-layout-tab"]').trigger("click");
    await wrapper.get('[data-testid="layout-width-input"]').setValue("0");
    await wrapper.get('[data-testid="target-device-name-input"]').setValue("   ");

    expect(wrapper.get('[data-testid="layout-width-error"]').text()).toBe("宽度必须大于 0");
    expect(wrapper.get('[data-testid="target-device-name-error"]').text()).toBe("设备名称不能为空");

    await wrapper.get('[data-testid="widget-card-chart"]').trigger("click");
    await wrapper.get('[data-testid="inspector-style-tab"]').trigger("click");
    await wrapper.get('[data-testid="prop-values-input"]').setValue("1, nope");

    expect(wrapper.get('[data-testid="prop-values-error"]').text()).toBe("数值必须使用逗号、空格或换行分隔，且全部为数字");
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
