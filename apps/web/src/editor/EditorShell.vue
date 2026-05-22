<template>
  <main ref="editorShellRef" class="editor-shell" :class="[`theme-${project.theme}`, `nav-${activeNavItem}`]" :style="bottomDockStyle">
    <TopToolbar
      v-model:grid-enabled="gridEnabled"
      v-model:snap-enabled="snapEnabled"
      :auth-error="authStore.error"
      :auth-user="authUser"
      :build-status="buildStatus"
      :can-build-project="canBuildProject"
      :can-copy-widget="projectStore.canCopySelectedWidget"
      :can-delete-widget="projectStore.canDeleteSelectedWidget"
      :can-paste-widget="projectStore.canPasteCopiedWidget"
      :copied-widget-name="projectStore.copiedWidgetName"
      :can-redo="projectStore.canRedo"
      :can-undo="projectStore.canUndo"
      :project="project"
      :projects="projectStore.projects"
      :selected-widget-name="selectedWidget?.name"
      :simulator-visible="simulatorVisible"
      :target-label="targetLabel"
      @build="buildProject"
      @clear-auth-error="authStore.clearError"
      @copy-widget="projectStore.copySelectedWidget"
      @create-project="openNewProjectDialog"
      @delete-widget="projectStore.deleteSelectedWidget"
      @demo-login="loginDemo"
      @load-projects="loadProjectList"
      @login="loginWithPassword"
      @logout="logoutUser"
      @open-project="openProject"
      @paste-widget="projectStore.pasteCopiedWidget"
      @preview="previewProject"
      @rename-project="projectStore.renameProject"
      @redo="projectStore.redo"
      @save-project="saveProjectWithLog"
      @show-settings="activateNav('settings')"
      @toggle-simulator="toggleSimulatorPanel"
      @undo="projectStore.undo"
      @update-theme="projectStore.updateTheme"
    />

    <section class="workspace">
      <SidebarNav :active-item="activeNavItem" @activate="activateNav" />

      <WidgetPalette :catalog="widgetCatalog" @add-widget="addWidgetFromPalette" />

      <LayersPanel
        :active-screen-name="activeScreen?.name"
        :active-screen-root-id="activeScreen?.root.id ?? ''"
        :rows="layerRows"
        :selected-widget-id="selectedWidget?.id ?? null"
        @select-widget="projectStore.selectWidget"
        @rename-widget="renameLayerWidget"
        @toggle-locked="projectStore.toggleWidgetLocked"
        @toggle-hidden="projectStore.toggleWidgetHidden"
        @reorder="projectStore.reorderWidgetLayer"
        @delete-widget="deleteLayerWidget"
        @drag-start="startLayerDrag"
        @drop-widget="dropLayerWidget"
      >
        <ScreensPanel
          :active-screen="activeScreen"
          :screens="project.screens"
          :has-duplicate-screen-names="hasDuplicateScreenNames"
          @add-screen="projectStore.addScreen"
          @delete-active-screen="deleteActiveScreen"
          @duplicate-screen="projectStore.duplicateScreen"
          @rename-screen="projectStore.renameScreen"
          @switch-screen="projectStore.switchScreen"
        />
      </LayersPanel>

      <CanvasWorkspace
        v-model:zoom-percent="zoomPercent"
        :active-center-panel="activeCenterPanel"
        :active-screen-name="activeScreen?.name"
        :alignment-guides="alignmentGuides"
        :artboard-style="artboardStyle"
        :canvas-pan-style="canvasPanStyle"
        :code-preview="codePreview"
        :code-copy-status="codeCopyStatus"
        :device-surface-style="deviceSurfaceStyle"
        :grid-enabled="gridEnabled"
        :image-preview-url="imagePreviewUrl"
        :inspector-errors="inspectorErrors"
        :project="project"
        :rendered-widgets="renderedWidgets"
        :ruler-left-style="rulerLeftStyle"
        :ruler-top-style="rulerTopStyle"
        :ruler-x-ticks="rulerXTicks"
        :ruler-y-ticks="rulerYTicks"
        :save-state-label="saveStateLabel"
        :selected-widget="selectedWidget"
        :to-test-id="toTestId"
        :widget-style="widgetStyle"
        :widget-text="widgetText"
        :zoom-levels="zoomLevels"
        @add-screen="projectStore.addScreen"
        @artboard-mounted="artboardRef = $event"
        @copy-generated-code="copyGeneratedCode"
        @drop-widget="dropWidgetOnCanvas"
        @fit-view="fitCanvasToView"
        @fullscreen-canvas="requestCanvasFullscreen"
        @rename-project="projectStore.renameProject"
        @select-widget="projectStore.selectWidget"
        @show-canvas="activateNav('widgets')"
        @show-settings="activateNav('settings')"
        @start-canvas-pan="startCanvasPan"
        @start-move="startMove"
        @start-resize="startResize"
        @update-target-color-depth="updateTargetColorDepth"
        @update-target-device-name="updateTargetDeviceName"
        @update-target-lvgl-version="updateTargetLvglVersion"
        @update-target-number="updateTargetNumber"
        @update-theme="projectStore.updateTheme"
        @update-mouse-coordinates="updateMouseCoordinates"
      />

      <InspectorPanel
        v-model:active-inspector-tab="activeInspectorTab"
        v-model:event-handler="eventHandler"
        v-model:event-target-widget-id="eventTargetWidgetId"
        v-model:event-type="eventType"
        :font-assets="fontAssets"
        :image-assets="imageAssets"
        :inspector-errors="inspectorErrors"
        :event-target-rows="eventTargetRows"
        :layer-rows="layerRows"
        :project="project"
        :selected-events="selectedEvents"
        :selected-widget="selectedWidget"
        @add-event="addSelectedEvent"
        @bind-image-asset="projectStore.bindSelectedImageAsset"
        @remove-event="projectStore.removeEventBinding"
        @rename-widget="renameSelectedWidget"
        @update-flex-direction="updateFlexDirection"
        @update-flex-gap="updateFlexGap"
        @update-flex-wrap="updateFlexWrap"
        @update-layout-align="updateLayoutAlign"
        @update-layout-number="updateLayoutNumber"
        @update-padding-side="updatePaddingSide"
        @update-prop-checked="updatePropChecked"
        @update-prop-number="updatePropNumber"
        @update-prop-text="updatePropText"
        @update-prop-values="updateChartValues"
        @update-style-align="updateStyleAlign"
        @update-style-font="updateStyleFont"
        @update-style-number="updateStyleNumber"
        @update-style-text="updateStyleText"
        @update-target-color-depth="updateTargetColorDepth"
        @update-target-device-name="updateTargetDeviceName"
        @update-target-lvgl-version="updateTargetLvglVersion"
        @update-target-number="updateTargetNumber"
        @update-text="projectStore.updateSelectedText"
      />
    </section>

    <section
      class="bottom-dock"
      :class="{ 'simulator-hidden': !simulatorVisible, collapsed: bottomDockCollapsed }"
      :style="bottomDockStyle"
      data-testid="bottom-dock"
    >
      <button
        class="bottom-dock-collapse"
        type="button"
        data-testid="bottom-dock-collapse-button"
        :aria-expanded="bottomDockCollapsed ? 'false' : 'true'"
        :aria-label="bottomDockCollapseLabel"
        :title="bottomDockCollapseLabel"
        @click="toggleBottomDockCollapsed"
      >
        <IconGlyph :name="bottomDockCollapsed ? 'arrowUp' : 'arrowDown'" />
      </button>
      <div
        class="bottom-dock-resize-handle"
        data-testid="bottom-dock-resize-handle"
        role="separator"
        tabindex="0"
        aria-orientation="horizontal"
        aria-label="Resize bottom dock"
        title="Resize bottom dock"
        aria-valuemin="180"
        aria-valuemax="420"
        :aria-valuenow="bottomDockEffectiveHeight"
        :aria-valuetext="bottomDockHeightValueText"
        @mousedown="startBottomDockResize"
        @keydown="handleBottomDockResizeKeydown"
      />
      <AssetsPanel
        data-testid="resources-panel"
        aria-label="Resources"
        :class="{ active: activeNavItem === 'resources' }"
        :assets="assetsStore.assets"
        :usage-counts="assetUsageCounts"
        :preview-urls="assetsStore.previewUrls"
        :selected-widget="selectedWidget"
        :error="assetsStore.error"
        @upload="uploadAsset"
        @delete-asset="deleteAsset"
        @bind-image-asset="bindAssetFromPanel"
      />
      <LogPanel
        v-model="bottomLogTab"
        :build-status="buildStatus"
        :export-download-url="exportDownloadUrl"
        :log-entries="combinedLogEntries"
        :project-name="project.name"
        :timeline-items="timelineItems"
        @download-export="downloadExportZip"
      />
      <SimulatorPanel
        v-if="simulatorVisible"
        :active-screen-name="activeScreen?.name"
        :background="simulatorBackground"
        :screenshot-url="simulatorScreenshotUrl"
        :status="simulatorStatus"
        :message="simulatorMessage"
        @fullscreen="requestSimulatorFullscreen"
        @mounted="handleSimulatorCanvasMounted"
        @refresh="refreshSimulatorPanel"
        @screenshot="captureSimulatorScreenshot"
        @toggle-background="toggleSimulatorBackground"
      />
    </section>

    <StatusBar
      :save-state-label="saveStateLabel"
      :persistence-label="persistenceLabel"
      :activity-message="latestActivityMessage"
      :lvgl-version="project.target.lvglVersion"
      :dpi="project.target.dpi"
      :coordinates="mouseCoordinates"
    />

    <PreviewOverlay
      v-if="previewOpen"
      :active-screen-name="activeScreen?.name"
      :image-preview-url="imagePreviewUrl"
      :preview-device-style="previewDeviceStyle"
      :preview-screenshot-url="previewScreenshotUrl"
      :preview-status-message="previewStatusMessage"
      :rendered-widgets="renderedWidgets"
      :target-label="targetLabel"
      :to-test-id="toTestId"
      :widget-style="widgetStyle"
      :widget-text="widgetText"
      @close="closePreview"
      @refresh="refreshPreview"
      @screenshot="capturePreviewScreenshot"
    />

    <section
      v-if="newProjectDialogOpen"
      class="confirm-overlay"
      data-testid="new-project-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-project-dialog-title"
      aria-describedby="new-project-dialog-description"
      @click.self="closeNewProjectDialog"
      @keydown.tab="handleDialogTabKeydown($event)"
    >
      <form class="confirm-dialog" @submit.prevent="createNewProject">
        <strong id="new-project-dialog-title">Create cloud project</strong>
        <p id="new-project-dialog-description">Name the LVGL project before creating it in cloud storage.</p>
        <label class="dialog-field">
          Project Name
          <input
            v-model="newProjectName"
            ref="newProjectNameInput"
            data-testid="new-project-name-input"
            aria-label="Cloud project name"
            :aria-describedby="newProjectNameError ? 'new-project-name-error' : undefined"
            :aria-invalid="newProjectNameError ? 'true' : undefined"
            title="Cloud project name"
            autocomplete="off"
            maxlength="80"
            @input="clearNewProjectNameError"
          />
        </label>
        <p v-if="newProjectNameError" id="new-project-name-error" class="field-error" data-testid="new-project-name-error" role="alert">{{ newProjectNameError }}</p>
        <div class="confirm-actions">
          <button class="select-like" data-testid="cancel-new-project-button" type="button" aria-label="Cancel creating cloud project" title="Cancel creating cloud project" @click="closeNewProjectDialog">Cancel</button>
          <button class="primary-action" data-testid="confirm-new-project-button" type="submit" :aria-label="newProjectConfirmLabel" :title="newProjectConfirmLabel">Create project</button>
        </div>
      </form>
    </section>

    <section
      v-if="pendingAssetDelete"
      class="confirm-overlay"
      data-testid="asset-delete-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-delete-confirm-title"
      aria-describedby="asset-delete-confirm-description"
      @click.self="cancelAssetDelete"
      @keydown.tab="handleDialogTabKeydown($event)"
    >
      <div class="confirm-dialog">
        <strong id="asset-delete-confirm-title">Delete referenced asset?</strong>
        <p id="asset-delete-confirm-description" role="alert">{{ pendingAssetDelete.name }} is used by {{ pendingAssetDelete.usageCount }} image widget{{ pendingAssetDelete.usageCount === 1 ? "" : "s" }}. Deleting it will clear those image references.</p>
        <div class="confirm-actions">
          <button
            ref="assetDeleteCancelButton"
            class="select-like"
            type="button"
            data-testid="cancel-delete-asset-button"
            :aria-label="assetDeleteCancelLabel"
            :title="assetDeleteCancelLabel"
            @click="cancelAssetDelete"
          >
            Cancel
          </button>
          <button
            class="danger-action"
            type="button"
            data-testid="confirm-delete-asset-button"
            :aria-label="assetDeleteConfirmLabel"
            :title="assetDeleteConfirmLabel"
            @click="confirmAssetDelete"
          >
            Delete asset
          </button>
        </div>
      </div>
    </section>
  </main>
