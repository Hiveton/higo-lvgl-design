import { expect, test, type Page } from "@playwright/test";
import { createDefaultProjectDoc } from "@hiveton-lvgl/schema";

const visualViewports = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];

const apiTimestamp = "2026-05-08T00:00:00Z";

function apiProjectDoc(id: string, name: string) {
  return createDefaultProjectDoc({
    id,
    name,
    updatedAt: apiTimestamp
  });
}

function rgbChannel(value: string, index: number): number {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) {
    throw new Error(`Expected rgb color, got ${value}`);
  }
  return Number(match[1].split(",")[index].trim());
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

for (const viewport of visualViewports) {
  test(`editor visual acceptance at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.getByText("LVGL Online Editor")).toBeVisible();
    await expect(page.getByTestId("artboard")).toBeVisible();
    await expect(page.getByTestId("simulator-canvas")).toBeVisible();
    await expect(page.getByTestId("resize-handle-time-label")).toBeVisible();
    await expect(page.getByTestId("simulator-canvas")).toHaveAttribute("data-lvgl-screen", "Screen_1");
    await expect.poll(async () => page.getByTestId("simulator-canvas").getAttribute("data-lvgl-widgets"))
      .toContain("Time_Label");
    await expectSimulatorPreviewUsesDockSpace(page);

    await expectNoHorizontalOverflow(page);
    await expectToolbarFitsDesignHeader(page);
    await expectPanelsDoNotOverlap(page);
    await expectScreenListUsesTableColumns(page);
    await expectActiveScreenRenameIsUsable(page);
    await expectLayerListUsesToolColumns(page);
    await expectInspectorInputsFit(page);
    await expectWidgetPaletteCardsUseConsistentGrid(page);
    await expectBottomDockPanelsAreDistinct(page);
    await expectConsoleLogUsesTableColumns(page);
    await expectTimelineUsesTableColumns(page);
    await expectResourceListHasOwnViewport(page);
  });
}

test("preview and build log browser smoke", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("lvgl-editor-token", "visual-token");
  });
  await page.goto("/");

  await page.getByTestId("preview-button").click();
  await expect(page.getByTestId("preview-overlay")).toBeVisible();
  await expect(page.getByTestId("preview-widget-time-label")).toBeVisible();
  await expect(page.getByTestId("preview-screen-name")).toHaveText("Screen_1");
  await expect(page.getByTestId("preview-screen-name")).toHaveClass(/preview-meta-pill/);
  await expect(page.getByTestId("preview-target-label")).toHaveClass(/preview-meta-pill/);
  await page.getByTestId("close-preview-button").click();
  await expect(page.getByTestId("preview-overlay")).toBeHidden();

  await page.getByTestId("build-button").click();
  await expect(page.locator(".log-panel").getByText("Build completed successfully")).toBeVisible();
  await expect(page.getByTestId("status-activity")).toHaveText("Build completed successfully");
  await expect(page.getByTestId("download-export-button")).toBeVisible();
});

test("Chinese chrome updates document language and keeps the shell fitted", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page).toHaveTitle("LVGL Online Editor");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByTestId("locale-select").selectOption("zh-CN");

  await expect(page).toHaveTitle("LVGL 在线编辑器");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByTestId("preview-button")).toHaveText("预览");
  await expect(page.getByTestId("build-button")).toHaveText("登录后构建");
  await expect(page.getByTestId("widget-search-input")).toHaveAttribute("placeholder", "搜索控件...");
  await expect(page.getByTestId("status-save-dot")).toHaveAttribute("title", "保存状态：所有更改已保存");
  await expect(page.getByTestId("simulator-runtime-kind")).toHaveAttribute("title", /模拟器运行时：(画布回退|LVGL WASM)/);
  await expectNoHorizontalOverflow(page);
  await expectToolbarFitsDesignHeader(page);
  await expectInspectorInputsFit(page);
});

test("compact toolbar keeps cloud project controls accessible", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await page.getByTestId("desktop-menu-file-button").click();
  await expect(page.getByTestId("desktop-menu-file-popover")).toBeVisible();
  await expect(page.getByTestId("desktop-menu-command-save")).toBeVisible();
  await expectMenuPopoverBelowAnchor(page, "[data-testid=\"desktop-menu-file-popover\"]", ".menu-bar");

  await page.getByTestId("desktop-menu-view-button").click();
  await page.getByTestId("desktop-menu-command-simulator").click();
  await expect(page.locator(".bottom-dock")).toHaveClass(/simulator-hidden/);
  await page.getByTestId("desktop-menu-view-button").click();
  await page.getByTestId("desktop-menu-command-simulator").click();
  await expect(page.locator(".bottom-dock")).not.toHaveClass(/simulator-hidden/);
  await expect(page.locator(".simulator-panel")).toBeVisible();

  await page.getByTestId("toolbar-menu-button").click();
  await expect(page.getByTestId("toolbar-project-menu")).toBeVisible();
  await expectMenuPopoverBelowAnchor(page, "[data-testid=\"toolbar-project-menu\"]", ".top-toolbar");
  await expect(page.getByTestId("menu-load-projects-button")).toBeVisible();
  await expect(page.getByTestId("menu-project-select")).toBeVisible();
  await expect(page.getByTestId("menu-new-project-button")).toBeVisible();
  await expect(page.getByTestId("menu-login-email-input")).toBeVisible();
  await expect(page.getByTestId("menu-login-password-input")).toBeVisible();
  await expect(page.getByTestId("menu-login-button")).toBeVisible();
  await expect(page.getByTestId("menu-demo-login-button")).toBeVisible();

  await page.getByTestId("menu-login-email-input").fill("demo@hiveton.dev");
  await page.getByTestId("menu-login-password-input").fill("password");
  await page.getByTestId("menu-login-button").click();
  await expect(page.getByTestId("current-user")).toContainText("Demo User");

  await page.evaluate(() => window.localStorage.removeItem("lvgl-editor-token"));
  await page.reload();
  await page.getByTestId("toolbar-menu-button").click();
  await page.getByTestId("menu-demo-login-button").click();
  await expect(page.getByTestId("current-user")).toContainText("Demo User");
});

test("desktop toolbar keeps demo login directly accessible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByTestId("demo-login-button")).toBeVisible();
  await expect(page.getByTestId("simulator-toggle-button")).toBeVisible();
  await expect(page.getByTestId("simulator-toggle-button")).toHaveAttribute("title", "Hide simulator");
  await page.getByTestId("simulator-toggle-button").click();
  await expect(page.locator(".bottom-dock")).toHaveClass(/simulator-hidden/);
  await expect(page.getByTestId("simulator-toggle-button")).toHaveAttribute("title", "Show simulator");
  await page.getByTestId("simulator-toggle-button").click();
  await expect(page.locator(".bottom-dock")).not.toHaveClass(/simulator-hidden/);
  await page.getByTestId("demo-login-button").click();
  await expect(page.getByTestId("current-user")).toContainText("Demo User");
});

test("short viewport keeps build and auth affordances clear", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  await expect(page.getByTestId("build-button")).toHaveText("Login to Build");
  await expect(page.getByTestId("build-button")).toBeDisabled();
  await expect(page.getByTestId("copy-widget-button")).toBeVisible();
  await expect(page.getByTestId("paste-widget-button")).toBeHidden();
  await expect(page.getByTestId("delete-widget-button")).toBeHidden();
  await expect(page.getByTestId("demo-login-button")).toBeVisible();
  await expect(page.getByTestId("login-button")).toBeHidden();
  await expect(page.getByTestId("toolbar-menu-button")).toBeVisible();
  await expectToolbarFitsDesignHeader(page);
  await expectNoHorizontalOverflow(page);

  await page.getByTestId("toolbar-menu-button").click();
  await expect(page.getByTestId("menu-demo-login-button")).toBeVisible();
});

test("tablet viewport keeps core toolbar actions visible", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");

  await expect(page.getByTestId("toolbar-menu-button")).toBeVisible();
  await expect(page.getByTestId("preview-button")).toBeVisible();
  await expect(page.getByTestId("build-button")).toBeVisible();
  await expect(page.getByTestId("demo-login-button")).toBeVisible();
  await expect(page.getByTestId("canvas-stage")).toBeVisible();
  await expectToolbarFitsDesignHeader(page);
  await expectNoHorizontalOverflow(page);
});

for (const viewport of [
  { width: 599, height: 720 },
  { width: 768, height: 720 },
  { width: 1024, height: 768 }
]) {
  test(`compact viewport has no editor shell clipping at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expectNoHorizontalOverflow(page);
    await expectEditorShellNoHorizontalClip(page);

    await page.getByTestId("resources-nav-button").click();
    await expect(page.getByTestId("resources-panel")).toHaveClass(/active/);
    await expectEditorShellNoHorizontalClip(page);

    await page.getByTestId("bottom-timeline-tab").click();
    await expectEditorShellNoHorizontalClip(page);
  });
}

