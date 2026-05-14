import { expect, test, type Page } from "@playwright/test";

const visualViewports = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];

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

    await expectNoHorizontalOverflow(page);
    await expectToolbarFitsSingleRow(page);
    await expectPanelsDoNotOverlap(page);
    await expectInspectorInputsFit(page);
    await expectBottomDockPanelsAreDistinct(page);
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
  await page.getByTestId("close-preview-button").click();
  await expect(page.getByTestId("preview-overlay")).toBeHidden();

  await page.getByTestId("build-button").click();
  await expect(page.getByText("Build completed successfully")).toBeVisible();
  await expect(page.getByTestId("download-export-button")).toBeVisible();
});

test("compact toolbar keeps cloud project controls accessible", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await page.getByTestId("toolbar-menu-button").click();
  await expect(page.getByTestId("toolbar-project-menu")).toBeVisible();
  await expect(page.getByTestId("menu-load-projects-button")).toBeVisible();
  await expect(page.getByTestId("menu-project-select")).toBeVisible();
  await expect(page.getByTestId("menu-new-project-button")).toBeVisible();
  await expect(page.getByTestId("menu-demo-login-button")).toBeVisible();

  await page.getByTestId("menu-demo-login-button").click();
  await expect(page.getByTestId("current-user")).toContainText("Demo User");
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
  await page.getByTestId("duplicate-widget-button").click();
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
          updatedAt: "2026-05-08T00:00:00Z",
          doc: {}
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
          status: "succeeded",
          logs: [
            { time: "2026-05-08T00:00:00Z", level: "info", message: "Build started" },
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ projectId: "project-watch-demo", updatedAt: "2026-05-08T00:00:00Z" })
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

async function expectToolbarFitsSingleRow(page: Page): Promise<void> {
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
      loginVisible: !!document.querySelector('[data-testid="login-button"]')?.checkVisibility()
    };
  });

  expect(result.height).toBeLessThanOrEqual(56);
  expect(result.controlOverflow).toEqual([]);
  expect(result.previewVisible).toBe(true);
  expect(result.buildVisible).toBe(true);
  expect(result.loginVisible).toBe(true);
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
  expect(bounds.widgets.width).toBeGreaterThanOrEqual(250);
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