</template>

<script lang="ts">
let nextEditorShellToken = 0;
let activeEditorShellToken = 0;
</script>

<script setup lang="ts">
import { widgetCatalog, type EventBinding, type ProjectDoc, type WidgetNode } from "@hiveton-lvgl/schema";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { loadRuntime, SimulatorRuntimeError, type LvglRuntime } from "@hiveton-lvgl/lvgl-wasm-runtime";
import { getAuthToken } from "../api/auth";
import { downloadJobResult } from "../api/jobs";
import { useAssetsStore } from "../stores/assets";
import { useAuthStore } from "../stores/auth";
import { useJobsStore } from "../stores/jobs";
import { useProjectStore } from "../stores/project";
import { useSimulatorStore } from "../stores/simulator";
import AssetsPanel from "./AssetsPanel.vue";
import CanvasWorkspace, { type RenderedWidget } from "./CanvasWorkspace.vue";
import InspectorPanel, { type InspectorTab } from "./InspectorPanel.vue";
import IconGlyph from "./IconGlyph.vue";
import LayersPanel, { type LayerRow } from "./LayersPanel.vue";
import LogPanel from "./LogPanel.vue";
import PreviewOverlay from "./PreviewOverlay.vue";
import ScreensPanel from "./ScreensPanel.vue";
import SidebarNav, { type SidebarNavItem } from "./SidebarNav.vue";
import SimulatorPanel from "./SimulatorPanel.vue";
import StatusBar from "./StatusBar.vue";
import TopToolbar from "./TopToolbar.vue";
import WidgetPalette from "./WidgetPalette.vue";

const projectStore = useProjectStore();
const assetsStore = useAssetsStore();
const authStore = useAuthStore();
const jobsStore = useJobsStore();
const simulatorStore = useSimulatorStore();
const editorShellToken = ++nextEditorShellToken;
const project = computed(() => projectStore.project);
const activeScreen = computed(() => projectStore.activeScreen);
const selectedWidget = computed(() => projectStore.selectedWidget);
const authUser = computed(() => authStore.user);
const canBuildProject = computed(() => Boolean(authUser.value || getAuthToken()));
const layerRows = computed<LayerRow[]>(() => flattenLayerRows(activeScreen.value?.root.children ?? []));
const eventTargetRows = computed<LayerRow[]>(() =>
  activeScreen.value
    ? [{ widget: activeScreen.value.root, depth: 0, canMoveUp: false, canMoveDown: false }, ...layerRows.value]
    : layerRows.value
);
const renderedWidgets = computed<RenderedWidget[]>(() => {
  const screen = activeScreen.value;
  if (!screen) {
    return [];
  }
  return flattenRenderedWidgetsForParent(screen.root, {
    x: 0,
    y: 0,
    width: screen.root.layout.width,
    height: screen.root.layout.height
  });
});
const imageAssets = computed(() => project.value.assets.filter((asset) => asset.kind === "image"));
const fontAssets = computed(() => project.value.assets.filter((asset) => asset.kind === "font"));
const assetUsageCounts = computed(() => {
  const usage: Record<string, number> = {};
  for (const screen of project.value.screens) {
    countAssetUsage(screen.root, usage);
  }
  return usage;
});
const saveStateLabel = computed(() => {
  if (projectStore.saveState === "saving") {
    return "Saving...";
  }
  if (projectStore.saveState === "failed") {
    return "Save failed";
  }
  if (projectStore.dirty) {
    return "Unsaved changes";
  }
  return "All changes saved";
});
const persistenceLabel = computed(() => {
  if (!authUser.value) {
    return "Local project";
  }
  if (projectStore.saveState === "failed") {
    return "Cloud save unavailable";
  }
  if (project.value.id === "project-watch-demo") {
    return "Cloud project not created";
  }
  return "Project saved to cloud";
});
const selectedEvents = computed(() =>
  project.value.events.filter((event) => event.widgetId === selectedWidget.value?.id)
);
const hasDuplicateScreenNames = computed(() => {
  const names = project.value.screens.map((screen) => screen.name.trim()).filter(Boolean);
  return new Set(names).size !== names.length;
});
const timelineItems = computed(() => [
  ...project.value.screens.map((screen) => ({
    id: `screen-${screen.id}`,
    kind: "Screen",
    label: screen.name,
    status: screen.id === activeScreen.value?.id ? "active" : "available"
  })),
  ...project.value.events.map((event) => ({
    id: `event-${event.id}`,
    kind: "Event",
    label: `${event.event} -> ${event.handlerName}`,
    status: event.widgetId === selectedWidget.value?.id ? "selected" : "bound"
  })),
  ...projectStore.historyEntries.slice(-12).reverse().map((entry) => ({
    id: `history-${entry.id}`,
    kind: "Command",
    label: entry.label,
    status: entry.status
  }))
]);
const combinedLogEntries = computed(() => [...logEntries.value, ...jobsStore.logEntries]);
const latestActivityMessage = computed(() => {
  const visibleEntries = combinedLogEntries.value.filter((entry) =>
    entry.id !== "log-preview-updated" &&
    entry.id !== "log-simulator-render" &&
    entry.id !== "log-simulator-loaded"
  );
  if (!authUser.value) {
    const signedOutIndex = lastEntryIndex(visibleEntries, "log-auth-signed-out");
    const signedInIndex = lastEntryIndex(visibleEntries, "log-auth-login");
    if (signedOutIndex > signedInIndex) {
      const afterSignOut = visibleEntries.slice(signedOutIndex + 1);
      const hasNewUserFacingActivity = afterSignOut.some((entry) => entry.id !== "log-project-saved");
      if (!hasNewUserFacingActivity) {
        return visibleEntries[signedOutIndex]?.message ?? "Signed out; local editing remains";
      }
    }
  }
  const latest = [...visibleEntries].reverse().at(0);
  return latest?.message ?? "Editor ready";
});
const eventType = ref<EventBinding["event"]>("LV_EVENT_CLICKED");
const eventHandler = ref("on_time_clicked");
const eventTargetWidgetId = ref("time-label");
const simulatorCanvas = ref<HTMLCanvasElement | null>(null);
const editorShellRef = ref<HTMLElement | null>(null);
const artboardRef = ref<HTMLElement | null>(null);
const simulatorRuntime = ref<LvglRuntime | null>(null);
const autosaveTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const simulatorRenderTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const activeCenterPanel = ref<"canvas" | "code" | "settings">("canvas");
const activeNavItem = ref<SidebarNavItem>("widgets");
const activeInspectorTab = ref<InspectorTab>("style");
const codeCopyStatus = ref("Ready to copy");
const bottomLogTab = ref<"log" | "timeline">("log");
const bottomDockCollapsed = ref(false);
const bottomDockHeight = ref(248);
const bottomDockUserSized = ref(false);
const draggedLayerWidgetId = ref<string | null>(null);
const inspectorErrors = ref<Record<string, string>>({});
const exportDownloadUrl = computed(() => jobsStore.exportDownloadUrl);
const buildStatus = computed(() => jobsStore.buildStatus);
const simulatorStatus = computed(() => simulatorStore.status);
const simulatorMessage = computed(() => simulatorStore.message);
const simulatorVisible = ref(true);
const simulatorBackground = ref<"dark" | "light">("dark");
const simulatorScreenshotUrl = ref<string | null>(null);
const previewOpen = ref(false);
const previewReturnFocusElement = ref<HTMLElement | null>(null);
const previewScreenshotUrl = ref<string | null>(null);
const previewStatusMessage = ref("Live preview ready");
const pendingAssetDelete = ref<null | { assetId: string; name: string; usageCount: number }>(null);
const assetDeleteCancelLabel = computed(() =>
  pendingAssetDelete.value ? `Cancel deleting ${pendingAssetDelete.value.name} asset` : "Cancel deleting asset"
);
const assetDeleteConfirmLabel = computed(() =>
  pendingAssetDelete.value ? `Delete ${pendingAssetDelete.value.name} asset` : "Delete asset"
);
const newProjectDialogOpen = ref(false);
const newProjectReturnFocusElement = ref<HTMLElement | null>(null);
const assetDeleteReturnFocusElement = ref<HTMLElement | null>(null);
const newProjectName = ref("Untitled LVGL UI");
const newProjectNameError = ref<string | null>(null);
const newProjectNameInput = ref<HTMLInputElement | null>(null);
const newProjectConfirmLabel = computed(() => {
  const name = newProjectName.value.trim();
  return name ? `Create ${name} cloud project` : "Create cloud project";
});
const assetDeleteCancelButton = ref<HTMLButtonElement | null>(null);
const simulatorWasmModuleUrl = import.meta.env.VITE_LVGL_WASM_MODULE_URL?.trim() || undefined;
const zoomLevels = [25, 50, 75, 100, 150, 200];
const zoomPercent = ref(100);
const gridEnabled = ref(true);
const snapEnabled = ref(true);
const spacePanActive = ref(false);
const canvasPan = ref({ x: 0, y: 0 });
const alignmentGuides = ref<{ vertical: number[]; horizontal: number[] }>({ vertical: [], horizontal: [] });
const mouseCoordinates = ref({ x: 0, y: 0 });
const bottomDockEffectiveHeight = computed(() =>
  activeNavItem.value === "resources" && !bottomDockUserSized.value ? 376 : bottomDockHeight.value
);
const bottomDockStyle = computed(() => ({
  "--bottom-dock-height": bottomDockCollapsed.value ? "36px" : `${bottomDockEffectiveHeight.value}px`
}));
const bottomDockCollapseLabel = computed(() =>
  bottomDockCollapsed.value ? "Expand console simulator and build dock" : "Collapse console simulator and build dock"
);
const bottomDockHeightValueText = computed(() => `Bottom dock height ${bottomDockEffectiveHeight.value} pixels`);
const interaction = ref<null | {
  mode: "move" | "resize" | "pan";
  widgetId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}>(null);