test("tablet resources view keeps the dock inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");

  await page.getByTestId("resources-nav-button").click();
  await expect(page.getByTestId("resources-panel")).toHaveClass(/active/);
  await expect(page.getByTestId("asset-list-header")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const dockBounds = await page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>('[data-testid="bottom-dock"]');
    const resources = document.querySelector<HTMLElement>('[data-testid="resources-panel"]');
    const status = document.querySelector<HTMLElement>(".status-bar");
    if (!dock || !resources || !status) {
      throw new Error("Missing bottom dock, resources panel or status bar");
    }
    const dockRect = dock.getBoundingClientRect();
    const resourcesRect = resources.getBoundingClientRect();
    const statusRect = status.getBoundingClientRect();
    return {
      dockBottom: dockRect.bottom,
      dockRight: dockRect.right,
      statusTop: statusRect.top,
      statusBottom: statusRect.bottom,
      viewportRight: document.documentElement.clientWidth,
      viewportBottom: document.documentElement.clientHeight,
      resourcesWidth: resourcesRect.width
    };
  });

  expect(dockBounds.dockRight).toBeLessThanOrEqual(dockBounds.viewportRight + 1);
  expect(dockBounds.dockBottom).toBeLessThanOrEqual(dockBounds.statusTop + 1);
  expect(dockBounds.statusBottom).toBeLessThanOrEqual(dockBounds.viewportBottom + 1);
  expect(dockBounds.resourcesWidth).toBeGreaterThanOrEqual(220);

  const simulatorToolbar = await simulatorActionBounds(page);
  expect(simulatorToolbar.toolbarRight).toBeLessThanOrEqual(simulatorToolbar.panelRight + 1);
  expect(simulatorToolbar.buttons.every((button) => button.width >= 28 && button.height >= 28)).toBe(true);
  expect(simulatorToolbar.buttons.every((button) => button.hitTarget === button.testId)).toBe(true);
});