const bottomDockResize = ref<null | {
  startY: number;
  startHeight: number;
}>(null);

const targetLabel = computed(
  () => `${project.value.target.deviceName} (${project.value.target.width}x${project.value.target.height})`
);
const artboardStyle = computed(() => ({
  width: `${project.value.target.width}px`,
  height: `${project.value.target.height}px`,
  transform: `scale(${zoomPercent.value / 100})`
}));
const deviceSurfaceStyle = computed(() => ({
  background: activeScreen.value?.root.style.bgColor ?? "#101010"
}));
const canvasPanStyle = computed(() => ({
  transform: `translate(${canvasPan.value.x}px, ${canvasPan.value.y}px)`
}));
const rulerTopStyle = computed(() => ({
  width: `${project.value.target.width}px`
}));
const rulerLeftStyle = computed(() => ({
  height: `${project.value.target.height}px`
}));
const rulerXTicks = computed(() => rulerTicks(project.value.target.width));
const rulerYTicks = computed(() => rulerTicks(project.value.target.height));
const previewDeviceStyle = computed(() => ({
  width: `${project.value.target.width}px`,
  height: `${project.value.target.height}px`
}));

const codePreview = computed(() => generateCodePreview());

watch(codePreview, () => {
  codeCopyStatus.value = "Ready to copy";
});

const logEntries = ref([
  { id: "log-editor-ready", time: "10:21:05", message: "Editor ready" }
]);

onMounted(() => {
  activeEditorShellToken = editorShellToken;
  document.addEventListener("keydown", handleKeydown, { capture: true });
  document.addEventListener("keyup", handleKeyup, { capture: true });
  void mountSimulator();
});

onBeforeUnmount(() => {
  if (activeEditorShellToken === editorShellToken) {
    activeEditorShellToken = 0;
  }
  document.removeEventListener("keydown", handleKeydown, { capture: true });
  document.removeEventListener("keyup", handleKeyup, { capture: true });
  document.removeEventListener("mousemove", handleCanvasMouseMove);
  document.removeEventListener("mouseup", endCanvasInteraction);
  document.removeEventListener("mousemove", handleBottomDockResize);
  document.removeEventListener("mouseup", endBottomDockResize);
  if (autosaveTimer.value) {
    clearTimeout(autosaveTimer.value);
  }
  if (simulatorRenderTimer.value) {
    clearTimeout(simulatorRenderTimer.value);
  }
  simulatorRuntime.value?.destroy();
});

watch(
  project,
  () => {
    scheduleSimulatorRender();
    scheduleAutosave();
  },
  { deep: true }
);

watch(
  () => activeScreen.value?.id,
  () => {
    void renderSimulator();
  }
);

watch(
  selectedWidget,
  (widget) => {
    if (widget) {
      eventTargetWidgetId.value = widget.id;
    }
  },
  { immediate: true }
);

function previewProject(): void {
  previewReturnFocusElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  previewOpen.value = true;
  void nextTick(() => {
    (document.querySelector('[data-testid="preview-overlay"]') as HTMLElement | null)?.focus();
  });
  void renderSimulator();
  previewScreenshotUrl.value = null;
  previewStatusMessage.value = "Live preview ready";
  logEntries.value.push({
    id: `log-preview-${logEntries.value.length}`,
    time: "10:21:10",
    message: "Preview updated"
  });
}

function closePreview(): void {
  previewOpen.value = false;
  void nextTick(() => {
    previewReturnFocusElement.value?.focus();
    previewReturnFocusElement.value = null;
  });
}

function refreshPreview(): void {
  previewScreenshotUrl.value = null;
  previewStatusMessage.value = "Preview refreshed";
  void renderSimulator();
  appendLog("Preview updated", "10:21:10");
}

function capturePreviewScreenshot(): void {
  const canvas = simulatorCanvas.value;
  if (!canvas || typeof canvas.toDataURL !== "function") {
    previewStatusMessage.value = "Screenshot unavailable";
    appendLog("Preview screenshot unavailable", "10:21:10");
    return;
  }
  previewScreenshotUrl.value = canvas.toDataURL("image/png");
  previewStatusMessage.value = "Screenshot ready";
  appendLog("Preview screenshot ready", "10:21:10");
}

function refreshSimulatorPanel(): void {
  simulatorScreenshotUrl.value = null;
  void renderSimulator();
  appendLog("Simulator refreshed", "10:21:10");
}

function captureSimulatorScreenshot(): void {
  const canvas = simulatorCanvas.value;
  if (!canvas || typeof canvas.toDataURL !== "function") {
    appendLog("Simulator screenshot unavailable", "10:21:10");
    return;
  }
  simulatorScreenshotUrl.value = canvas.toDataURL("image/png");
  appendLog("Simulator screenshot ready", "10:21:10");
}

function toggleSimulatorBackground(): void {
  simulatorBackground.value = simulatorBackground.value === "dark" ? "light" : "dark";
  appendLog(`Simulator background ${simulatorBackground.value}`, "10:21:10");
}

async function requestSimulatorFullscreen(): Promise<void> {
  const canvas = simulatorCanvas.value as (HTMLCanvasElement & { requestFullscreen?: () => Promise<void> }) | null;
  if (!canvas?.requestFullscreen) {
    appendLog("Simulator fullscreen unavailable", "10:21:10");
    return;
  }
  try {
    await canvas.requestFullscreen();
    appendLog("Simulator fullscreen opened", "10:21:10");
  } catch (error) {
    appendLog(error instanceof Error ? `Simulator fullscreen failed: ${error.message}` : "Simulator fullscreen failed", "10:21:10");
  }
}

function handleSimulatorCanvasMounted(canvas: HTMLCanvasElement): void {
  simulatorCanvas.value = canvas;
  void mountSimulator();
}

function toggleSimulatorPanel(): void {
  simulatorVisible.value = !simulatorVisible.value;
  if (!simulatorVisible.value) {
    simulatorRuntime.value?.destroy();
    simulatorRuntime.value = null;
    simulatorCanvas.value = null;
    simulatorStore.markLoading("Simulator hidden");
  }
}

function toggleBottomDockCollapsed(): void {
  bottomDockCollapsed.value = !bottomDockCollapsed.value;
}

function startBottomDockResize(event: MouseEvent): void {
  event.preventDefault();
  bottomDockCollapsed.value = false;
  bottomDockResize.value = {
    startY: event.clientY,
    startHeight: bottomDockEffectiveHeight.value
  };
  document.addEventListener("mousemove", handleBottomDockResize);
  document.addEventListener("mouseup", endBottomDockResize);
}

function setBottomDockHeight(height: number): void {
  bottomDockCollapsed.value = false;
  bottomDockHeight.value = Math.min(420, Math.max(180, Math.round(height)));
  bottomDockUserSized.value = true;
}

function handleBottomDockResize(event: MouseEvent): void {
  const session = bottomDockResize.value;
  if (!session) {
    return;
  }
  const nextHeight = session.startHeight + session.startY - event.clientY;
  setBottomDockHeight(nextHeight);
}

function endBottomDockResize(): void {
  bottomDockResize.value = null;
  document.removeEventListener("mousemove", handleBottomDockResize);
  document.removeEventListener("mouseup", endBottomDockResize);
}

function handleBottomDockResizeKeydown(event: KeyboardEvent): void {
  const step = event.shiftKey ? 40 : 16;
  if (event.key === "ArrowUp") {
    event.preventDefault();
    setBottomDockHeight(bottomDockEffectiveHeight.value + step);
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    setBottomDockHeight(bottomDockEffectiveHeight.value - step);
    return;
  }
  if (event.key === "Home") {
    event.preventDefault();
    setBottomDockHeight(180);
    return;
  }
  if (event.key === "End") {
    event.preventDefault();
    setBottomDockHeight(420);
  }
}

function fitCanvasToView(): void {
  const stage = artboardRef.value?.closest(".canvas-stage");
  if (!stage) {
    return;
  }
  const bounds = stage.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) {
    return;
  }
  const fitPercent = Math.floor(Math.min(
    bounds.width / project.value.target.width,
    bounds.height / project.value.target.height
  ) * 100);
  const nextZoom = [...zoomLevels]
    .reverse()
    .find((level) => level <= fitPercent) ?? zoomLevels[0];
  zoomPercent.value = nextZoom;
  canvasPan.value = { x: 0, y: 0 };
}

async function requestCanvasFullscreen(): Promise<void> {
  const stage = artboardRef.value?.closest(".canvas-stage") as (HTMLElement & { requestFullscreen?: () => Promise<void> }) | null;
  if (!stage?.requestFullscreen) {
    appendLog("Canvas fullscreen unavailable", "10:21:10");
    return;
  }
  try {
    await stage.requestFullscreen();
    appendLog("Canvas fullscreen opened", "10:21:10");
  } catch (error) {
    appendLog(error instanceof Error ? `Canvas fullscreen failed: ${error.message}` : "Canvas fullscreen failed", "10:21:10");
  }
}

async function copyGeneratedCode(): Promise<void> {
  const code = codePreview.value;
  if (!code.trim()) {
    codeCopyStatus.value = "No code to copy";
    return;
  }
  codeCopyStatus.value = "Copying...";
  try {
    await writeClipboardText(code);
    codeCopyStatus.value = "Code copied";
    appendLog("Generated code copied to clipboard", "10:21:10");
  } catch (error) {
    codeCopyStatus.value = "Copy failed";
    appendLog(error instanceof Error ? `Copy code failed: ${error.message}` : "Copy code failed", "10:21:10");
  }
}

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("clipboard write timed out")), 1200);
      })
    ]);
    return;
  }
  if (copyTextWithSelection(text)) {
    return;
  }
  throw new Error("clipboard API unavailable");
}

function copyTextWithSelection(text: string): boolean {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  try {
    return document.execCommand("copy");
  } finally {
    textArea.remove();
  }
}

async function loginWithPassword(email: string, password: string): Promise<void> {
  await authStore.loginWithCredentials(email, password);
  if (authStore.user) {
    assetsStore.clearError();
  }
  logLoginResult();
}

async function loginDemo(): Promise<void> {
  await authStore.loginDemo();
  if (authStore.user) {
    assetsStore.clearError();
  }
  logLoginResult();
}

function logLoginResult(): void {
  if (authStore.user) {
    upsertLog("auth-login", "10:21:11", `Logged in as ${authStore.user.displayName}`);
    return;
  }
  upsertLog("auth-login-failed", "10:21:11", `Login failed: ${authStore.error ?? "unknown error"}`);
}

function addWidgetFromPalette(type: Exclude<WidgetNode["type"], "screen">): void {
  projectStore.addWidgetFromCatalog(type, { x: 24, y: 32 });
}

function dropWidgetOnCanvas(event: DragEvent): void {
  const rawType = event.dataTransfer?.getData("application/x-lvgl-widget") || event.dataTransfer?.getData("text/plain");
  const catalogItem = widgetCatalog.find((widget) => widget.type === rawType);
  const artboard = artboardRef.value;
  if (!catalogItem || !artboard) {
    return;
  }
  const rect = artboard.getBoundingClientRect();
  const scale = zoomPercent.value / 100;
  const canvasPoint = {
    x: Math.max(0, snapCanvasValue((event.clientX - rect.left) / scale)),
    y: Math.max(0, snapCanvasValue((event.clientY - rect.top) / scale))
  };
  const targetContainer = findDropContainer(canvasPoint.x, canvasPoint.y);
  projectStore.addWidgetFromCatalog(
    catalogItem.type,
    targetContainer
      ? {
          x: Math.max(0, canvasPoint.x - targetContainer.x),
          y: Math.max(0, canvasPoint.y - targetContainer.y)
        }
      : canvasPoint,
    targetContainer ? { parentId: targetContainer.widget.id } : undefined
  );
}

function updateMouseCoordinates(event: MouseEvent): void {
  const artboard = artboardRef.value;
  if (!artboard) {
    return;
  }
  const rect = artboard.getBoundingClientRect();
  const scale = zoomPercent.value / 100;
  mouseCoordinates.value = {
    x: Math.round((event.clientX - rect.left) / scale),
    y: Math.round((event.clientY - rect.top) / scale)
  };
}

function scheduleAutosave(): void {
  if (autosaveTimer.value) {
    clearTimeout(autosaveTimer.value);
  }
  autosaveTimer.value = setTimeout(() => {
    if (activeEditorShellToken !== editorShellToken) {
      return;
    }
    void saveProjectWithLog();
  }, 800);
}

function scheduleSimulatorRender(): void {
  if (simulatorRenderTimer.value) {
    clearTimeout(simulatorRenderTimer.value);
  }
  simulatorRenderTimer.value = setTimeout(() => {
    if (activeEditorShellToken !== editorShellToken) {
      return;
    }
    void renderSimulator();
  }, 500);
}

function openNewProjectDialog(): void {
  if (!getAuthToken()) {
    upsertLog("project-create-cloud-required", "10:21:11", "Sign in before creating cloud projects");
    return;
  }
  newProjectReturnFocusElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  newProjectName.value = "Untitled LVGL UI";
  newProjectNameError.value = null;
  newProjectDialogOpen.value = true;
  void nextTick(() => {
    newProjectNameInput.value?.focus();
  });
}

function closeNewProjectDialog(): void {
  newProjectDialogOpen.value = false;
  newProjectNameError.value = null;
  void nextTick(() => {
    newProjectReturnFocusElement.value?.focus();
    newProjectReturnFocusElement.value = null;
  });
}

function clearNewProjectNameError(): void {
  if (newProjectNameError.value && newProjectName.value.trim()) {
    newProjectNameError.value = null;
  }
}

async function createNewProject(): Promise<void> {
  const name = newProjectName.value.trim();
  if (!name) {
    newProjectNameError.value = "project name is required";
    return;
  }
  try {
    await projectStore.createCloudProject(name);
    await assetsStore.loadAssets(project.value.id);
    void renderSimulator();
    closeNewProjectDialog();
    logEntries.value.push({
      id: `log-project-created-${logEntries.value.length}`,
      time: "10:21:11",
      message: "Project created"
    });
  } catch (error) {
    logEntries.value.push({
      id: `log-project-create-error-${logEntries.value.length}`,
      time: "10:21:11",
      message: error instanceof Error ? error.message : "Project create failed"
    });
  }
}

async function loadProjectList(): Promise<void> {
  if (!getAuthToken()) {
    upsertLog("project-list-cloud-required", "10:21:11", "Sign in before loading cloud projects");
    return;
  }
  try {
    await projectStore.loadProjects();
    logEntries.value.push({
      id: `log-project-list-${logEntries.value.length}`,
      time: "10:21:11",
      message: "Project list loaded"
    });
  } catch (error) {
    logEntries.value.push({
      id: `log-project-list-error-${logEntries.value.length}`,
      time: "10:21:11",
      message: error instanceof Error ? error.message : "Project list failed"
    });
  }
}

async function openProject(projectId: string): Promise<void> {
  if (!projectId || projectId === project.value.id) {
    return;
  }
  try {
    await projectStore.openProject(projectId);
    await assetsStore.loadAssets(projectId);
    void renderSimulator();
    logEntries.value.push({
      id: `log-project-opened-${logEntries.value.length}`,
      time: "10:21:11",
      message: "Project opened"
    });
  } catch (error) {
    logEntries.value.push({
      id: `log-project-open-error-${logEntries.value.length}`,
      time: "10:21:11",
      message: error instanceof Error ? error.message : "Project open failed"
    });
  }
}

async function buildProject(): Promise<void> {
  if (!jobsStore.beginSaving()) {
    return;
  }
  try {
    if (autosaveTimer.value) {
      clearTimeout(autosaveTimer.value);
      autosaveTimer.value = null;
    }
    const saved = await saveProjectWithLog();
    if (!saved) {
      throw new Error("Build stopped because project save failed");
    }
    if (isLocalOnlyProject()) {
      throw new Error("Sign in before Build to create a cloud project and export C code");
    }
    if (autosaveTimer.value) {
      clearTimeout(autosaveTimer.value);
      autosaveTimer.value = null;
    }
    await jobsStore.startExport(project.value.id);
  } catch (error) {
    jobsStore.markFailed(error instanceof Error ? error.message : "Build failed");
  }
}

async function downloadExportZip(): Promise<void> {
  if (!exportDownloadUrl.value) {
    return;
  }
  try {
    const archive = await downloadJobResult(exportDownloadUrl.value);
    if (typeof URL.createObjectURL !== "function") {
      throw new Error("Download is not available in this browser");
    }
    const objectUrl = URL.createObjectURL(archive);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${project.value.name.replace(/[^a-z0-9_-]+/gi, "_") || "lvgl-ui"}-export.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL?.(objectUrl);
    }, 1000);
    upsertLog("export-downloaded", "10:21:12", "Export zip downloaded");
  } catch (error) {
    upsertLog("export-download-failed", "10:21:12", error instanceof Error ? error.message : "Export download failed");
  }
}

async function saveProjectWithLog(): Promise<boolean> {
  const saved = await projectStore.saveProject();
  if (saved) {
    upsertLog("project-saved", "10:21:11", "Project saved");
    return true;
  }
  upsertLog("project-save-failed", "10:21:11", `Project save failed: ${projectStore.saveError ?? "unknown error"}`);
  return false;
}

function logoutUser(): void {
  authStore.logout();
  assetsStore.clearError();
  upsertLog("auth-signed-out", "10:21:12", "Signed out; local editing remains");
}

function lastEntryIndex(entries: Array<{ id: string }>, id: string): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (entries[index]?.id === id) {
      return index;
    }
  }
  return -1;
}

function widgetText(widget: WidgetNode): string {
  if (widget.type === "image") {
    const assetId = String(widget.props.assetId ?? "");
    const asset = project.value.assets.find((item) => item.id === assetId);
    return asset?.name ?? widget.name;
  }
  return String(widget.props.text ?? widget.name);
}

function imagePreviewUrl(widget: WidgetNode): string | null {
  if (widget.type !== "image") {
    return null;
  }
  const assetId = String(widget.props.assetId ?? "");
  return assetsStore.previewUrls[assetId] ?? null;
}

function widgetStyle(item: RenderedWidget): Record<string, string> {
  const widget = item.widget;
  const padding = widget.style.padding;
  const opacity = widget.style.opacity === undefined ? 1 : widget.style.opacity / 100;
  return {
    left: `${item.x}px`,
    top: `${item.y}px`,
    width: `${widget.layout.width}px`,
    height: `${widget.layout.height}px`,
    color: widget.style.textColor ?? "#FFFFFF",
    backgroundColor: widget.style.bgColor ?? "",
    borderColor: widget.style.borderColor ?? "",
    borderRadius: `${widget.style.radius ?? 0}px`,
    opacity: `${opacity}`,
    padding: padding
      ? `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`
      : "0px",
    textAlign: widget.style.align ?? "center",
    letterSpacing: `${widget.style.letterSpace ?? 0}px`,
    lineHeight: widget.style.lineSpace ? `${Math.max(1, widget.layout.height + widget.style.lineSpace)}px` : "normal"
  };
}

function flattenLayerRows(widgets: WidgetNode[], depth = 0): LayerRow[] {
  return widgets.flatMap((widget, index) => [
    {
      widget,
      depth,
      canMoveUp: index > 0,
      canMoveDown: index < widgets.length - 1
    },
    ...flattenLayerRows(widget.children, depth + 1)
  ]);
}

type RenderRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RenderedWidgetBounds = RenderedWidget & {
  width: number;
  height: number;
};

function flattenRenderedWidgetsForParent(parent: WidgetNode, parentBounds: RenderRect): RenderedWidget[] {
  return resolveChildRenderBounds(parent, parentBounds).flatMap((item) => {
    if (item.widget.hidden) {
      return [];
    }
    return [
      { widget: item.widget, x: item.x, y: item.y },
      ...flattenRenderedWidgetsForParent(item.widget, item)
    ];
  });
}