for (const viewport of [
  { width: 1279, height: 720 },
  { width: 1280, height: 720 }
]) {
  test(`resources list has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await page.getByTestId("resources-nav-button").click();
    await expect(page.getByTestId("resources-panel")).toHaveClass(/active/);
    await expectNoHorizontalOverflow(page);
    await expectEditorShellNoHorizontalClip(page);
  });
}

test("tablet viewport exposes inspector editing panel", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");

  await page.getByTestId("canvas-widget-time-label").click();
  await page.getByTestId("inspector-nav-button").click();

  await expect(page.getByTestId("selected-text-input")).toBeVisible();
  await expect(page.getByTestId("inspector-style-tab")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const inspectorBounds = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".inspector-panel");
    const canvas = document.querySelector<HTMLElement>(".center-region");
    if (!panel || !canvas) {
      throw new Error("Missing inspector panel or canvas region");
    }
    const panelRect = panel.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      panelLeft: panelRect.left,
      panelRight: panelRect.right,
      canvasLeft: canvasRect.left,
      viewportRight: document.documentElement.clientWidth
    };
  });

  expect(inspectorBounds.panelLeft).toBeLessThan(inspectorBounds.canvasLeft);
  expect(inspectorBounds.panelRight).toBeLessThanOrEqual(inspectorBounds.viewportRight + 1);
});

test("desktop dock does not block lower sidebar navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await page.getByTestId("code-nav-button").click();
  await expect(page.getByTestId("code-preview")).toBeVisible();

  const hitTarget = await page.evaluate(() => {
    const settings = document.querySelector<HTMLElement>('[data-testid="settings-nav-button"]');
    if (!settings) {
      throw new Error("Missing settings navigation button");
    }
    const rect = settings.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit?.closest<HTMLElement>("[data-testid]")?.dataset.testid ?? null;
  });

  expect(hitTarget).toBe("settings-nav-button");
  await page.getByTestId("settings-nav-button").click();
  await expect(page.getByTestId("settings-panel")).toBeVisible();
});

test("desktop canvas toolbar keeps zoom control clickable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const zoomHitTarget = await page.evaluate(() => {
    const zoom = document.querySelector<HTMLElement>('[data-testid="zoom-select"]');
    if (!zoom) {
      throw new Error("Missing zoom select");
    }
    const rect = zoom.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit?.closest<HTMLElement>("[data-testid]")?.dataset.testid ?? null;
  });

  expect(zoomHitTarget).toBe("zoom-select");
  await page.getByTestId("zoom-select").selectOption("75");
  await expect(page.getByTestId("artboard")).toHaveAttribute("style", /scale\(0\.75\)/);
});

test("short desktop viewport keeps lower sidebar navigation clickable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 650 });
  await page.goto("/");

  const lowerNavHitTargets = await page.evaluate(() => {
    return ["code-nav-button", "settings-nav-button"].map((testId) => {
      const button = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      if (!button) {
        throw new Error(`Missing ${testId}`);
      }
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit?.closest<HTMLElement>("[data-testid]")?.dataset.testid ?? null;
    });
  });

  expect(lowerNavHitTargets).toEqual(["code-nav-button", "settings-nav-button"]);
  await page.getByTestId("code-nav-button").click();
  await expect(page.getByTestId("code-preview")).toBeVisible();
  await page.getByTestId("settings-nav-button").click();
  await expect(page.getByTestId("settings-panel")).toBeVisible();
});

test("light theme brightens editor panels and controls consistently", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByTestId("theme-select").selectOption("light");
  await expect(page.locator(".editor-shell")).toHaveClass(/theme-light/);
  await page.waitForTimeout(180);

  const colors = await page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) {
        throw new Error(`Missing ${selector}`);
      }
      const style = window.getComputedStyle(element);
      return {
        background: style.backgroundColor,
        color: style.color
      };
    };
    return {
      center: read(".center-region"),
      bottom: read(".bottom-dock"),
      widgetCard: read(".widget-card"),
      resourceCard: read(".assets-panel .asset-card"),
      search: read('[data-testid="widget-search-input"]'),
      fontSelect: read('[data-testid="style-font-select"]'),
      alignSelect: read('[data-testid="style-align-select"]'),
      assetTabs: read(".asset-tabs"),
      panelTitles: Array.from(document.querySelectorAll<HTMLElement>(".panel-title"))
        .filter((element) => element.checkVisibility())
        .map((element) => ({
          text: element.textContent?.trim() ?? "",
          color: window.getComputedStyle(element).color
        })),
      layerRows: Array.from(document.querySelectorAll<HTMLElement>(".layer-tree [data-testid]"))
        .filter((element) => element.checkVisibility())
        .map((element) => ({
          testId: element.dataset.testid ?? "",
          color: window.getComputedStyle(element).color
        }))
    };
  });

  for (const item of [
    colors.center,
    colors.bottom,
    colors.widgetCard,
    colors.resourceCard,
    colors.search,
    colors.fontSelect,
    colors.alignSelect,
    colors.assetTabs
  ]) {
    expect(rgbChannel(item.background, 0)).toBeGreaterThanOrEqual(220);
    expect(rgbChannel(item.color, 0)).toBeLessThanOrEqual(80);
  }
  expect(colors.panelTitles.length).toBeGreaterThanOrEqual(4);
  for (const title of colors.panelTitles) {
    expect.soft(title.text).not.toBe("");
    expect.soft(rgbChannel(title.color, 0), title.text).toBeLessThanOrEqual(80);
  }
  expect(colors.layerRows.length).toBeGreaterThanOrEqual(4);
  for (const row of colors.layerRows) {
    expect.soft(rgbChannel(row.color, 0), row.testId).toBeLessThanOrEqual(120);
  }
});

test("layer visibility controls keep usable icon hit targets", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const layerEyeSizes = await page.locator(".layer-eye").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })
  );

  expect(layerEyeSizes.length).toBeGreaterThan(0);
  expect(layerEyeSizes.every((size) => size.width >= 24 && size.height >= 24)).toBe(true);

  await page.getByTestId("layer-row-time-label").hover();
  await page.waitForTimeout(180);
  const hoverState = await page.getByTestId("layer-row-time-label").evaluate((row) => {
    const actions = row.querySelector<HTMLElement>(".layer-actions");
    const state = row.querySelector<HTMLElement>(".layer-state");
    if (!actions || !state) {
      throw new Error("Missing layer action or state rail");
    }
    const actionStyle = window.getComputedStyle(actions);
    const stateStyle = window.getComputedStyle(state);
    return {
      actionsOpacity: Number(actionStyle.opacity),
      actionsBackground: actionStyle.backgroundColor,
      stateOpacity: Number(stateStyle.opacity),
      stateButtonCount: state.querySelectorAll("button").length,
      hideActionCount: actions.querySelectorAll('button[aria-label="Hide Time_Label layer"]').length
    };
  });

  expect(hoverState.actionsOpacity).toBeGreaterThan(0.95);
  expect(hoverState.actionsBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(hoverState.stateOpacity).toBeLessThan(0.1);
  expect(hoverState.stateButtonCount).toBe(0);
  expect(hoverState.hideActionCount).toBe(1);
});

test("compact command toolbar keeps primary tool icons visible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByTestId("grid-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("snap-toggle")).toHaveAttribute("aria-pressed", "true");

  const iconState = await page.evaluate(() => {
    const ids = [
      "new-project-button",
      "load-projects-button",
      "save-project-button",
      "copy-widget-button",
      "paste-widget-button",
      "delete-widget-button"
    ];
    return ids.map((id) => {
      const button = document.querySelector(`[data-testid="${id}"]`);
      const icon = button?.querySelector("svg");
      const iconRect = icon?.getBoundingClientRect();
      return {
        id,
        labelVisible: Boolean(button?.querySelector(".tool-label")?.checkVisibility()),
        iconName: icon?.getAttribute("data-icon-name"),
        iconVisible: Boolean(iconRect && iconRect.width > 0 && iconRect.height > 0)
      };
    });
  });

  expect(iconState.every((item) => item.iconVisible)).toBe(true);
  expect(iconState.every((item) => item.iconName)).toBe(true);
  expect(iconState.every((item) => !item.labelVisible)).toBe(true);

  await page.getByTestId("grid-toggle").click();
  await expect(page.getByTestId("grid-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("artboard")).not.toHaveClass(/show-grid/);
});

test("undo redo toolbar states follow edit history", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByTestId("undo-button")).toBeDisabled();
  await expect(page.getByTestId("redo-button")).toBeDisabled();

  await page.getByTestId("selected-text-input").fill("12:45");
  await expect(page.getByTestId("undo-button")).toBeEnabled();
  await expect(page.getByTestId("redo-button")).toBeDisabled();

  await page.getByTestId("undo-button").click();
  await expect(page.getByTestId("selected-text-input")).toHaveValue("10:09");
  await expect(page.getByTestId("undo-button")).toBeDisabled();
  await expect(page.getByTestId("redo-button")).toBeEnabled();

  await page.getByTestId("redo-button").click();
  await expect(page.getByTestId("selected-text-input")).toHaveValue("12:45");
  await expect(page.getByTestId("undo-button")).toBeEnabled();
  await expect(page.getByTestId("redo-button")).toBeDisabled();
});

test("inspector multiline fields match dark editor controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByTestId("widget-card-chart").click();
  await expect(page.getByTestId("prop-values-input")).toBeVisible();

  const fieldStyle = await page.evaluate(() => {
    const textarea = document.querySelector<HTMLElement>('[data-testid="prop-values-input"]');
    const input = document.querySelector<HTMLElement>('[data-testid="prop-min-input"]');
    if (!textarea || !input) {
      throw new Error("Missing chart textarea or number input");
    }
    const textStyle = window.getComputedStyle(textarea);
    const inputStyle = window.getComputedStyle(input);
    return {
      textareaBackground: textStyle.backgroundColor,
      inputBackground: inputStyle.backgroundColor,
      textareaColor: textStyle.color,
      inputColor: inputStyle.color,
      textareaBorderRadius: textStyle.borderRadius,
      inputBorderRadius: inputStyle.borderRadius,
      textareaResize: textStyle.resize,
      textareaFontFamily: textStyle.fontFamily
    };
  });

  expect(fieldStyle.textareaBackground).toBe(fieldStyle.inputBackground);
  expect(fieldStyle.textareaColor).toBe(fieldStyle.inputColor);
  expect(fieldStyle.textareaBorderRadius).toBe(fieldStyle.inputBorderRadius);
  expect(fieldStyle.textareaResize).toBe("vertical");
  expect(fieldStyle.textareaFontFamily).toContain("Inter");
});

test("inspector event bindings use table columns", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByTestId("inspector-events-tab").click();
  await page.getByTestId("event-handler-input").fill("on_time_clicked");
  await page.getByTestId("add-event-button").click();
  await expect(page.getByTestId("event-list-header")).toBeVisible();

  const result = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".inspector-panel");
    const header = document.querySelector<HTMLElement>('[data-testid="event-list-header"]');
    const row = document.querySelector<HTMLElement>('[data-testid="event-list"] li');
    if (!panel || !header || !row) {
      throw new Error("Missing inspector panel, event header or event row");
    }
    const headerLabels = Array.from(header.querySelectorAll<HTMLElement>("span")).map((node) => node.textContent?.trim());
    const cells = Array.from(row.querySelectorAll<HTMLElement>("[data-event-cell]")).map((node) => node.dataset.eventCell);
    const rowRect = row.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      headerLabels,
      cells,
      rowRight: rowRect.right,
      panelRight: panelRect.right
    };
  });

  expect(result.headerLabels).toEqual(["Target", "Event", "Handler", "Action"]);
  expect(result.cells).toEqual(expect.arrayContaining(["target", "event", "handler", "action"]));
  expect(result.rowRight).toBeLessThanOrEqual(result.panelRight + 1);
});

test("simulator panel exposes compact action controls", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");

  await expect(page.getByTestId("simulator-refresh-button")).toBeVisible();
  await expect(page.getByTestId("simulator-screenshot-button")).toBeVisible();
  await expect(page.getByTestId("simulator-background-button")).toBeVisible();
  await expect(page.getByTestId("simulator-fullscreen-button")).toBeVisible();
  await expect(page.getByTestId("simulator-runtime-kind")).toHaveText(/^(Canvas fallback|LVGL WASM)$/);
  await expect(page.getByTestId("simulator-runtime-kind")).toHaveAttribute("title", /Simulator runtime: (Canvas fallback|LVGL WASM)/);

  const result = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-testid="simulator-panel"]');
    const toolbar = document.querySelector<HTMLElement>('[data-testid="simulator-actions"]');
    const runtime = document.querySelector<HTMLElement>('[data-testid="simulator-runtime-kind"]');
    if (!panel || !toolbar) {
      throw new Error("Missing simulator panel or action toolbar");
    }
    const panelRect = panel.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const buttons = Array.from(toolbar.querySelectorAll<HTMLElement>("button, a")).map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        testId: node.dataset.testid,
        iconName: node.querySelector("svg")?.getAttribute("data-icon-name"),
        width: rect.width,
        height: rect.height,
        right: rect.right
      };
    });
    return {
      toolbarRight: toolbarRect.right,
      panelRight: panelRect.right,
      runtimeRight: runtime?.getBoundingClientRect().right ?? 0,
      buttons
    };
  });

  expect(result.toolbarRight).toBeLessThanOrEqual(result.panelRight + 1);
  expect(result.runtimeRight).toBeLessThanOrEqual(result.panelRight + 1);
  expect(result.buttons.map((button) => button.iconName)).toEqual(["refresh", "camera", "grid", "fullscreen"]);
  expect(result.buttons.every((button) => button.width >= 28 && button.height >= 28)).toBe(true);
  expect(result.buttons.every((button) => button.right <= result.panelRight + 1)).toBe(true);
  const fullscreenHitTarget = await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>('[data-testid="simulator-fullscreen-button"]');
    if (!button) {
      throw new Error("Missing simulator fullscreen button");
    }
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit?.closest<HTMLElement>("[data-testid]")?.dataset.testid ?? null;
  });
  expect(fullscreenHitTarget).toBe("simulator-fullscreen-button");

  await page.getByTestId("simulator-background-button").click();
  await expect(page.getByTestId("simulator-panel")).toHaveClass(/simulator-bg-light/);
});

test("bottom dock can collapse and resize without covering the status bar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByTestId("bottom-dock-collapse-button")).toHaveAttribute("aria-expanded", "true");
  const expanded = await bottomDockBounds(page);
  expect(expanded.height).toBeGreaterThan(220);

  await page.getByTestId("bottom-dock-collapse-button").click();
  await expect(page.getByTestId("bottom-dock")).toHaveClass(/collapsed/);
  await expect(page.getByTestId("bottom-dock-collapse-button")).toHaveAttribute("aria-expanded", "false");
  const collapsed = await bottomDockBounds(page);
  expect(collapsed.height).toBeLessThan(60);
  expect(collapsed.bottom).toBeLessThanOrEqual(collapsed.statusTop + 1);

  await page.getByTestId("bottom-dock-collapse-button").click();
  await expect(page.getByTestId("bottom-dock")).not.toHaveClass(/collapsed/);
  const handleBox = await page.getByTestId("bottom-dock-resize-handle").boundingBox();
  if (!handleBox) {
    throw new Error("Missing bottom dock resize handle bounds");
  }
  const dragX = handleBox.x + 200;
  const dragY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(dragX, dragY);
  await page.mouse.down();
  await page.mouse.move(dragX, dragY - 72);
  await page.mouse.up();

  const resized = await bottomDockBounds(page);
  expect(resized.height).toBeGreaterThan(expanded.height + 40);
  expect(resized.bottom).toBeLessThanOrEqual(resized.statusTop + 1);
  await expect(page.getByTestId("simulator-canvas")).toBeVisible();
});

test("code view actions stay inside the center panel", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByTestId("code-nav-button").click();
  await expect(page.getByTestId("code-preview")).toBeVisible();

  const overflow = await page.evaluate(() => {
    const center = document.querySelector<HTMLElement>(".center-region");
    const header = document.querySelector<HTMLElement>(".code-stage-header");
    if (!center || !header) {
      throw new Error("Missing center region or code header");
    }
    const centerRect = center.getBoundingClientRect();
    return Array.from(header.querySelectorAll<HTMLElement>("button, span, strong"))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return { right: rect.right, text: node.textContent?.trim() ?? "", testId: node.dataset.testid ?? "" };
      })
      .filter((item) => item.right > centerRect.right + 1);
  });

  expect(overflow).toEqual([]);
});

test("space drag pans the canvas stage", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const stage = page.getByTestId("canvas-stage");
  const pan = page.getByTestId("canvas-pan");
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + 180;
  const startY = box!.y + 180;

  await expect(pan).toHaveAttribute("style", /translate\(0px, 0px\)/);
  await page.keyboard.down("Space");
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 32, startY + 24);
  await page.mouse.up();
  await page.keyboard.up("Space");

  await expect(pan).toHaveAttribute("style", /translate\(32px, 24px\)/);
});

test("duplicating a screen preserves cloned widget event bindings", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByTestId("inspector-events-tab").click();
  await page.getByTestId("event-handler-input").fill("on_time_clicked");
  await page.getByTestId("add-event-button").click();
  await page.getByTestId("screens-nav-button").click();
  await page.getByTestId("duplicate-screen-button").click();
  await expect(page.getByTestId("active-screen-label")).toHaveText("Screen_1_1");

  await page.getByTestId("code-nav-button").click();
  await expect(page.getByTestId("code-preview")).toContainText(
    "lv_obj_add_event_cb(ui_Time_Label_1, on_time_clicked, LV_EVENT_CLICKED, NULL);"
  );
  await expect(page.getByTestId("code-preview")).toContainText("void on_time_clicked(lv_event_t * e)");
});

test("duplicating a widget preserves its event binding", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByTestId("inspector-events-tab").click();
  await page.getByTestId("event-handler-input").fill("on_time_clicked");
  await page.getByTestId("add-event-button").click();
  await page.getByTestId("copy-widget-button").click();
  await page.getByTestId("paste-widget-button").click();
  await expect(page.getByTestId("selector-input")).toHaveValue("Time_Label_1");

  await page.getByTestId("code-nav-button").click();
  await expect(page.getByTestId("code-preview")).toContainText(
    "lv_obj_add_event_cb(ui_Time_Label_1, on_time_clicked, LV_EVENT_CLICKED, NULL);"
  );
});

test("referenced asset delete clears ProjectDoc before deleting asset", async ({ page }) => {
  const savedDocs: Array<Record<string, any>> = [];
  const requestOrder: string[] = [];
  await page.route("**/api/projects/*/assets", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ assets: [] })
      });
      return;
    }
    requestOrder.push("upload");
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        asset: {
          id: "asset-visual-1",
          projectId: "project-visual-1",
          name: "visual-icon.png",
          kind: "image",
          mimeType: "image/png",
          width: 1,
          height: 1,
          sizeBytes: 8,
          objectKey: "projects/project-visual-1/assets/visual-icon.png",
          createdAt: "2026-05-08T00:00:00Z"
        }
      })
    });
  });
  await page.route("**/api/projects/*/assets/asset-visual-1", async (route) => {
    requestOrder.push("delete");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ deleted: true })
    });
  });
  await page.route("**/api/projects/*/assets/asset-visual-1/content", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from("png")
    });
  });
  await page.route("**/api/projects/*/doc", async (route) => {
    requestOrder.push("save");
    savedDocs.push(route.request().postDataJSON().doc);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ projectId: "project-visual-1", updatedAt: "2026-05-08T00:00:00Z" })
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("lvgl-editor-token", "visual-token");
  });
  await page.goto("/");

  await page.getByTestId("widget-card-image").click();
  await page.getByTestId("asset-file-input").setInputFiles({
    name: "visual-icon.png",
    mimeType: "image/png",
    buffer: Buffer.from("png")
  });
  await expect(page.getByTestId("delete-asset-asset-visual-1")).toBeVisible();
  await page.getByTestId("image-asset-select").selectOption("asset-visual-1");
  await page.getByTestId("delete-asset-asset-visual-1").click();
  await expect(page.getByTestId("asset-delete-confirm")).toBeVisible();
  await page.getByTestId("confirm-delete-asset-button").click();

  await expect(page.getByTestId("delete-asset-asset-visual-1")).toBeHidden();
  expect(requestOrder[requestOrder.length - 2]).toBe("save");
  expect(requestOrder[requestOrder.length - 1]).toBe("delete");
  const savedBeforeDelete = savedDocs[savedDocs.length - 1];
  expect(savedBeforeDelete?.assets).toEqual([]);
  const children = savedBeforeDelete?.screens[0].root.children ?? [];
  expect(children[children.length - 1].props.assetId).toBeUndefined();
});

async function mockApi(page: Page): Promise<void> {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        token: "visual-token",
        user: { id: "visual-user", email: "demo@hiveton.dev", displayName: "Demo User" }
      })
    });
  });

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "visual-user", email: "demo@hiveton.dev", displayName: "Demo User" })
    });
  });

  await page.route("**/api/projects", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        project: {
          id: "project-visual-1",
          name: "My Watch UI",
          createdAt: apiTimestamp,
          updatedAt: apiTimestamp,
          doc: apiProjectDoc("project-visual-1", "My Watch UI")
        }
      })
    });
  });

  await page.route("**/api/projects/*/export/c", async (route) => {
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ jobId: "visual-job-1" })
    });
  });

  await page.route("**/api/jobs/visual-job-1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        job: {
          id: "visual-job-1",
          kind: "export_c",
          status: "succeeded",
          progress: 100,
          logs: [
            { time: apiTimestamp, level: "info", message: "Build started" },
            { time: "2026-05-08T00:00:01Z", level: "info", message: "Generating code" },
            { time: "2026-05-08T00:00:02Z", level: "info", message: "Build completed successfully" }
          ],
          result: {
            downloadUrl: "/exports/visual-job-1.zip"
          }
        }
      })
    });
  });

  await page.route("**/api/projects/*/doc", async (route) => {
    const projectId = new URL(route.request().url()).pathname.match(/\/api\/projects\/([^/]+)\/doc$/)?.[1] ?? "project-visual-1";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ projectId, updatedAt: "2026-05-08T00:00:00Z" })
    });
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

async function expectEditorShellNoHorizontalClip(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const selectors = [
      ".editor-shell",
      ".workspace",
      ".center-region",
      ".canvas-toolbar",
      ".bottom-dock",
      '[data-testid="resources-panel"]',
      '[data-testid="asset-list-header"]',
      '[data-testid="console-list-header"]',
      '[data-testid="timeline-list-header"]',
      '[data-testid="timeline-list"]'
    ];
    return selectors
      .map((selector) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element || !element.checkVisibility()) {
          return null;
        }
        if ((selector === '[data-testid="resources-panel"]' || selector === '[data-testid="asset-list-header"]')
          && !document.querySelector(".editor-shell")?.classList.contains("nav-resources")) {
          return null;
        }
        return {
          selector,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          overflowX: element.scrollWidth - element.clientWidth
        };
      })
      .filter((item) => item && item.overflowX > 2);
  });
  expect(overflow).toEqual([]);
}

async function expectToolbarFitsDesignHeader(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const toolbar = document.querySelector(".top-toolbar");
    if (!toolbar) {
      throw new Error("Missing toolbar");
    }
    const toolbarRect = toolbar.getBoundingClientRect();
    const visibleControls = Array.from(toolbar.querySelectorAll("button, input, select"))
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          testid: node.getAttribute("data-testid"),
          bottom: rect.bottom,
          right: rect.right
        };
      });
    return {
      height: toolbarRect.height,
      controlOverflow: visibleControls.filter((item) => item.bottom > toolbarRect.bottom + 1 || item.right > toolbarRect.right + 1),
      previewVisible: !!document.querySelector('[data-testid="preview-button"]')?.checkVisibility(),
      buildVisible: !!document.querySelector('[data-testid="build-button"]')?.checkVisibility(),
      demoVisible: !!document.querySelector('[data-testid="demo-login-button"]')?.checkVisibility()
    };
  });

  expect(result.height).toBeLessThanOrEqual(88);
  expect(result.controlOverflow).toEqual([]);
  expect(result.previewVisible).toBe(true);
  expect(result.buildVisible).toBe(true);
  expect(result.demoVisible).toBe(true);
}

async function expectPanelsDoNotOverlap(page: Page): Promise<void> {
  const bounds = await page.evaluate(() => {
    const rect = (selector: string) => {
      const node = document.querySelector(selector);
      if (!node) {
        throw new Error(`Missing selector: ${selector}`);
      }
      const { left, right, top, bottom, width, height } = node.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    return {
      toolbar: rect(".top-toolbar"),
      widgets: rect(".widgets-panel"),
      layers: rect(".layers-panel"),
      center: rect(".center-region"),
      inspector: rect(".inspector-panel"),
      bottom: rect(".bottom-dock"),
      status: rect(".status-bar")
    };
  });

  expect(bounds.toolbar.bottom).toBeLessThanOrEqual(bounds.widgets.top + 1);
  expect(bounds.widgets.right).toBeLessThanOrEqual(bounds.layers.left + 1);
  expect(bounds.layers.right).toBeLessThanOrEqual(bounds.center.left + 1);
  expect(bounds.center.right).toBeLessThanOrEqual(bounds.inspector.left + 1);
  expect(bounds.bottom.top).toBeGreaterThanOrEqual(bounds.center.bottom - 1);
  expect(bounds.status.top).toBeGreaterThanOrEqual(bounds.bottom.bottom - 1);
  expect(bounds.widgets.width).toBeGreaterThanOrEqual(220);
  expect(bounds.layers.width).toBeGreaterThanOrEqual(250);
  expect(bounds.inspector.width).toBeGreaterThanOrEqual(300);
}

async function expectInspectorInputsFit(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const panel = document.querySelector(".inspector-panel");
    if (!panel) {
      throw new Error("Missing inspector panel");
    }
    const panelRight = panel.getBoundingClientRect().right;
    const overflowing = Array.from(panel.querySelectorAll("input, select, textarea, button"))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return { tag: node.tagName, right: rect.right };
      })
      .filter((item) => item.right > panelRight + 1);
    return overflowing;
  });

  expect(result).toEqual([]);
}

async function expectLayerListUsesToolColumns(page: Page): Promise<void> {
  await expect(page.getByTestId("layer-list-header")).toBeVisible();

  const result = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".layers-panel");
    const header = document.querySelector<HTMLElement>('[data-testid="layer-list-header"]');
    const row = document.querySelector<HTMLElement>('[data-testid="layer-row-time-label"]');
    if (!panel || !header || !row) {
      throw new Error("Missing layer panel, header or first row");
    }
    const headerLabels = Array.from(header.querySelectorAll<HTMLElement>("span")).map((node) => node.textContent?.trim());
    const cells = Array.from(row.querySelectorAll<HTMLElement>("[data-layer-cell]")).map((node) => node.dataset.layerCell);
    const rowRect = row.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      headerLabels,
      cells,
      rowRight: rowRect.right,
      panelRight: panelRect.right,
      stateButtonCount: row.querySelectorAll(".layer-state button").length
    };
  });

  expect(result.headerLabels).toEqual(["Object", "State", "Tools"]);
  expect(result.cells).toEqual(expect.arrayContaining(["name", "state", "actions"]));
  expect(result.rowRight).toBeLessThanOrEqual(result.panelRight + 1);
  expect(result.stateButtonCount).toBe(0);
}

async function expectScreenListUsesTableColumns(page: Page): Promise<void> {
  await expect(page.getByTestId("screen-list-header")).toBeVisible();

  const result = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".layers-panel");
    const header = document.querySelector<HTMLElement>('[data-testid="screen-list-header"]');
    const row = document.querySelector<HTMLElement>('[data-testid="screen-row-screen-1"]');
    if (!panel || !header || !row) {
      throw new Error("Missing screen panel, header or Screen_1 row");
    }
    const headerLabels = Array.from(header.querySelectorAll<HTMLElement>("span")).map((node) => node.textContent?.trim());
    const cells = Array.from(row.querySelectorAll<HTMLElement>("[data-screen-cell]")).map((node) => node.dataset.screenCell);
    const rowRect = row.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      headerLabels,
      cells,
      rowRight: rowRect.right,
      panelRight: panelRect.right,
      state: row.querySelector<HTMLElement>('[data-screen-cell="state"]')?.textContent?.trim()
    };
  });

  expect(result.headerLabels).toEqual(["Screen", "Widgets", "State"]);
  expect(result.cells).toEqual(expect.arrayContaining(["name", "widgets", "state"]));
  expect(result.rowRight).toBeLessThanOrEqual(result.panelRight + 1);
  expect(result.state).toBe("Active");
}

async function expectActiveScreenRenameIsUsable(page: Page): Promise<void> {
  const input = page.getByTestId("active-screen-name-input");
  await expect(input).toBeVisible();

  const bounds = await input.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeGreaterThanOrEqual(140);
  expect(bounds!.height).toBeGreaterThanOrEqual(28);

  await input.fill("Dashboard");
  await expect(page.getByTestId("active-screen-label")).toHaveText("Dashboard");
  await expect(page.getByTestId("screen-row-dashboard")).toBeVisible();
}

async function expectSimulatorPreviewUsesDockSpace(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".simulator-panel");
    const canvas = document.querySelector<HTMLElement>('[data-testid="simulator-canvas"]');
    if (!panel || !canvas) {
      throw new Error("Missing simulator panel or canvas");
    }
    const panelRect = panel.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      panelHeight: panelRect.height,
      canvasWidth: canvasRect.width,
      canvasHeight: canvasRect.height,
      canvasBottom: canvasRect.bottom,
      panelBottom: panelRect.bottom
    };
  });

  expect(result.canvasWidth).toBeGreaterThanOrEqual(140);
  expect(result.canvasHeight).toBeGreaterThanOrEqual(140);
  expect(result.canvasBottom).toBeLessThanOrEqual(result.panelBottom - 28);
}

async function simulatorActionBounds(page: Page): Promise<{
  toolbarRight: number;
  panelRight: number;
  buttons: Array<{ testId: string | undefined; width: number; height: number; hitTarget: string | null }>;
}> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-testid="simulator-panel"]');
    const toolbar = document.querySelector<HTMLElement>('[data-testid="simulator-actions"]');
    if (!panel || !toolbar) {
      throw new Error("Missing simulator panel or action toolbar");
    }
    const panelRect = panel.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const buttons = Array.from(toolbar.querySelectorAll<HTMLElement>("button, a")).map((node) => {
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        testId: node.dataset.testid,
        width: rect.width,
        height: rect.height,
        hitTarget: hit?.closest<HTMLElement>("[data-testid]")?.dataset.testid ?? null
      };
    });
    return {
      toolbarRight: toolbarRect.right,
      panelRight: panelRect.right,
      buttons
    };
  });
}

async function expectWidgetPaletteCardsUseConsistentGrid(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".widgets-panel");
    if (!panel) {
      throw new Error("Missing widgets panel");
    }
    const cards = Array.from(panel.querySelectorAll<HTMLElement>(".widget-card"));
    const widths = cards.map((card) => Math.round(card.getBoundingClientRect().width));
    return {
      count: widths.length,
      minWidth: Math.min(...widths),
      maxWidth: Math.max(...widths)
    };
  });

  expect(result.count).toBeGreaterThan(0);
  expect(result.maxWidth - result.minWidth).toBeLessThanOrEqual(2);
}

async function expectBottomDockPanelsAreDistinct(page: Page): Promise<void> {
  const bounds = await page.evaluate(() => {
    const rects = Array.from(document.querySelectorAll(".bottom-dock > .panel")).map((node) => {
      const { left, right, width, height } = node.getBoundingClientRect();
      return { left, right, width, height };
    });
    return rects;
  });

  expect(bounds).toHaveLength(3);
  expect(bounds[0].right).toBeLessThanOrEqual(bounds[1].left + 1);
  expect(bounds[1].right).toBeLessThanOrEqual(bounds[2].left + 1);
  for (const bound of bounds) {
    expect(bound.width).toBeGreaterThan(120);
    expect(bound.height).toBeGreaterThan(120);
  }
}

async function bottomDockBounds(page: Page): Promise<{ bottom: number; height: number; statusTop: number }> {
  return page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>('[data-testid="bottom-dock"]');
    const status = document.querySelector<HTMLElement>(".status-bar");
    if (!dock || !status) {
      throw new Error("Missing bottom dock or status bar");
    }
    const dockRect = dock.getBoundingClientRect();
    const statusRect = status.getBoundingClientRect();
    return {
      bottom: dockRect.bottom,
      height: dockRect.height,
      statusTop: statusRect.top
    };
  });
}

async function expectResourceListHasOwnViewport(page: Page): Promise<void> {
  await page.getByTestId("resources-nav-button").click();
  await expect(page.getByTestId("resources-panel")).toHaveClass(/active/);
  await expect(page.getByTestId("resources-panel")).toContainText("Resources");
  await expect(page.getByTestId("asset-list-header")).toBeVisible();

  const result = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-testid="resources-panel"]');
    const grid = panel?.querySelector<HTMLElement>(".asset-grid");
    const header = panel?.querySelector<HTMLElement>('[data-testid="asset-list-header"]');
    if (!panel || !grid) {
      throw new Error("Missing resource panel or asset grid");
    }
    if (!header) {
      throw new Error("Missing resource table header");
    }
    const panelRect = panel.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const panelStyle = window.getComputedStyle(panel);
    const gridStyle = window.getComputedStyle(grid);
    const headerLabels = Array.from(header.querySelectorAll<HTMLElement>("span")).map((node) => node.textContent?.trim());
    const firstCard = grid.querySelector<HTMLElement>(".asset-card");
    const firstCells = firstCard
      ? Array.from(firstCard.querySelectorAll<HTMLElement>("[data-asset-cell]")).map((node) => node.dataset.assetCell)
      : [];
    return {
      panelOverflowY: panelStyle.overflowY,
      gridOverflowY: gridStyle.overflowY,
      gridHeight: gridRect.height,
      headerBottom: headerRect.bottom,
      gridTop: gridRect.top,
      gridBottom: gridRect.bottom,
      panelBottom: panelRect.bottom,
      sampleCount: grid.querySelectorAll(".asset-card").length,
      headerLabels,
      firstCells,
      visibleRows: Array.from(grid.querySelectorAll<HTMLElement>(".asset-card"))
        .filter((card) => {
          const cardRect = card.getBoundingClientRect();
          return cardRect.top >= gridRect.top - 1 && cardRect.bottom <= gridRect.bottom + 1;
        }).length
    };
  });

  expect(result.panelOverflowY).toBe("hidden");
  expect(result.gridOverflowY).toBe("auto");
  expect(result.gridHeight).toBeGreaterThan(150);
  expect(result.headerBottom).toBeLessThanOrEqual(result.gridTop + 8);
  expect(result.gridBottom).toBeLessThanOrEqual(result.panelBottom + 1);
  expect(result.sampleCount).toBeGreaterThan(0);
  expect(result.headerLabels).toEqual(["Name", "Type", "Size", "Use"]);
  expect(result.firstCells).toEqual(expect.arrayContaining(["name", "type", "size", "usage"]));
  expect(result.visibleRows).toBeGreaterThanOrEqual(4);
}

async function expectConsoleLogUsesTableColumns(page: Page): Promise<void> {
  await expect(page.getByTestId("bottom-log-tab")).toHaveClass(/active/);
  await expect(page.getByTestId("console-list-header")).toBeVisible();

  const result = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".log-panel");
    const header = document.querySelector<HTMLElement>('[data-testid="console-list-header"]');
    const row = document.querySelector<HTMLElement>('[data-testid="console-log-entry"]');
    if (!panel || !header || !row) {
      throw new Error("Missing console panel, header or log row");
    }
    const headerLabels = Array.from(header.querySelectorAll<HTMLElement>("span")).map((node) => node.textContent?.trim());
    const cells = Array.from(row.querySelectorAll<HTMLElement>("[data-log-cell]")).map((node) => node.dataset.logCell);
    const rowRect = row.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      headerLabels,
      cells,
      rowRight: rowRect.right,
      panelRight: panelRect.right
    };
  });

  expect(result.headerLabels).toEqual(["Time", "Message"]);
  expect(result.cells).toEqual(expect.arrayContaining(["time", "message"]));
  expect(result.rowRight).toBeLessThanOrEqual(result.panelRight + 1);
}

async function expectTimelineUsesTableColumns(page: Page): Promise<void> {
  await page.getByTestId("bottom-timeline-tab").click();
  await expect(page.getByTestId("timeline-list-header")).toBeVisible();

  const result = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".log-panel");
    const header = document.querySelector<HTMLElement>('[data-testid="timeline-list-header"]');
    const row = document.querySelector<HTMLElement>("[data-testid=\"timeline-list\"] li");
    if (!panel || !header || !row) {
      throw new Error("Missing timeline panel, header or row");
    }
    const headerLabels = Array.from(header.querySelectorAll<HTMLElement>("span")).map((node) => node.textContent?.trim());
    const cells = Array.from(row.querySelectorAll<HTMLElement>("[data-timeline-cell]")).map((node) => node.dataset.timelineCell);
    const rowRect = row.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    return {
      headerLabels,
      cells,
      rowRight: rowRect.right,
      panelRight: panelRect.right
    };
  });

  expect(result.headerLabels).toEqual(["Kind", "Item", "Status"]);
  expect(result.cells).toEqual(expect.arrayContaining(["kind", "item", "status"]));
  expect(result.rowRight).toBeLessThanOrEqual(result.panelRight + 1);
}

async function expectMenuPopoverBelowAnchor(page: Page, popoverSelector: string, anchorSelector: string): Promise<void> {
  const bounds = await page.evaluate(
    ({ popoverSelector, anchorSelector }) => {
      const popover = document.querySelector<HTMLElement>(popoverSelector);
      const anchor = document.querySelector<HTMLElement>(anchorSelector);
      if (!popover || !anchor) {
        throw new Error(`Missing popover ${popoverSelector} or anchor ${anchorSelector}`);
      }
      const popoverRect = popover.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      return {
        popoverTop: popoverRect.top,
        anchorBottom: anchorRect.bottom
      };
    },
    { popoverSelector, anchorSelector }
  );

  expect(bounds.popoverTop).toBeGreaterThanOrEqual(bounds.anchorBottom + 3);
}