function resolveChildRenderBounds(parent: WidgetNode, parentBounds: RenderRect): RenderedWidgetBounds[] {
  if (parent.layout.flex) {
    return resolveFlexChildRenderBounds(parent, parentBounds);
  }
  return parent.children.map((widget) => ({
    widget,
    ...resolveAlignedRenderBounds(widget, parentBounds)
  }));
}

function resolveFlexChildRenderBounds(parent: WidgetNode, parentBounds: RenderRect): RenderedWidgetBounds[] {
  const flex = parent.layout.flex;
  if (!flex) {
    return [];
  }
  const content = renderContentRectFor(parent, parentBounds);
  const isRow = flex.direction === "row";
  const mainLimit = isRow ? content.width : content.height;
  let cursorMain = 0;
  let cursorCross = 0;
  let lineCross = 0;
  return parent.children.map((widget) => {
    const width = widget.layout.width;
    const height = widget.layout.height;
    const childMain = isRow ? width : height;
    const childCross = isRow ? height : width;
    if (flex.wrap && cursorMain > 0 && cursorMain + childMain > mainLimit) {
      cursorMain = 0;
      cursorCross += lineCross + flex.gap;
      lineCross = 0;
    }
    const x = isRow ? content.x + cursorMain : content.x + cursorCross;
    const y = isRow ? content.y + cursorCross : content.y + cursorMain;
    cursorMain += childMain + flex.gap;
    lineCross = Math.max(lineCross, childCross);
    return { widget, x, y, width, height };
  });
}

function resolveAlignedRenderBounds(widget: WidgetNode, parentBounds: RenderRect): RenderRect {
  const { width, height } = widget.layout;
  const offsetX = widget.layout.x;
  const offsetY = widget.layout.y;
  switch (widget.layout.align) {
    case "top-right":
      return { x: parentBounds.x + parentBounds.width - width - offsetX, y: parentBounds.y + offsetY, width, height };
    case "center":
      return {
        x: parentBounds.x + (parentBounds.width - width) / 2 + offsetX,
        y: parentBounds.y + (parentBounds.height - height) / 2 + offsetY,
        width,
        height
      };
    case "bottom-left":
      return { x: parentBounds.x + offsetX, y: parentBounds.y + parentBounds.height - height - offsetY, width, height };
    case "bottom-right":
      return {
        x: parentBounds.x + parentBounds.width - width - offsetX,
        y: parentBounds.y + parentBounds.height - height - offsetY,
        width,
        height
      };
    case "top-left":
    default:
      return { x: parentBounds.x + offsetX, y: parentBounds.y + offsetY, width, height };
  }
}

function renderContentRectFor(widget: WidgetNode, bounds: RenderRect): RenderRect {
  const padding = widget.style.padding;
  if (!padding) {
    return bounds;
  }
  return {
    x: bounds.x + padding.left,
    y: bounds.y + padding.top,
    width: Math.max(0, bounds.width - padding.left - padding.right),
    height: Math.max(0, bounds.height - padding.top - padding.bottom)
  };
}

function countAssetUsage(widget: WidgetNode, usage: Record<string, number>): void {
  const assetId = widget.props.assetId;
  if (widget.type === "image" && typeof assetId === "string" && assetId) {
    usage[assetId] = (usage[assetId] ?? 0) + 1;
  }
  if (typeof widget.style.font === "string" && widget.style.font) {
    usage[widget.style.font] = (usage[widget.style.font] ?? 0) + 1;
  }
  for (const child of widget.children) {
    countAssetUsage(child, usage);
  }
}

function findDropContainer(x: number, y: number): RenderedWidget | null {
  const containers = renderedWidgets.value
    .filter((item) => item.widget.type === "container" && !item.widget.locked)
    .reverse();
  return containers.find((item) =>
    x >= item.x &&
    y >= item.y &&
    x <= item.x + item.widget.layout.width &&
    y <= item.y + item.widget.layout.height
  ) ?? null;
}

function toTestId(name: string): string {
  return name.toLowerCase().replace(/_/g, "-");
}

function rulerTicks(length: number): number[] {
  const ticks: number[] = [];
  for (let tick = 0; tick <= length; tick += 80) {
    ticks.push(tick);
  }
  if (ticks[ticks.length - 1] !== length) {
    ticks.push(length);
  }
  return ticks;
}

function updateLayoutNumber(field: "x" | "y" | "width" | "height", rawValue: string): void {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    setInspectorError(field, `${field} must be a number`);
    return;
  }
  if ((field === "width" || field === "height") && value <= 0) {
    setInspectorError(field, `${field} must be greater than 0`);
    return;
  }
  clearInspectorError(field);
  projectStore.updateSelectedLayout({ [field]: value });
}

function updateLayoutAlign(value: string): void {
  if (value === "top-left" || value === "top-right" || value === "center" || value === "bottom-left" || value === "bottom-right") {
    projectStore.updateSelectedLayoutMeta({ align: value });
  }
}

function updateFlexDirection(value: string): void {
  if (!canEditSelectedFlex()) {
    return;
  }
  if (value !== "row" && value !== "column") {
    return;
  }
  projectStore.updateSelectedLayoutMeta({
    flex: {
      direction: value,
      gap: selectedWidget.value?.layout.flex?.gap ?? 0,
      wrap: selectedWidget.value?.layout.flex?.wrap ?? false
    }
  });
}

function updateFlexGap(rawValue: string): void {
  if (!canEditSelectedFlex()) {
    return;
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    setInspectorError("gap", "gap must be a number");
    return;
  }
  if (value < 0) {
    setInspectorError("gap", "gap must be non-negative");
    return;
  }
  clearInspectorError("gap");
  projectStore.updateSelectedLayoutMeta({
    flex: {
      direction: selectedWidget.value?.layout.flex?.direction ?? "row",
      gap: value,
      wrap: selectedWidget.value?.layout.flex?.wrap ?? false
    }
  });
}

function updateFlexWrap(wrap: boolean): void {
  if (!canEditSelectedFlex()) {
    return;
  }
  projectStore.updateSelectedLayoutMeta({
    flex: {
      direction: selectedWidget.value?.layout.flex?.direction ?? "row",
      gap: selectedWidget.value?.layout.flex?.gap ?? 0,
      wrap
    }
  });
}

function canEditSelectedFlex(): boolean {
  return selectedWidget.value?.type === "container" || selectedWidget.value?.type === "screen";
}

function renameSelectedWidget(name: string): void {
  if (!selectedWidget.value) {
    return;
  }
  projectStore.renameWidget(selectedWidget.value.id, name);
}

function renameLayerWidget(widgetId: string, name: string): void {
  projectStore.selectWidget(widgetId);
  projectStore.renameWidget(widgetId, name);
}

function startMove(widget: WidgetNode, event: MouseEvent): void {
  if (widget.locked) {
    return;
  }
  projectStore.selectWidget(widget.id);
  interaction.value = {
    mode: "move",
    widgetId: widget.id,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: widget.layout.x,
    startY: widget.layout.y,
    startWidth: widget.layout.width,
    startHeight: widget.layout.height
  };
  document.addEventListener("mousemove", handleCanvasMouseMove);
  document.addEventListener("mouseup", endCanvasInteraction);
}

function startResize(widget: WidgetNode, event: MouseEvent): void {
  if (widget.locked) {
    return;
  }
  projectStore.selectWidget(widget.id);
  interaction.value = {
    mode: "resize",
    widgetId: widget.id,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: widget.layout.x,
    startY: widget.layout.y,
    startWidth: widget.layout.width,
    startHeight: widget.layout.height
  };
  document.addEventListener("mousemove", handleCanvasMouseMove);
  document.addEventListener("mouseup", endCanvasInteraction);
}

function handleCanvasMouseMove(event: MouseEvent): void {
  const session = interaction.value;
  if (!session) {
    return;
  }
  if (session.mode === "pan") {
    canvasPan.value = {
      x: session.startX + event.clientX - session.startClientX,
      y: session.startY + event.clientY - session.startClientY
    };
    return;
  }
  projectStore.selectWidget(session.widgetId);
  const scale = zoomPercent.value / 100;
  const deltaX = (event.clientX - session.startClientX) / scale;
  const deltaY = (event.clientY - session.startClientY) / scale;
  if (session.mode === "move") {
    const nextLayout = alignmentAdjustedLayout(session.widgetId, {
      x: snapCanvasValue(session.startX + deltaX),
      y: snapCanvasValue(session.startY + deltaY),
      width: session.startWidth,
      height: session.startHeight
    }, "move");
    projectStore.updateSelectedLayout({
      x: nextLayout.x,
      y: nextLayout.y
    });
    return;
  }
  const nextLayout = alignmentAdjustedLayout(session.widgetId, {
    x: session.startX,
    y: session.startY,
    width: Math.max(1, snapCanvasValue(session.startWidth + deltaX)),
    height: Math.max(1, snapCanvasValue(session.startHeight + deltaY))
  }, "resize");
  projectStore.updateSelectedLayout({
    width: nextLayout.width,
    height: nextLayout.height
  });
}

function snapCanvasValue(value: number): number {
  if (!snapEnabled.value) {
    return Math.round(value);
  }
  return Math.round(value / 8) * 8;
}

function alignmentAdjustedLayout(
  widgetId: string,
  layout: { x: number; y: number; width: number; height: number },
  mode: "move" | "resize"
): { x: number; y: number; width: number; height: number } {
  if (!snapEnabled.value) {
    alignmentGuides.value = { vertical: [], horizontal: [] };
    return layout;
  }
  const threshold = 4;
  const verticalTargets = alignmentTargets("x", widgetId);
  const horizontalTargets = alignmentTargets("y", widgetId);
  const verticalSnap = snapAxis(layout.x, layout.width, verticalTargets, threshold, mode);
  const horizontalSnap = snapAxis(layout.y, layout.height, horizontalTargets, threshold, mode);
  alignmentGuides.value = {
    vertical: verticalSnap.guide === null ? [] : [verticalSnap.guide],
    horizontal: horizontalSnap.guide === null ? [] : [horizontalSnap.guide]
  };
  return {
    x: mode === "move" ? verticalSnap.start : layout.x,
    y: mode === "move" ? horizontalSnap.start : layout.y,
    width: mode === "resize" ? Math.max(1, verticalSnap.size) : layout.width,
    height: mode === "resize" ? Math.max(1, horizontalSnap.size) : layout.height
  };
}

function alignmentTargets(axis: "x" | "y", excludedWidgetId: string): number[] {
  const targetSize = axis === "x" ? project.value.target.width : project.value.target.height;
  const targets = new Set<number>([0, Math.round(targetSize / 2), targetSize]);
  for (const item of renderedWidgets.value) {
    if (item.widget.id === excludedWidgetId) {
      continue;
    }
    const start = axis === "x" ? item.x : item.y;
    const size = axis === "x" ? item.widget.layout.width : item.widget.layout.height;
    targets.add(start);
    targets.add(Math.round(start + size / 2));
    targets.add(start + size);
  }
  return [...targets];
}

function snapAxis(
  start: number,
  size: number,
  targets: number[],
  threshold: number,
  mode: "move" | "resize"
): { start: number; size: number; guide: number | null } {
  const candidates = mode === "move"
    ? [
        { value: start, kind: "start" as const },
        { value: start + size / 2, kind: "center" as const },
        { value: start + size, kind: "end" as const }
      ]
    : [{ value: start + size, kind: "end" as const }];
  let best: { distance: number; target: number; kind: "start" | "center" | "end" } | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    for (const target of targets) {
      const distance = Math.abs(candidate.value - target);
      const score = distance + (candidate.kind === "center" ? -2 : 0);
      if (distance <= threshold && score < bestScore) {
        bestScore = score;
        best = { distance, target, kind: candidate.kind };
      }
    }
  }
  if (!best) {
    return { start, size, guide: null };
  }
  if (mode === "resize") {
    return { start, size: best.target - start, guide: best.target };
  }
  if (best.kind === "center") {
    return { start: best.target - size / 2, size, guide: best.target };
  }
  if (best.kind === "end") {
    return { start: best.target - size, size, guide: best.target };
  }
  return { start: best.target, size, guide: best.target };
}

function endCanvasInteraction(): void {
  interaction.value = null;
  alignmentGuides.value = { vertical: [], horizontal: [] };
  document.removeEventListener("mousemove", handleCanvasMouseMove);
  document.removeEventListener("mouseup", endCanvasInteraction);
}

function startCanvasPan(event: MouseEvent): void {
  if (event.button !== 1 && !event.shiftKey && !spacePanActive.value) {
    return;
  }
  event.preventDefault();
  interaction.value = {
    mode: "pan",
    widgetId: "canvas",
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: canvasPan.value.x,
    startY: canvasPan.value.y,
    startWidth: 0,
    startHeight: 0
  };
  document.addEventListener("mousemove", handleCanvasMouseMove);
  document.addEventListener("mouseup", endCanvasInteraction);
}

function updateStyleText(field: "textColor" | "bgColor" | "borderColor", value: string): void {
  projectStore.updateSelectedStyle({ [field]: value });
}

function updateStyleNumber(field: "opacity" | "radius" | "letterSpace" | "lineSpace", rawValue: string): void {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    setInspectorError(field, `${field} must be a number`);
    return;
  }
  if (field === "opacity" && (value < 0 || value > 100)) {
    setInspectorError(field, "opacity must be between 0 and 100");
    return;
  }
  if (field === "radius" && value < 0) {
    setInspectorError(field, "radius must be non-negative");
    return;
  }
  clearInspectorError(field);
  projectStore.updateSelectedStyle({ [field]: value });
}

function updateStyleFont(font: string): void {
  projectStore.updateSelectedStyle({ font });
}

function updateStyleAlign(value: string): void {
  if (value === "left" || value === "center" || value === "right") {
    projectStore.updateSelectedStyle({ align: value });
  }
}

function updatePropNumber(field: string, rawValue: string): void {
  const value = Number(rawValue);
  const errorField = propErrorField(field);
  if (!Number.isFinite(value)) {
    setInspectorError(errorField, `${field} must be a number`);
    return;
  }
  if ((field === "spinTime" || field === "arcLength" || field === "pointCount") && value <= 0) {
    setInspectorError(errorField, `${field} must be greater than 0`);
    return;
  }
  if ((field === "selected" || field === "value") && value < 0) {
    setInspectorError(errorField, `${field} must be non-negative`);
    return;
  }
  clearInspectorError(errorField);
  projectStore.updateSelectedProps({ [field]: value });
}

function propErrorField(field: string): string {
  return `prop-${field.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`;
}

function updatePropText(field: string, value: string): void {
  projectStore.updateSelectedProps({ [field]: value });
}

function updatePropChecked(checked: boolean): void {
  projectStore.updateSelectedProps({ checked });
}

function updateChartValues(rawValue: string): void {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    setInspectorError("prop-values", "values must contain at least one number");
    return;
  }
  const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
  const values = tokens.map((token) => Number(token));
  if (!values.length || values.some((value) => !Number.isFinite(value))) {
    setInspectorError("prop-values", "values must be comma, space or newline separated numbers");
    return;
  }
  clearInspectorError("prop-values");
  projectStore.updateSelectedProps({ values, pointCount: values.length });
}

function updatePaddingSide(side: "top" | "right" | "bottom" | "left", rawValue: string): void {
  const value = Number(rawValue);
  const errorField = `padding-${side}`;
  if (!Number.isFinite(value)) {
    setInspectorError(errorField, `padding ${side} must be a number`);
    return;
  }
  if (value < 0) {
    setInspectorError(errorField, `padding ${side} must be non-negative`);
    return;
  }
  clearInspectorError(errorField);
  const currentPadding = selectedWidget.value?.style.padding ?? {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
  projectStore.updateSelectedStyle({
    padding: {
      ...currentPadding,
      [side]: value
    }
  });
}

function setInspectorError(field: string, message: string): void {
  inspectorErrors.value = {
    ...inspectorErrors.value,
    [field]: message
  };
}

function clearInspectorError(field: string): void {
  const { [field]: _removed, ...remaining } = inspectorErrors.value;
  inspectorErrors.value = remaining;
}

function updateTargetNumber(field: "width" | "height" | "dpi", rawValue: string): void {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    setInspectorError(`target-${field}`, `${field} must be a number`);
    return;
  }
  if (value <= 0) {
    setInspectorError(`target-${field}`, `${field} must be greater than 0`);
    return;
  }
  clearInspectorError(`target-${field}`);
  projectStore.updateTarget({ [field]: value });
}

function updateTargetColorDepth(rawValue: string): void {
  const value = Number(rawValue);
  if (value !== 16 && value !== 32) {
    return;
  }
  projectStore.updateTarget({ colorDepth: value });
}

function updateTargetDeviceName(rawValue: string): void {
  const value = rawValue.trim();
  if (!value) {
    setInspectorError("target-device-name", "deviceName is required");
    return;
  }
  clearInspectorError("target-device-name");
  projectStore.updateTarget({ deviceName: value });
}

function updateTargetLvglVersion(value: string): void {
  if (value === "8.3") {
    projectStore.updateTarget({ lvglVersion: value });
  }
}

function activateNav(item: SidebarNavItem): void {
  activeNavItem.value = item;
  if (item === "code" || item === "settings") {
    activeCenterPanel.value = item;
    return;
  }
  activeCenterPanel.value = "canvas";
}

function generateCodePreview(): string {
  const screen = activeScreen.value;
  if (!screen) {
    return "";
  }
  const screenSymbol = lvglSymbol(screen.name);
  const lines = [`lv_obj_t * ${screenSymbol};`, ``, `void ${screenSymbol}_screen_init(void) {`, `    ${screenSymbol} = lv_obj_create(NULL);`];
  appendLayoutPreview(lines, screenSymbol, screen.root.layout);
  appendEventPreview(lines, screenSymbol, screen.root);
  for (const widget of screen.root.children) {
    appendWidgetPreview(lines, widget, screenSymbol);
  }
  lines.push("}");
  appendEventCallbackStubs(lines, screen.root);
  return lines.join("\n");
}

function appendWidgetPreview(lines: string[], widget: WidgetNode, parentSymbol: string): void {
  const symbol = lvglSymbol(widget.name);
  lines.push(`    ${symbol} = ${createCallForPreview(widget, parentSymbol)};`);
  lines.push(`    lv_obj_set_pos(${symbol}, ${widget.layout.x}, ${widget.layout.y});`);
  lines.push(`    lv_obj_set_size(${symbol}, ${widget.layout.width}, ${widget.layout.height});`);
  appendLayoutPreview(lines, symbol, widget.layout);
  if (widget.type === "label" && typeof widget.props.text === "string") {
    lines.push(`    lv_label_set_text(${symbol}, ${JSON.stringify(widget.props.text)});`);
  }
  if (widget.type === "button" && typeof widget.props.text === "string") {
    const labelSymbol = `${symbol}_Label`;
    lines.push(`    ${labelSymbol} = lv_label_create(${symbol});`);
    lines.push(`    lv_label_set_text(${labelSymbol}, ${JSON.stringify(widget.props.text)});`);
    lines.push(`    lv_obj_center(${labelSymbol});`);
  }
  appendImagePreview(lines, symbol, widget);
  appendWidgetPropertyPreview(lines, symbol, widget);
  appendStylePreview(lines, symbol, widget);
  appendEventPreview(lines, symbol, widget);
  if (widget.hidden) {
    lines.push(`    lv_obj_add_flag(${symbol}, LV_OBJ_FLAG_HIDDEN);`);
  }
  for (const child of widget.children) {
    appendWidgetPreview(lines, child, symbol);
  }
}

function appendLayoutPreview(lines: string[], symbol: string, layout: WidgetNode["layout"]): void {
  if (layout.align) {
    lines.push(`    lv_obj_align(${symbol}, ${lvglAlignConstant(layout.align)}, ${layout.x}, ${layout.y});`);
  }
  if (layout.flex) {
    lines.push(`    lv_obj_set_layout(${symbol}, LV_LAYOUT_FLEX);`);
    lines.push(`    lv_obj_set_flex_flow(${symbol}, ${lvglFlexFlowConstant(layout.flex)});`);
    if (layout.flex.gap !== 0) {
      lines.push(`    lv_obj_set_style_pad_row(${symbol}, ${layout.flex.gap}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
      lines.push(`    lv_obj_set_style_pad_column(${symbol}, ${layout.flex.gap}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
    }
  }
}

function appendImagePreview(lines: string[], symbol: string, widget: WidgetNode): void {
  if (widget.type !== "image" || typeof widget.props.assetId !== "string") {
    return;
  }
  const asset = project.value.assets.find((item) => item.id === widget.props.assetId);
  const assetSymbol = asset ? assetSymbolForPreview(asset.name) : assetSymbolForPreview(widget.props.assetId);
  lines.push(`    lv_img_set_src(${symbol}, &${assetSymbol});`);
}

function appendWidgetPropertyPreview(lines: string[], symbol: string, widget: WidgetNode): void {
  switch (widget.type) {
    case "slider":
    case "bar":
      lines.push(`    lv_${widget.type}_set_range(${symbol}, ${numberProp(widget, "min", 0)}, ${numberProp(widget, "max", 100)});`);
      lines.push(`    lv_${widget.type}_set_value(${symbol}, ${numberProp(widget, "value", 0)}, LV_ANIM_OFF);`);
      break;
    case "arc":
      lines.push(`    lv_arc_set_range(${symbol}, ${numberProp(widget, "min", 0)}, ${numberProp(widget, "max", 100)});`);
      lines.push(`    lv_arc_set_value(${symbol}, ${numberProp(widget, "value", 0)});`);
      break;
    case "checkbox":
      if (typeof widget.props.text === "string") {
        lines.push(`    lv_checkbox_set_text(${symbol}, ${JSON.stringify(widget.props.text)});`);
      }
      if (widget.props.checked === true) {
        lines.push(`    lv_obj_add_state(${symbol}, LV_STATE_CHECKED);`);
      }
      break;
    case "switch":
      if (widget.props.checked === true) {
        lines.push(`    lv_obj_add_state(${symbol}, LV_STATE_CHECKED);`);
      }
      break;
    case "dropdown":
      if (typeof widget.props.options === "string") {
        lines.push(`    lv_dropdown_set_options(${symbol}, ${JSON.stringify(widget.props.options)});`);
      }
      lines.push(`    lv_dropdown_set_selected(${symbol}, ${numberProp(widget, "selected", 0)});`);
      break;
    case "line":
      lines.push(`    static lv_point_t ${symbol}_points[] = {{0, 0}, {${widget.layout.width}, ${widget.layout.height}}};`);
      lines.push(`    lv_line_set_points(${symbol}, ${symbol}_points, 2);`);
      break;
    case "chart":
      lines.push(`    lv_chart_set_range(${symbol}, LV_CHART_AXIS_PRIMARY_Y, ${numberProp(widget, "min", 0)}, ${numberProp(widget, "max", 100)});`);
      lines.push(`    lv_chart_set_point_count(${symbol}, ${numberProp(widget, "pointCount", 8)});`);
      lines.push(`    lv_chart_set_type(${symbol}, LV_CHART_TYPE_LINE);`);
      lines.push(`    lv_chart_series_t * ${symbol}_series = lv_chart_add_series(${symbol}, lv_palette_main(LV_PALETTE_BLUE), LV_CHART_AXIS_PRIMARY_Y);`);
      for (const value of chartValuesProp(widget)) {
        lines.push(`    lv_chart_set_next_value(${symbol}, ${symbol}_series, ${value});`);
      }
      lines.push(`    lv_chart_refresh(${symbol});`);
      break;
  }
}

function appendStylePreview(lines: string[], symbol: string, widget: WidgetNode): void {
  const bgColor = cleanHexColorPreview(widget.style.bgColor);
  const textColor = cleanHexColorPreview(widget.style.textColor);
  const borderColor = cleanHexColorPreview(widget.style.borderColor);
  if (bgColor) {
    lines.push(`    lv_obj_set_style_bg_color(${symbol}, lv_color_hex(0x${bgColor}), LV_PART_MAIN | LV_STATE_DEFAULT);`);
  }
  if (textColor) {
    lines.push(`    lv_obj_set_style_text_color(${symbol}, lv_color_hex(0x${textColor}), LV_PART_MAIN | LV_STATE_DEFAULT);`);
  }
  if (borderColor) {
    lines.push(`    lv_obj_set_style_border_color(${symbol}, lv_color_hex(0x${borderColor}), LV_PART_MAIN | LV_STATE_DEFAULT);`);
  }
  if (widget.style.font) {
    appendFontStylePreview(lines, symbol, widget.style.font);
  }
  if (widget.style.align) {
    lines.push(`    lv_obj_set_style_text_align(${symbol}, ${textAlignConstant(widget.style.align)}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
  }
  if (typeof widget.style.letterSpace === "number" && widget.style.letterSpace !== 0) {
    lines.push(`    lv_obj_set_style_text_letter_space(${symbol}, ${widget.style.letterSpace}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
  }
  if (typeof widget.style.lineSpace === "number" && widget.style.lineSpace !== 0) {
    lines.push(`    lv_obj_set_style_text_line_space(${symbol}, ${widget.style.lineSpace}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
  }
  if (typeof widget.style.radius === "number") {
    lines.push(`    lv_obj_set_style_radius(${symbol}, ${widget.style.radius}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
  }
  if (typeof widget.style.opacity === "number") {
    lines.push(`    lv_obj_set_style_opa(${symbol}, ${Math.round((Math.max(0, Math.min(100, widget.style.opacity)) * 255) / 100)}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
  }
  if (widget.style.padding) {
    const padding = widget.style.padding;
    if (padding.top !== 0) lines.push(`    lv_obj_set_style_pad_top(${symbol}, ${padding.top}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
    if (padding.right !== 0) lines.push(`    lv_obj_set_style_pad_right(${symbol}, ${padding.right}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
    if (padding.bottom !== 0) lines.push(`    lv_obj_set_style_pad_bottom(${symbol}, ${padding.bottom}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
    if (padding.left !== 0) lines.push(`    lv_obj_set_style_pad_left(${symbol}, ${padding.left}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
  }
}

function appendEventPreview(lines: string[], symbol: string, widget: WidgetNode): void {
  for (const event of project.value.events.filter((item) => item.widgetId === widget.id)) {
    lines.push(`    lv_obj_add_event_cb(${symbol}, ${sanitizeCIdentifier(event.handlerName)}, ${event.event}, NULL);`);
  }
}

function appendEventCallbackStubs(lines: string[], root: WidgetNode): void {
  const widgetIds = new Set<string>();
  collectWidgetIdsForPreview(root, widgetIds);
  const seen = new Set<string>();
  const callbackNames = project.value.events
    .filter((event) => widgetIds.has(event.widgetId))
    .map((event) => sanitizeCIdentifier(event.handlerName))
    .filter((handlerName) => {
      if (seen.has(handlerName)) {
        return false;
      }
      seen.add(handlerName);
      return true;
    });
  for (const callbackName of callbackNames) {
    lines.push("");
    lines.push(`void ${callbackName}(lv_event_t * e) {`);
    lines.push("    /* User code can be added here. */");
    lines.push("}");
  }
}

function collectWidgetIdsForPreview(widget: WidgetNode, result: Set<string>): void {
  result.add(widget.id);
  for (const child of widget.children) {
    collectWidgetIdsForPreview(child, result);
  }
}

function createCallForPreview(widget: WidgetNode, parentSymbol: string): string {
  if (widget.type === "spinner") {
    return `lv_spinner_create(${parentSymbol}, ${Number(widget.props.spinTime ?? 1000)}, ${Number(widget.props.arcLength ?? 60)})`;
  }
  const factories: Record<string, string> = {
    button: "lv_btn_create",
    label: "lv_label_create",
    image: "lv_img_create",
    container: "lv_obj_create",
    arc: "lv_arc_create",
    bar: "lv_bar_create",
    line: "lv_line_create",
    switch: "lv_switch_create",
    slider: "lv_slider_create",
    checkbox: "lv_checkbox_create",
    dropdown: "lv_dropdown_create",
    spinner: "lv_spinner_create",
    chart: "lv_chart_create"
  };
  return `${factories[widget.type] ?? "lv_obj_create"}(${parentSymbol})`;
}

function lvglAlignConstant(align: NonNullable<WidgetNode["layout"]["align"]>): string {
  const constants: Record<NonNullable<WidgetNode["layout"]["align"]>, string> = {
    "top-left": "LV_ALIGN_TOP_LEFT",
    "top-right": "LV_ALIGN_TOP_RIGHT",
    center: "LV_ALIGN_CENTER",
    "bottom-left": "LV_ALIGN_BOTTOM_LEFT",
    "bottom-right": "LV_ALIGN_BOTTOM_RIGHT"
  };
  return constants[align];
}

function lvglFlexFlowConstant(flex: NonNullable<WidgetNode["layout"]["flex"]>): string {
  if (flex.direction === "column") {
    return flex.wrap ? "LV_FLEX_FLOW_COLUMN_WRAP" : "LV_FLEX_FLOW_COLUMN";
  }
  return flex.wrap ? "LV_FLEX_FLOW_ROW_WRAP" : "LV_FLEX_FLOW_ROW";
}

function numberProp(widget: WidgetNode, key: string, fallback: number): number {
  const value = widget.props[key];
  return typeof value === "number" ? value : fallback;
}

function chartValuesProp(widget: WidgetNode): number[] {
  const values = widget.props.values;
  if (Array.isArray(values) && values.length > 0) {
    return values.filter((value) => Number.isFinite(value));
  }
  const min = numberProp(widget, "min", 0);
  const max = numberProp(widget, "max", 100);
  const pointCount = Math.max(1, Math.floor(numberProp(widget, "pointCount", 8)));
  const span = Math.max(0, max - min);
  return Array.from({ length: pointCount }, (_unused, index) => min + ((index * 37 + 20) % (span + 1)));
}

function lvglSymbol(name: string): string {
  return `ui_${sanitizeCIdentifier(name)}`;
}

function assetSymbolForPreview(name: string): string {
  return `ui_img_${sanitizeCIdentifier(name)}`;
}

function sanitizeCIdentifier(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!cleaned) {
    return "Widget";
  }
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
}

function appendFontStylePreview(lines: string[], symbol: string, font: string): void {
  if (font.startsWith("lv_font_")) {
    lines.push(`    lv_obj_set_style_text_font(${symbol}, &${sanitizeCIdentifier(font)}, LV_PART_MAIN | LV_STATE_DEFAULT);`);
    return;
  }
  lines.push(`    /* Font asset ${sanitizeCComment(font)} is registered as metadata only; convert it to an LVGL font symbol before binding. */`);
}

function sanitizeCComment(value: string): string {
  return value.replaceAll("*/", "* /");
}

function cleanHexColorPreview(value: string | undefined): string | null {
  const color = value?.replace(/^#/, "") ?? "";
  return /^[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : null;
}

function textAlignConstant(align: NonNullable<WidgetNode["style"]["align"]>): string {
  const constants: Record<NonNullable<WidgetNode["style"]["align"]>, string> = {
    left: "LV_TEXT_ALIGN_LEFT",
    center: "LV_TEXT_ALIGN_CENTER",
    right: "LV_TEXT_ALIGN_RIGHT"
  };
  return constants[align];
}

function addSelectedEvent(): void {
  if (!eventHandler.value.trim()) {
    return;
  }
  projectStore.addEventBinding(eventType.value, eventHandler.value.trim(), eventTargetWidgetId.value);
}

async function uploadAsset(file: File): Promise<void> {
  const saved = await saveProjectWithLog();
  if (!saved) {
    upsertLog("asset-upload-blocked", "10:21:11", "Asset upload stopped because project save failed");
    return;
  }
  if (isLocalOnlyProject()) {
    assetsStore.error = "sign in before uploading assets";
    upsertLog("asset-upload-cloud-required", "10:21:11", "Sign in before uploading assets");
    return;
  }
  const asset = await assetsStore.uploadAsset(project.value.id, file);
  if (asset) {
    projectStore.registerAsset(asset);
    appendLog(`Asset uploaded: ${asset.name}`, "10:21:11");
  }
}

function bindAssetFromPanel(assetId: string): void {
  const widget = selectedWidget.value;
  if (!widget || widget.type !== "image" || widget.locked) {
    appendLog("Select an unlocked image widget before binding an asset", "10:21:11");
    return;
  }
  projectStore.bindSelectedImageAsset(assetId);
  activeInspectorTab.value = "style";
  appendLog("Image asset bound from Assets panel", "10:21:11");
}

function isLocalOnlyProject(): boolean {
  return project.value.id === "project-watch-demo" && !getAuthToken();
}

async function deleteAsset(assetId: string): Promise<void> {
  if (isAssetReferenced(assetId)) {
    assetDeleteReturnFocusElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const asset = project.value.assets.find((item) => item.id === assetId);
    pendingAssetDelete.value = {
      assetId,
      name: asset?.name ?? assetId,
      usageCount: assetUsageCounts.value[assetId] ?? 1
    };
    void nextTick(() => {
      assetDeleteCancelButton.value?.focus();
    });
    return;
  }
  await deleteAssetNow(assetId);
}

async function confirmAssetDelete(): Promise<void> {
  const assetId = pendingAssetDelete.value?.assetId;
  pendingAssetDelete.value = null;
  assetDeleteReturnFocusElement.value = null;
  if (assetId) {
    await deleteReferencedAssetNow(assetId);
  }
}

function cancelAssetDelete(): void {
  pendingAssetDelete.value = null;
  void nextTick(() => {
    assetDeleteReturnFocusElement.value?.focus();
    assetDeleteReturnFocusElement.value = null;
  });
}

async function deleteAssetNow(assetId: string): Promise<void> {
  const assetName = project.value.assets.find((asset) => asset.id === assetId)?.name ?? assetId;
  const deleted = await assetsStore.deleteAsset(project.value.id, assetId);
  if (deleted) {
    projectStore.unregisterAsset(assetId);
    appendLog(`Asset deleted: ${assetName}`, "10:21:11");
    focusAssetToolbarAfterDelete();
  }
}

async function deleteReferencedAssetNow(assetId: string): Promise<void> {
  const assetName = project.value.assets.find((asset) => asset.id === assetId)?.name ?? assetId;
  projectStore.unregisterAsset(assetId);
  const saved = await saveProjectWithLog();
  if (!saved) {
    projectStore.undo();
    return;
  }
  const deleted = await assetsStore.deleteAsset(project.value.id, assetId);
  if (!deleted) {
    projectStore.undo();
    await saveProjectWithLog();
    return;
  }
  appendLog(`Asset deleted: ${assetName}`, "10:21:11");
  focusAssetToolbarAfterDelete();
}

function focusAssetToolbarAfterDelete(): void {
  void nextTick(() => {
    (editorShellRef.value?.querySelector('[data-testid="asset-list-view-button"]') as HTMLElement | null)?.focus();
  });
}

function isAssetReferenced(assetId: string): boolean {
  return project.value.screens.some((screen) => widgetTreeUsesAsset(screen.root, assetId));
}

function widgetTreeUsesAsset(widget: WidgetNode, assetId: string): boolean {
  if (widget.type === "image" && widget.props.assetId === assetId) {
    return true;
  }
  if (widget.style.font === assetId) {
    return true;
  }
  return widget.children.some((child) => widgetTreeUsesAsset(child, assetId));
}

function deleteActiveScreen(): void {
  if (!activeScreen.value) {
    return;
  }
  projectStore.deleteScreen(activeScreen.value.id);
}

function deleteLayerWidget(widgetId: string): void {
  projectStore.selectWidget(widgetId);
  projectStore.deleteSelectedWidget();
}

function startLayerDrag(widgetId: string, event: DragEvent): void {
  draggedLayerWidgetId.value = widgetId;
  event.dataTransfer?.setData("application/x-lvgl-layer-widget", widgetId);
}

function dropLayerWidget(targetWidgetId: string): void {
  const widgetId = draggedLayerWidgetId.value;
  draggedLayerWidgetId.value = null;
  if (!widgetId) {
    return;
  }
  projectStore.moveWidgetLayerDrop(widgetId, targetWidgetId);
}

function handleKeydown(event: KeyboardEvent): void {
  if (activeEditorShellToken !== editorShellToken || event.defaultPrevented) {
    return;
  }
  if (event.key === "Escape" && previewOpen.value) {
    event.preventDefault();
    closePreview();
    return;
  }
  if (event.key === "Escape" && newProjectDialogOpen.value) {
    event.preventDefault();
    closeNewProjectDialog();
    return;
  }
  if (event.key === "Escape" && pendingAssetDelete.value) {
    event.preventDefault();
    cancelAssetDelete();
    return;
  }
  if (editorModalOpen.value && isCommandEditorShortcut(event)) {
    event.preventDefault();
    return;
  }
  const target = event.target as HTMLElement | null;
  if (target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA") {
    return;
  }
  if (editorModalOpen.value && isGlobalEditorShortcut(event)) {
    event.preventDefault();
    return;
  }
  if (event.key === " " || event.code === "Space") {
    event.preventDefault();
    spacePanActive.value = true;
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
    event.preventDefault();
    projectStore.copySelectedWidget();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void saveProjectWithLog();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "o") {
    event.preventDefault();
    void loadProjectList();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
    event.preventDefault();
    openNewProjectDialog();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
    event.preventDefault();
    projectStore.pasteCopiedWidget();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
    event.preventDefault();
    projectStore.duplicateSelectedWidget();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      projectStore.redo();
    } else {
      projectStore.undo();
    }
    return;
  }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    const widget = selectedWidget.value;
    if (!widget || widget.locked || widget.type === "screen") {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    projectStore.updateSelectedLayout({ x: widget.layout.x + dx, y: widget.layout.y + dy });
    return;
  }
  if (event.key !== "Delete" && event.key !== "Backspace") {
    return;
  }
  event.preventDefault();
  projectStore.deleteSelectedWidget();
}

const editorModalOpen = computed(() => previewOpen.value || newProjectDialogOpen.value || Boolean(pendingAssetDelete.value));

function isGlobalEditorShortcut(event: KeyboardEvent): boolean {
  return isCommandEditorShortcut(event) || isKeyboardEditorShortcut(event);
}

function isCommandEditorShortcut(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey) {
    return ["c", "d", "n", "o", "s", "v", "z"].includes(event.key.toLowerCase());
  }
  return false;
}

function isKeyboardEditorShortcut(event: KeyboardEvent): boolean {
  return [" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Backspace", "Delete"].includes(event.key)
    || event.code === "Space";
}

function handleDialogTabKeydown(event: KeyboardEvent): void {
  const dialog = event.currentTarget as HTMLElement | null;
  const focusableItems = dialog
    ? Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true")
    : [];
  if (!focusableItems.length) {
    event.preventDefault();
    dialog?.focus();
    return;
  }
  const firstItem = focusableItems[0];
  const lastItem = focusableItems[focusableItems.length - 1];
  if (event.shiftKey && document.activeElement === firstItem) {
    event.preventDefault();
    lastItem.focus();
    return;
  }
  if (!event.shiftKey && document.activeElement === lastItem) {
    event.preventDefault();
    firstItem.focus();
  }
}

function handleKeyup(event: KeyboardEvent): void {
  if (activeEditorShellToken !== editorShellToken || event.defaultPrevented) {
    return;
  }
  if (event.key === " " || event.code === "Space") {
    spacePanActive.value = false;
  }
}

async function mountSimulator(): Promise<void> {
  if (simulatorRuntime.value) {
    return;
  }
  if (!simulatorCanvas.value) {
    return;
  }
  try {
    simulatorStore.markLoading();
    simulatorRuntime.value = await loadRuntime({ wasmModuleUrl: simulatorWasmModuleUrl });
    await simulatorRuntime.value.mount(simulatorCanvas.value);
    simulatorStore.markReady();
    upsertLog("simulator-loaded", "10:21:13", "Simulator loaded");
    await renderSimulator();
  } catch (error) {
    const message = simulatorErrorMessage(error, "Runtime load failed");
    simulatorStore.markFailed(message);
    upsertLog("simulator-load-failed", "10:21:13", message);
  }
}

async function renderSimulator(): Promise<void> {
  if (!simulatorRuntime.value) {
    return;
  }
  try {
    simulatorStore.markRendering(activeScreen.value?.name ?? "Screen_1");
    await simulatorRuntime.value.renderProject(projectDocForRuntime(project.value, activeScreen.value?.id ?? null));
    simulatorStore.markReady("Preview updated");
    appendSimulatorRenderLog(activeScreen.value?.name ?? "Screen_1");
    upsertLog("preview-updated", "10:21:13", "Preview updated");
  } catch (error) {
    const message = simulatorErrorMessage(error, "Preview failed");
    simulatorStore.markFailed(message);
    appendLog(message, "10:21:13");
  }
}

function simulatorErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof SimulatorRuntimeError) {
    return `${error.code}: ${error.message}`;
  }
  return error instanceof Error ? error.message : fallback;
}

function appendSimulatorRenderLog(screenName: string): void {
  upsertLog("simulator-render", "10:21:13", `Rendering ${screenName}`);
}

function appendLog(message: string, time: string, stableKey?: string): void {
  logEntries.value.push({
    id: stableKey ? `log-${stableKey}` : `log-${logEntries.value.length}`,
    time,
    message
  });
}

function upsertLog(stableKey: string, time: string, message: string): void {
  const id = `log-${stableKey}`;
  const index = logEntries.value.findIndex((entry) => entry.id === id);
  if (index >= 0) {
    logEntries.value[index] = { id, time, message };
    return;
  }
  appendLog(message, time, stableKey);
}

function projectDocForRuntime(doc: ProjectDoc, activeScreenId: string | null): ProjectDoc {
  if (!activeScreenId) {
    return doc;
  }
  const activeIndex = doc.screens.findIndex((screen) => screen.id === activeScreenId);
  if (activeIndex <= 0) {
    return doc;
  }
  return {
    ...doc,
    screens: [
      doc.screens[activeIndex],
      ...doc.screens.slice(0, activeIndex),
      ...doc.screens.slice(activeIndex + 1)
    ]
  };
}
</script>
