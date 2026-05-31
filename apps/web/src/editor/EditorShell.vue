<template>
  <main ref="editorShellRef" class="editor-shell" :class="[`theme-${project.theme}`, `nav-${activeNavItem}`]" :style="bottomDockStyle">
    <TopToolbar
      v-model:grid-enabled="gridEnabled"
      v-model:snap-enabled="snapEnabled"
      :auth-error="authStore.error"
      :auth-user="authUser"
      :build-status="buildStatus"
      :can-build-project="canBuildProject"
      :can-copy-widget="Boolean(selectedWidget && selectedWidget.type !== 'screen' && !selectedWidget.locked)"
      :can-delete-widget="Boolean(selectedWidget && selectedWidget.type !== 'screen' && !selectedWidget.locked)"
      :can-paste-widget="Boolean(clipboardStore.copiedWidget)"
      :copied-widget-name="clipboardStore.copiedWidget?.widget.name"
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
      @delete-widget="widgetStore.deleteSelectedWidget"
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
          @add-screen="screenStore.addScreen"
          @delete-active-screen="deleteActiveScreen"
          @duplicate-screen="screenStore.duplicateScreen"
          @rename-screen="screenStore.renameScreen"
          @switch-screen="screenStore.switchScreen"
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
        :font-assets="fontAssets"
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
        @add-project-style="projectStore.addProjectStyle"
        @add-screen="screenStore.addScreen"
        @apply-project-style="projectStore.applyProjectStyleToSelectedWidget"
        @artboard-mounted="artboardRef = $event"
        @copy-generated-code="copyGeneratedCode"
        @delete-project-style="projectStore.deleteProjectStyle"
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
        @update-project-style-name="projectStore.renameProjectStyle"
        @update-project-style-number="updateProjectStyleNumber"
        @update-project-style-padding-side="updateProjectStylePaddingSide"
        @update-project-style-text="updateProjectStyleText"
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
        @update-style-blend-mode="updateStyleBlendMode"
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
        :aria-label="copy.bottomDock.resize"
        :title="copy.bottomDock.resize"
        aria-valuemin="180"
        aria-valuemax="420"
        :aria-valuenow="bottomDockEffectiveHeight"
        :aria-valuetext="bottomDockHeightValueText"
        @mousedown="startBottomDockResize"
        @keydown="handleBottomDockResizeKeydown"
      />
      <AssetsPanel
        data-testid="resources-panel"
        :aria-label="copy.bottomDock.resources"
        :class="{ active: activeNavItem === 'resources' }"
        :assets="assetsStore.assets"
        :usage-counts="assetUsageCounts"
        :preview-urls="assetsStore.previewUrls"
        :selected-widget="selectedWidget"
        :error="assetsStore.error"
        @upload="uploadAsset"
        @delete-asset="deleteAsset"
        @bind-image-asset="bindAssetFromPanel"
        @import-reference-asset="importReferenceAsset"
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
        :runtime-kind="simulatorRuntimeKind"
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
      :event-bindings="project.events"
      :image-preview-url="imagePreviewUrl"
      :preview-device-style="previewDeviceStyle"
      :preview-screenshot-url="previewScreenshotUrl"
      :preview-screenshot-disabled="previewScreenshotDisabled"
      :preview-status-message="previewStatusMessage"
      :rendered-widgets="renderedWidgets"
      :target-label="targetLabel"
      :to-test-id="toTestId"
      :widget-style="widgetStyle"
      :widget-text="widgetText"
      @close="closePreview"
      @preview-interaction="handlePreviewInteraction"
      @preview-event="handlePreviewEvent"
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
        <strong id="new-project-dialog-title">{{ copy.dialogs.newProjectTitle }}</strong>
        <p id="new-project-dialog-description">{{ copy.dialogs.newProjectDescription }}</p>
        <label class="dialog-field">
          {{ copy.dialogs.newProjectName }}
          <input
            v-model="newProjectName"
            ref="newProjectNameInput"
            data-testid="new-project-name-input"
            :aria-label="copy.dialogs.newProjectNameA11y"
            :aria-describedby="newProjectNameError ? 'new-project-name-error' : undefined"
            :aria-invalid="newProjectNameError ? 'true' : undefined"
            :title="copy.dialogs.newProjectNameA11y"
            autocomplete="off"
            maxlength="80"
            @input="clearNewProjectNameError"
          />
        </label>
        <p v-if="newProjectNameError" id="new-project-name-error" class="field-error" data-testid="new-project-name-error" role="alert">{{ newProjectNameError }}</p>
        <div class="confirm-actions">
          <button class="select-like" data-testid="cancel-new-project-button" type="button" :aria-label="copy.dialogs.cancelNewProject" :title="copy.dialogs.cancelNewProject" @click="closeNewProjectDialog">{{ copy.dialogs.cancel }}</button>
          <button class="primary-action" data-testid="confirm-new-project-button" type="submit" :aria-label="newProjectConfirmLabel" :title="newProjectConfirmLabel">{{ copy.dialogs.createProject }}</button>
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
        <strong id="asset-delete-confirm-title">{{ copy.dialogs.assetDeleteTitle }}</strong>
        <p id="asset-delete-confirm-description" role="alert">{{ copy.dialogs.assetDeleteDescription(pendingAssetDelete.name, pendingAssetDelete.usageCount) }}</p>
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
            {{ copy.dialogs.cancel }}
          </button>
          <button
            class="danger-action"
            type="button"
            data-testid="confirm-delete-asset-button"
            :aria-label="assetDeleteConfirmLabel"
            :title="assetDeleteConfirmLabel"
            @click="confirmAssetDelete"
          >
            {{ copy.dialogs.assetDeleteConfirm() }}
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
import { widgetCatalog, type AssetRef, type EventBinding, type LayoutBox, type ProjectDoc, type WidgetNode } from "@hiveton-lvgl/schema";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { loadRuntime, SimulatorRuntimeError, type LvglRuntime } from "@hiveton-lvgl/lvgl-wasm-runtime";
import { getAuthToken } from "../api/auth";
import { downloadJobResult } from "../api/jobs";
import { localizedErrorForCode, localizeError } from "../i18n/errors";
import { useCopy } from "../i18n/useCopy";
import { useAssetsStore } from "../stores/assets";
import { useAuthStore } from "../stores/auth";
import { useClipboardStore } from "../stores/clipboard";
import { useJobsStore } from "../stores/jobs";
import { useLocaleStore } from "../stores/locale";
import { useProjectStore } from "../stores/project";
import { useScreenStore } from "../stores/screen";
import { useSimulatorStore } from "../stores/simulator";
import { useWidgetStore } from "../stores/widget";
import { useCodeGeneration } from "../composables/useCodeGeneration";
import { useCanvasInteraction } from "../composables/useCanvasInteraction";
import { useSimulator } from "../composables/useSimulator";
import { useAssetManagement } from "../composables/useAssetManagement";
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
import { toTestId } from "./testId";
import TopToolbar from "./TopToolbar.vue";
import WidgetPalette from "./WidgetPalette.vue";

const projectStore = useProjectStore();
const assetsStore = useAssetsStore();
const authStore = useAuthStore();
const clipboardStore = useClipboardStore();
const jobsStore = useJobsStore();
const screenStore = useScreenStore();
const simulatorStore = useSimulatorStore();
const widgetStore = useWidgetStore();
const localeStore = useLocaleStore();
const copy = useCopy();
const editorShellToken = ++nextEditorShellToken;
const project = computed(() => projectStore.project);
const activeScreen = computed(() => screenStore.activeScreen);
const selectedWidget = computed(() => projectStore.selectedWidget);
const selectedWidgetForComposable = computed(() => selectedWidget.value ?? undefined);
const authUser = computed(() => authStore.user);
const canBuildProject = computed(() => Boolean(authUser.value || authStore.tokenAvailable));
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
// Composables
const projectTarget = computed(() => project.value.target);
const {
  zoomPercent, gridEnabled, snapEnabled, spacePanActive, canvasPan,
  alignmentGuides, mouseCoordinates, interaction, keyboardNudge,
  zoomLevels, artboardStyle, canvasPanStyle, rulerTopStyle, rulerLeftStyle,
  rulerXTicks, rulerYTicks, snapCanvasValue, alignmentAdjustedLayout,
  cloneLayout
} = useCanvasInteraction(projectTarget, renderedWidgets, selectedWidgetForComposable);

const { codePreview, codeCopyStatus } = useCodeGeneration(project, activeScreen, copy);

const {
  fontAssets, imageAssets, assetUsageCounts,
  countAssetUsage, countStyleAssetUsage,
  pendingAssetDelete,
  isAssetReferenced, widgetTreeUsesAsset, isLocalAsset,
  imagePreviewUrlForWidget: imagePreviewUrl
} = useAssetManagement(project, selectedWidgetForComposable);
const saveStateLabel = computed(() => {
  if (projectStore.saveState === "saving") {
    return copy.value.status.saving;
  }
  if (projectStore.saveState === "failed") {
    return copy.value.status.saveFailed;
  }
  if (projectStore.dirty) {
    return copy.value.status.unsavedChanges;
  }
  return copy.value.status.allChangesSaved;
});
const persistenceLabel = computed(() => {
  if (!authUser.value) {
    return copy.value.status.localProject;
  }
  if (projectStore.saveState === "failed") {
    return copy.value.status.cloudSaveUnavailable;
  }
  if (project.value.id === "project-watch-demo") {
    return copy.value.status.cloudProjectNotCreated;
  }
  return copy.value.status.projectSavedToCloud;
});
const selectedEvents = computed(() => {
  const targetId = eventTargetWidgetId.value || selectedWidget.value?.id;
  return project.value.events.filter((event) => event.widgetId === targetId);
});
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
    label: copy.value.bottomDock.commandMessageLabel(entry.message),
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
        return visibleEntries[signedOutIndex]?.message ?? copy.value.status.signedOutLocalEditing;
      }
    }
  }
  const latest = [...visibleEntries].reverse().at(0);
  return latest?.message ?? copy.value.status.editorReady;
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
let simulatorMountGeneration = 0;
let simulatorMountInFlightGeneration: number | null = null;
const activeCenterPanel = ref<"canvas" | "code" | "settings">("canvas");
const activeNavItem = ref<SidebarNavItem>("widgets");
const activeInspectorTab = ref<InspectorTab>("style");
const bottomLogTab = ref<"log" | "timeline">("log");
const bottomDockCollapsed = ref(false);
const bottomDockHeight = ref(248);
const bottomDockUserSized = ref(false);
const draggedLayerWidgetId = ref<string | null>(null);
const inspectorErrors = ref<Record<string, string>>({});
const exportDownloadUrl = computed(() => jobsStore.exportDownloadUrl);
const buildStatus = computed(() => jobsStore.buildStatus);
const simulatorStatus = computed(() => simulatorStore.status);
const simulatorRuntimeKind = computed(() => simulatorStore.runtimeKind);
const simulatorMessage = computed(() => simulatorStore.message);
const simulatorVisible = ref(true);
const simulatorBackground = ref<"dark" | "light">("dark");
const simulatorScreenshotUrl = ref<string | null>(null);
const previewOpen = ref(false);
const previewReturnFocusElement = ref<HTMLElement | null>(null);
const previewScreenshotUrl = ref<string | null>(null);
const previewStatusMessage = ref(copy.value.runtime.previewLiveReady);
const previewInteractionDirty = ref(false);
const previewStatusSequence = ref(0);
const previewScreenshotDisabled = computed(() => simulatorStore.status === "failed" || previewInteractionDirty.value);
const assetDeleteCancelLabel = computed(() =>
  copy.value.dialogs.assetDeleteCancel(pendingAssetDelete.value?.name)
);
const assetDeleteConfirmLabel = computed(() =>
  copy.value.dialogs.assetDeleteConfirm(pendingAssetDelete.value?.name)
);
const newProjectDialogOpen = ref(false);
const newProjectReturnFocusElement = ref<HTMLElement | null>(null);
const assetDeleteReturnFocusElement = ref<HTMLElement | null>(null);
const newProjectName = ref(copy.value.runtime.untitledProjectName);
const newProjectNameError = ref<string | null>(null);
const newProjectNameInput = ref<HTMLInputElement | null>(null);
const newProjectConfirmLabel = computed(() => {
  const name = newProjectName.value.trim();
  return copy.value.dialogs.createProjectNamed(name);
});
const assetDeleteCancelButton = ref<HTMLButtonElement | null>(null);
const simulatorWasmModuleUrl = import.meta.env.VITE_LVGL_WASM_MODULE_URL?.trim() || undefined;
const bottomDockEffectiveHeight = computed(() =>
  activeNavItem.value === "resources" && !bottomDockUserSized.value ? 376 : bottomDockHeight.value
);
const bottomDockStyle = computed(() => ({
  "--bottom-dock-height": bottomDockCollapsed.value ? "36px" : `${bottomDockEffectiveHeight.value}px`
}));
const bottomDockCollapseLabel = computed(() =>
  bottomDockCollapsed.value ? copy.value.bottomDock.expand : copy.value.bottomDock.collapse
);
const bottomDockHeightValueText = computed(() => copy.value.bottomDock.heightValue(bottomDockEffectiveHeight.value));
const bottomDockResize = ref<null | {
  startY: number;
  startHeight: number;
}>(null);

const targetLabel = computed(
  () => `${project.value.target.deviceName} (${project.value.target.width}x${project.value.target.height})`
);
const deviceSurfaceStyle = computed(() => ({
  background: activeScreen.value?.root.style.bgColor ?? "#101010"
}));
const previewDeviceStyle = computed(() => ({
  width: `${project.value.target.width}px`,
  height: `${project.value.target.height}px`
}));

const logEntries = ref([
  { id: "log-editor-ready", time: "10:21:05", message: copy.value.status.editorReady }
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
  simulatorMountGeneration += 1;
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
  [
    () => project.value.screens.length,
    () => project.value.screens.map(s => `${s.id}:${s.root.children.length}`).join(","),
    () => project.value.events.length,
    () => project.value.styles.length,
    () => project.value.assets.length,
    () => project.value.theme,
    () => project.value.updatedAt
  ],
  () => {
    scheduleSimulatorRender();
    scheduleAutosave();
  }
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
  previewScreenshotUrl.value = null;
  previewInteractionDirty.value = false;
  previewStatusSequence.value += 1;
  previewStatusMessage.value = copy.value.runtime.previewLiveReady;
  void syncPreviewRuntimeStatus(copy.value.runtime.previewLiveReady);
  logEntries.value.push({
    id: `log-preview-${logEntries.value.length}`,
    time: "10:21:10",
    message: copy.value.runtime.previewUpdated
  });
}

function closePreview(): void {
  previewOpen.value = false;
  previewInteractionDirty.value = false;
  void nextTick(() => {
    previewReturnFocusElement.value?.focus();
    previewReturnFocusElement.value = null;
  });
}

function refreshPreview(): void {
  previewScreenshotUrl.value = null;
  previewInteractionDirty.value = false;
  previewStatusSequence.value += 1;
  previewStatusMessage.value = copy.value.runtime.previewRefreshed;
  void syncPreviewRuntimeStatus(copy.value.runtime.previewRefreshed);
  appendLog(copy.value.runtime.previewUpdated, "10:21:10");
}

function handlePreviewInteraction(): void {
  previewInteractionDirty.value = true;
  previewStatusSequence.value += 1;
  previewScreenshotUrl.value = null;
  previewStatusMessage.value = copy.value.runtime.previewInteractionTemporary;
  upsertLog("preview-interaction-temporary", "10:21:10", copy.value.runtime.previewInteractionTemporary);
}

function handlePreviewEvent(widgetId: string, eventName: EventBinding["event"]): void {
  const bindings = project.value.events.filter((event) => event.widgetId === widgetId && event.event === eventName);
  for (const binding of bindings) {
    const message = copy.value.runtime.previewEventTriggered(binding.event, binding.handlerName);
    previewStatusSequence.value += 1;
    previewStatusMessage.value = message;
    appendLog(message, "10:21:10");
  }
}

async function syncPreviewRuntimeStatus(successMessage: string): Promise<void> {
  const sequence = previewStatusSequence.value;
  await mountSimulator();
  const rendered = await renderSimulator();
  if (previewStatusSequence.value !== sequence) {
    return;
  }
  if (!previewOpen.value) {
    return;
  }
  if (previewScreenshotUrl.value) {
    return;
  }
  previewStatusMessage.value = rendered
    ? successMessage
    : (simulatorStore.lastError ?? copy.value.runtime.previewFailed);
}

function capturePreviewScreenshot(): void {
  if (previewScreenshotDisabled.value) {
    previewStatusMessage.value = previewInteractionDirty.value
      ? copy.value.runtime.previewInteractionTemporary
      : (simulatorStore.lastError ?? copy.value.runtime.previewScreenshotUnavailable);
    appendLog(previewStatusMessage.value, "10:21:10");
    return;
  }
  const canvas = simulatorCanvas.value;
  if (!canvas || typeof canvas.toDataURL !== "function") {
    previewStatusMessage.value = copy.value.runtime.previewScreenshotUnavailable;
    appendLog(copy.value.runtime.previewScreenshotUnavailable, "10:21:10");
    return;
  }
  const screenshotUrl = captureCanvasDataUrl(canvas);
  if (!screenshotUrl) {
    previewStatusMessage.value = copy.value.runtime.previewScreenshotUnavailable;
    appendLog(copy.value.runtime.previewScreenshotUnavailable, "10:21:10");
    return;
  }
  previewScreenshotUrl.value = screenshotUrl;
  previewStatusMessage.value = copy.value.runtime.previewScreenshotReady;
  appendLog(copy.value.runtime.previewScreenshotLogReady, "10:21:10");
}

function refreshSimulatorPanel(): void {
  simulatorScreenshotUrl.value = null;
  void renderSimulator();
  appendLog(copy.value.runtime.simulatorRefreshed, "10:21:10");
}

function captureSimulatorScreenshot(): void {
  const canvas = simulatorCanvas.value;
  if (!canvas || typeof canvas.toDataURL !== "function") {
    appendLog(copy.value.runtime.simulatorScreenshotUnavailable, "10:21:10");
    return;
  }
  const screenshotUrl = captureCanvasDataUrl(canvas);
  if (!screenshotUrl) {
    appendLog(copy.value.runtime.simulatorScreenshotUnavailable, "10:21:10");
    return;
  }
  simulatorScreenshotUrl.value = screenshotUrl;
  appendLog(copy.value.runtime.simulatorScreenshotReady, "10:21:10");
}

function captureCanvasDataUrl(canvas: HTMLCanvasElement): string | null {
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function toggleSimulatorBackground(): void {
  simulatorBackground.value = simulatorBackground.value === "dark" ? "light" : "dark";
  appendLog(copy.value.runtime.simulatorBackground(simulatorBackground.value), "10:21:10");
}

async function requestSimulatorFullscreen(): Promise<void> {
  const canvas = simulatorCanvas.value as (HTMLCanvasElement & { requestFullscreen?: () => Promise<void> }) | null;
  if (!canvas?.requestFullscreen) {
    appendLog(copy.value.runtime.simulatorFullscreenUnavailable, "10:21:10");
    return;
  }
  try {
    await canvas.requestFullscreen();
    appendLog(copy.value.runtime.simulatorFullscreenOpened, "10:21:10");
  } catch (error) {
    appendLog(error instanceof Error ? copy.value.runtime.simulatorFullscreenFailedWithMessage(error.message) : copy.value.runtime.simulatorFullscreenFailed, "10:21:10");
  }
}

function handleSimulatorCanvasMounted(canvas: HTMLCanvasElement): void {
  simulatorMountGeneration += 1;
  simulatorCanvas.value = canvas;
  void mountSimulator();
}

function toggleSimulatorPanel(): void {
  simulatorVisible.value = !simulatorVisible.value;
  if (!simulatorVisible.value) {
    simulatorMountGeneration += 1;
    simulatorRuntime.value?.destroy();
    simulatorRuntime.value = null;
    simulatorCanvas.value = null;
    simulatorStore.markLoading(copy.value.runtime.simulatorHidden);
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
    appendLog(copy.value.runtime.canvasFullscreenUnavailable, "10:21:10");
    return;
  }
  try {
    await stage.requestFullscreen();
    appendLog(copy.value.runtime.canvasFullscreenOpened, "10:21:10");
  } catch (error) {
    appendLog(error instanceof Error ? copy.value.runtime.canvasFullscreenFailedWithMessage(error.message) : copy.value.runtime.canvasFullscreenFailed, "10:21:10");
  }
}

async function copyGeneratedCode(): Promise<void> {
  const code = codePreview.value;
  if (!code.trim()) {
    codeCopyStatus.value = copy.value.runtime.noCodeToCopy;
    return;
  }
  codeCopyStatus.value = copy.value.runtime.copyingCode;
  try {
    await writeClipboardText(code);
    codeCopyStatus.value = copy.value.runtime.codeCopied;
    appendLog(copy.value.runtime.generatedCodeCopied, "10:21:10");
  } catch (error) {
    codeCopyStatus.value = copy.value.runtime.codeCopyFailed;
    appendLog(error instanceof Error ? copy.value.runtime.codeCopyFailedWithMessage(error.message) : copy.value.runtime.codeCopyFailed, "10:21:10");
  }
}

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error(copy.value.runtime.clipboardWriteTimedOut)), 1200);
        })
      ]);
      return;
    } catch (error) {
      if (copyTextWithSelection(text)) {
        return;
      }
      throw error;
    }
  }
  if (copyTextWithSelection(text)) {
    return;
  }
  throw new Error(copy.value.runtime.clipboardApiUnavailable);
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
    upsertLog("auth-login", "10:21:11", copy.value.runtime.loggedInAs(authStore.user.displayName));
    return;
  }
  upsertLog("auth-login-failed", "10:21:11", copy.value.runtime.loginFailed(authStore.error ?? copy.value.runtime.unknownError));
}

function addWidgetFromPalette(type: Exclude<WidgetNode["type"], "screen">): void {
  widgetStore.addWidgetFromCatalog(type, { x: 24, y: 32 });
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
  widgetStore.addWidgetFromCatalog(
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
    upsertLog("project-create-cloud-required", "10:21:11", copy.value.runtime.signInBeforeCloudProjects);
    return;
  }
  newProjectReturnFocusElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  newProjectName.value = copy.value.runtime.untitledProjectName;
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
    newProjectNameError.value = copy.value.runtime.projectNameRequired;
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
      message: copy.value.runtime.projectCreated
    });
  } catch (error) {
    logEntries.value.push({
      id: `log-project-create-error-${logEntries.value.length}`,
      time: "10:21:11",
      message: localizedOperationError(error, "PROJECT_CREATE_FAILED", copy.value.runtime.projectCreateFailed)
    });
  }
}

async function loadProjectList(): Promise<void> {
  if (!getAuthToken()) {
    upsertLog("project-list-cloud-required", "10:21:11", copy.value.runtime.signInBeforeLoadingProjects);
    return;
  }
  try {
    await projectStore.loadProjects();
    logEntries.value.push({
      id: `log-project-list-${logEntries.value.length}`,
      time: "10:21:11",
      message: copy.value.runtime.projectListLoaded
    });
  } catch (error) {
    logEntries.value.push({
      id: `log-project-list-error-${logEntries.value.length}`,
      time: "10:21:11",
      message: localizedOperationError(error, "PROJECT_LIST_FAILED", copy.value.runtime.projectListFailed)
    });
  }
}

async function openProject(projectId: string): Promise<void> {
  if (!projectId || projectId === project.value.id) {
    return;
  }
  try {
    const opened = await projectStore.openProject(projectId);
    if (!opened) {
      return;
    }
    await assetsStore.loadAssets(projectId);
    void renderSimulator();
    logEntries.value.push({
      id: `log-project-opened-${logEntries.value.length}`,
      time: "10:21:11",
      message: copy.value.runtime.projectOpened
    });
  } catch (error) {
    logEntries.value.push({
      id: `log-project-open-error-${logEntries.value.length}`,
      time: "10:21:11",
      message: localizedOperationError(error, "PROJECT_LOOKUP_FAILED", copy.value.runtime.projectOpenFailed)
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
      throw new Error(copy.value.runtime.buildSaveFailed);
    }
    if (projectStore.dirty) {
      throw new Error(copy.value.runtime.buildDirtyAfterSave);
    }
    if (isLocalOnlyProject()) {
      throw new Error(copy.value.runtime.buildSignInRequired);
    }
    if (autosaveTimer.value) {
      clearTimeout(autosaveTimer.value);
      autosaveTimer.value = null;
    }
    await jobsStore.startExport(project.value.id, {
      buildFailedMessage: copy.value.runtime.buildFailed,
      jobStatusMessage: copy.value.runtime.jobStatus,
      pollTimeoutMessage: copy.value.runtime.jobTimedOut
    });
  } catch (error) {
    jobsStore.markFailed(error instanceof Error ? error.message : copy.value.runtime.buildFailed);
  }
}

async function downloadExportZip(): Promise<void> {
  if (!exportDownloadUrl.value) {
    return;
  }
  try {
    const archive = await downloadJobResult(exportDownloadUrl.value);
    if (typeof URL.createObjectURL !== "function") {
      throw new Error(copy.value.runtime.downloadUnavailable);
    }
    const objectUrl = URL.createObjectURL(archive);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${project.value.name.replace(/[^a-z0-9_-]+/gi, "_") || "lvgl-ui"}-export.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      try {
        URL.revokeObjectURL?.(objectUrl);
      } catch {
        // Object URL cleanup is best-effort; the download has already completed.
      }
    }, 1000);
    upsertLog("export-downloaded", "10:21:12", copy.value.runtime.exportZipDownloaded);
  } catch (error) {
    upsertLog("export-download-failed", "10:21:12", localizedOperationError(error, "JOB_DOWNLOAD_FAILED", copy.value.runtime.exportDownloadFailed));
  }
}

async function saveProjectWithLog(): Promise<boolean> {
  const saved = await projectStore.saveProject();
  if (!saved) {
    upsertLog("project-save-failed", "10:21:11", copy.value.runtime.projectSaveFailed(projectStore.saveError ?? copy.value.runtime.unknownError));
    return false;
  }
  const synced = await syncLocalAssetsToCloud();
  if (!synced.ok) {
    upsertLog("project-save-failed", "10:21:11", copy.value.runtime.projectSaveFailed(assetsStore.error ?? copy.value.runtime.unknownError));
    return false;
  }
  if (synced.changed) {
    const resaved = await projectStore.saveProject();
    if (!resaved) {
      upsertLog("project-save-failed", "10:21:11", copy.value.runtime.projectSaveFailed(projectStore.saveError ?? copy.value.runtime.unknownError));
      return false;
    }
  }
  upsertLog("project-saved", "10:21:11", copy.value.runtime.projectSaved);
  return true;
}

async function syncLocalAssetsToCloud(): Promise<{ ok: boolean; changed: boolean }> {
  if (isLocalOnlyProject()) {
    return { ok: true, changed: false };
  }
  const localAssets = project.value.assets.filter((asset) => asset.objectKey.startsWith("local://"));
  if (localAssets.length === 0) {
    return { ok: true, changed: false };
  }
  for (const asset of localAssets) {
    const uploaded = await assetsStore.uploadStoredLocalAsset(project.value.id, asset.id);
    if (!uploaded) {
      return { ok: false, changed: false };
    }
    projectStore.replaceAssetReference(uploaded.oldAssetId, uploaded.asset);
    appendLog(copy.value.runtime.assetUploaded(uploaded.asset.name), "10:21:11");
  }
  return { ok: true, changed: true };
}

function logoutUser(): void {
  authStore.logout();
  assetsStore.clearError();
  upsertLog("auth-signed-out", "10:21:12", copy.value.status.signedOutLocalEditing);
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

function widgetStyle(item: RenderedWidget): Record<string, string> {
  const widget = item.widget;
  const padding = widget.style.padding;
  const opacity = widget.style.opacity === undefined ? 1 : widget.style.opacity / 100;
  const fontSize = fontSizeForLvglFont(widget.style.font);
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
    mixBlendMode: widget.style.blendMode ?? "normal",
    ...(fontSize ? { fontSize } : {}),
    letterSpacing: `${widget.style.letterSpace ?? 0}px`,
    lineHeight: widget.style.lineSpace ? `${Math.max(1, widget.layout.height + widget.style.lineSpace)}px` : "normal"
  };
}

function fontSizeForLvglFont(font: string | undefined): string | undefined {
  const match = /^lv_font_montserrat_(\d+)$/.exec(font ?? "");
  if (!match) {
    return undefined;
  }
  return `${Number(match[1])}px`;
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

function updateLayoutNumber(field: "x" | "y" | "width" | "height", rawValue: string): void {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    setInspectorError(field, copy.value.inspector.errors.number(inspectorFieldLabel(field)));
    return;
  }
  if (!Number.isInteger(value)) {
    setInspectorError(field, copy.value.inspector.errors.integer(inspectorFieldLabel(field)));
    return;
  }
  if ((field === "width" || field === "height") && value <= 0) {
    setInspectorError(field, copy.value.inspector.errors.greaterThanZero(inspectorFieldLabel(field)));
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
    setInspectorError("gap", copy.value.inspector.errors.number(inspectorFieldLabel("gap")));
    return;
  }
  if (!Number.isInteger(value)) {
    setInspectorError("gap", copy.value.inspector.errors.integer(inspectorFieldLabel("gap")));
    return;
  }
  if (value < 0) {
    setInspectorError("gap", copy.value.inspector.errors.nonNegative(inspectorFieldLabel("gap")));
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
    startHeight: widget.layout.height,
    startLayout: cloneLayout(widget.layout)
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
    startHeight: widget.layout.height,
    startLayout: cloneLayout(widget.layout)
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
    projectStore.updateSelectedLayoutDraft({
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
  projectStore.updateSelectedLayoutDraft({
    width: nextLayout.width,
    height: nextLayout.height
  });
}

function endCanvasInteraction(): void {
  const session = interaction.value;
  if (session?.startLayout && (session.mode === "move" || session.mode === "resize")) {
    const widget = projectStore.selectedWidget?.id === session.widgetId
      ? projectStore.selectedWidget
      : null;
    if (widget) {
      projectStore.commitSelectedLayoutSnapshot(session.startLayout, cloneLayout(widget.layout), session.mode === "move" ? "Move widget" : "Resize widget");
    }
  }
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
  const errorField = styleColorErrorField(field);
  if (!isValidStyleColor(value)) {
    setInspectorError(errorField, copy.value.inspector.errors.hexColor(styleColorLabel(field)));
    return;
  }
  clearInspectorError(errorField);
  projectStore.updateSelectedStyle({ [field]: value });
}

function updateProjectStyleText(styleId: string, field: "bgColor" | "textColor" | "borderColor" | "font" | "align" | "blendMode", value: string): void {
  if (field === "bgColor" || field === "textColor" || field === "borderColor") {
    const errorField = projectStyleColorErrorField(styleId, field);
    if (!isValidStyleColor(value)) {
      setInspectorError(errorField, copy.value.inspector.errors.hexColor(styleColorLabel(field)));
      return;
    }
    clearInspectorError(errorField);
  }
  if (field === "blendMode" && !isBlendMode(value)) {
    return;
  }
  projectStore.updateProjectStyleText(styleId, field, value);
}

function updateProjectStyleNumber(styleId: string, field: "opacity" | "radius" | "letterSpace" | "lineSpace", rawValue: string): void {
  const value = Number(rawValue);
  const errorField = projectStyleNumberErrorField(styleId, field);
  if (!Number.isFinite(value)) {
    setInspectorError(errorField, copy.value.inspector.errors.number(projectStyleNumberLabel(field)));
    return;
  }
  if (!Number.isInteger(value)) {
    setInspectorError(errorField, copy.value.inspector.errors.integer(projectStyleNumberLabel(field)));
    return;
  }
  if (field === "opacity" && (value < 0 || value > 100)) {
    setInspectorError(errorField, copy.value.inspector.errors.range(projectStyleNumberLabel(field), 0, 100));
    return;
  }
  if (field !== "opacity" && value < 0) {
    setInspectorError(errorField, copy.value.inspector.errors.nonNegative(projectStyleNumberLabel(field)));
    return;
  }
  clearInspectorError(errorField);
  projectStore.updateProjectStyleNumber(styleId, field, rawValue);
}

function updateProjectStylePaddingSide(styleId: string, side: "top" | "right" | "bottom" | "left", rawValue: string): void {
  const value = Number(rawValue);
  const field = `padding-${side}` as const;
  const errorField = `project-style-${styleId}-${field}`;
  if (!Number.isFinite(value)) {
    setInspectorError(errorField, copy.value.inspector.errors.number(inspectorFieldLabel(field)));
    return;
  }
  if (!Number.isInteger(value)) {
    setInspectorError(errorField, copy.value.inspector.errors.integer(inspectorFieldLabel(field)));
    return;
  }
  if (value < 0) {
    setInspectorError(errorField, copy.value.inspector.errors.nonNegative(inspectorFieldLabel(field)));
    return;
  }
  clearInspectorError(errorField);
  projectStore.updateProjectStylePaddingSide(styleId, side, rawValue);
}

function isValidStyleColor(value: string): boolean {
  return value.trim() === "" || /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function styleColorErrorField(field: "textColor" | "bgColor" | "borderColor"): string {
  return `style-${field.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`;
}

function projectStyleColorErrorField(styleId: string, field: "bgColor" | "textColor" | "borderColor"): string {
  return `project-style-${styleId}-${field.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`;
}

function projectStyleNumberErrorField(styleId: string, field: "opacity" | "radius" | "letterSpace" | "lineSpace"): string {
  return `project-style-${styleId}-${field.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`;
}

function projectStyleNumberLabel(field: "opacity" | "radius" | "letterSpace" | "lineSpace"): string {
  if (field === "opacity" || field === "radius") {
    return copy.value.canvas[field];
  }
  return inspectorFieldLabel(field);
}

function styleColorLabel(field: "textColor" | "bgColor" | "borderColor"): string {
  const labels = copy.value.inspector.a11y;
  if (field === "textColor") {
    return labels.textColor;
  }
  if (field === "bgColor") {
    return labels.backgroundColor;
  }
  return labels.borderColor;
}

function updateStyleNumber(field: "opacity" | "radius" | "letterSpace" | "lineSpace", rawValue: string): void {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    setInspectorError(field, copy.value.inspector.errors.number(inspectorFieldLabel(field)));
    return;
  }
  if (!Number.isInteger(value)) {
    setInspectorError(field, copy.value.inspector.errors.integer(inspectorFieldLabel(field)));
    return;
  }
  if (field === "opacity" && (value < 0 || value > 100)) {
    setInspectorError(field, copy.value.inspector.errors.range(inspectorFieldLabel(field), 0, 100));
    return;
  }
  if (field !== "opacity" && value < 0) {
    setInspectorError(field, copy.value.inspector.errors.nonNegative(inspectorFieldLabel(field)));
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

function updateStyleBlendMode(value: string): void {
  if (isBlendMode(value)) {
    projectStore.updateSelectedStyle({ blendMode: value });
  }
}

function isBlendMode(value: string): value is NonNullable<WidgetNode["style"]["blendMode"]> {
  return value === "normal" || value === "additive" || value === "subtractive" || value === "multiply" || value === "replace";
}

function updatePropNumber(field: string, rawValue: string): void {
  const value = Number(rawValue);
  const errorField = propErrorField(field);
  if (!Number.isFinite(value)) {
    setInspectorError(errorField, copy.value.inspector.errors.number(inspectorFieldLabel(field)));
    return;
  }
  if (!Number.isInteger(value)) {
    setInspectorError(errorField, copy.value.inspector.errors.integer(inspectorFieldLabel(field)));
    return;
  }
  if ((field === "spinTime" || field === "arcLength" || field === "pointCount") && value <= 0) {
    setInspectorError(errorField, copy.value.inspector.errors.greaterThanZero(inspectorFieldLabel(field)));
    return;
  }
  if ((field === "selected" || field === "value") && value < 0) {
    setInspectorError(errorField, copy.value.inspector.errors.nonNegative(inspectorFieldLabel(field)));
    return;
  }
  if (field === "value" && rangeValueOutOfRange(value)) {
    const [min, max] = selectedWidgetRangeBounds();
    setInspectorError(errorField, copy.value.inspector.errors.range(inspectorFieldLabel(field), min, max));
    return;
  }
  if (field === "selected" && dropdownSelectedOutOfRange(value)) {
    const maxIndex = Math.max(0, dropdownOptionsForSelectedWidget().length - 1);
    setInspectorError(errorField, copy.value.inspector.errors.range(inspectorFieldLabel(field), 0, maxIndex));
    return;
  }
  if ((field === "min" || field === "max") && rangeBoundsInvalid(field, value)) {
    setInspectorError(errorField, copy.value.inspector.errors.greaterThan(inspectorFieldLabel("max"), inspectorFieldLabel("min")));
    return;
  }
  if (field === "min") {
    clearInspectorError("prop-max");
  } else if (field === "max") {
    clearInspectorError("prop-min");
  }
  clearInspectorError(errorField);
  projectStore.updateSelectedProps({ [field]: value });
}

function numberProp(widget: WidgetNode, key: string, fallback: number): number {
  const value = widget.props[key];
  return typeof value === "number" ? value : fallback;
}

function propErrorField(field: string): string {
  return `prop-${field.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`;
}

function rangeBoundsInvalid(field: string, value: number): boolean {
  const widget = selectedWidget.value;
  if (!widget || !["slider", "bar", "arc", "chart"].includes(widget.type)) {
    return false;
  }
  const min = field === "min" ? value : numberProp(widget, "min", 0);
  const max = field === "max" ? value : numberProp(widget, "max", 100);
  return max <= min;
}

function rangeValueOutOfRange(value: number): boolean {
  const widget = selectedWidget.value;
  if (!widget || !["slider", "bar", "arc"].includes(widget.type)) {
    return false;
  }
  const [min, max] = selectedWidgetRangeBounds();
  return max > min && (value < min || value > max);
}

function selectedWidgetRangeBounds(): [number, number] {
  const widget = selectedWidget.value;
  if (!widget) {
    return [0, 100];
  }
  return [numberProp(widget, "min", 0), numberProp(widget, "max", 100)];
}

function updatePropText(field: string, value: string): void {
  if (field === "options" && selectedWidget.value?.type === "dropdown") {
    const options = dropdownOptionsFromText(value);
    const currentSelected = numberProp(selectedWidget.value, "selected", 0);
    const selected = options.length > 0 ? Math.min(currentSelected, options.length - 1) : currentSelected;
    clearInspectorError("prop-selected");
    projectStore.updateSelectedProps({ options: value, selected });
    return;
  }
  projectStore.updateSelectedProps({ [field]: value });
}

function dropdownSelectedOutOfRange(selected: number): boolean {
  const options = dropdownOptionsForSelectedWidget();
  return options.length > 0 && selected >= options.length;
}

function dropdownOptionsForSelectedWidget(): string[] {
  const widget = selectedWidget.value;
  return widget?.type === "dropdown" ? dropdownOptionsFromText(String(widget.props.options ?? "")) : [];
}

function dropdownOptionsFromText(value: string): string[] {
  return value.split(/\r?\n/).map((option) => option.trim()).filter(Boolean);
}

function updatePropChecked(checked: boolean): void {
  projectStore.updateSelectedProps({ checked });
}

function updateChartValues(rawValue: string): void {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    setInspectorError("prop-values", copy.value.inspector.errors.chartValuesRequired);
    return;
  }
  const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
  const values = tokens.map((token) => Number(token));
  if (!values.length || values.some((value) => !Number.isFinite(value))) {
    setInspectorError("prop-values", copy.value.inspector.errors.chartValuesInvalid);
    return;
  }
  if (values.some((value) => !Number.isInteger(value))) {
    setInspectorError("prop-values", copy.value.inspector.errors.integer(inspectorFieldLabel("values")));
    return;
  }
  clearInspectorError("prop-values");
  projectStore.updateSelectedProps({ values, pointCount: values.length });
}

function updatePaddingSide(side: "top" | "right" | "bottom" | "left", rawValue: string): void {
  const value = Number(rawValue);
  const errorField = `padding-${side}`;
  if (!Number.isFinite(value)) {
    setInspectorError(errorField, copy.value.inspector.errors.number(inspectorFieldLabel(`padding-${side}`)));
    return;
  }
  if (!Number.isInteger(value)) {
    setInspectorError(errorField, copy.value.inspector.errors.integer(inspectorFieldLabel(`padding-${side}`)));
    return;
  }
  if (value < 0) {
    setInspectorError(errorField, copy.value.inspector.errors.nonNegative(inspectorFieldLabel(`padding-${side}`)));
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

function inspectorFieldLabel(field: string): string {
  const fields = copy.value.inspector.fields;
  const labels: Record<string, string> = {
    arcLength: fields.arcLength,
    dpi: "DPI",
    gap: fields.gap,
    height: fields.height,
    letterSpace: fields.letterSpace,
    lineSpace: fields.lineSpace,
    max: fields.max,
    min: fields.min,
    opacity: fields.opacity,
    "padding-bottom": fields.paddingBottom,
    "padding-left": fields.paddingLeft,
    "padding-right": fields.paddingRight,
    "padding-top": fields.paddingTop,
    pointCount: fields.pointCount,
    radius: fields.radius,
    selected: fields.selected,
    spinTime: fields.spinTime,
    value: fields.value,
    values: fields.values,
    width: fields.width,
    x: "X",
    y: "Y"
  };
  return labels[field] ?? field;
}

function updateTargetNumber(field: "width" | "height" | "dpi", rawValue: string): void {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    setInspectorError(`target-${field}`, copy.value.inspector.errors.number(inspectorFieldLabel(field)));
    return;
  }
  if (value <= 0) {
    setInspectorError(`target-${field}`, copy.value.inspector.errors.greaterThanZero(inspectorFieldLabel(field)));
    return;
  }
  if (!Number.isInteger(value)) {
    setInspectorError(`target-${field}`, copy.value.inspector.errors.integer(inspectorFieldLabel(field)));
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
    setInspectorError("target-device-name", copy.value.inspector.errors.deviceNameRequired);
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

function addSelectedEvent(): void {
  if (!eventHandler.value.trim()) {
    return;
  }
  projectStore.addEventBinding(eventType.value, eventHandler.value.trim(), eventTargetWidgetId.value);
}

async function uploadAsset(file: File): Promise<void> {
  await uploadAssetAndRegister(file);
}

async function importReferenceAsset(file: File): Promise<void> {
  const asset = await uploadAssetAndRegister(file, { allowLocalFallback: true });
  if (asset?.kind === "image" && selectedWidget.value?.type === "image" && !selectedWidget.value.locked) {
    projectStore.bindSelectedImageAsset(asset.id);
    activeInspectorTab.value = "style";
    appendLog(copy.value.runtime.assetBoundFromPanel, "10:21:11");
  }
}

async function uploadAssetAndRegister(file: File, options: { allowLocalFallback?: boolean } = {}): Promise<AssetRef | null> {
  const saved = await saveProjectWithLog();
  if (!saved) {
    upsertLog("asset-upload-blocked", "10:21:11", copy.value.runtime.assetUploadSaveFailed);
    if (options.allowLocalFallback) {
      return importLocalAssetAndRegister(file);
    }
    return null;
  }
  if (isLocalOnlyProject()) {
    if (options.allowLocalFallback) {
      return importLocalAssetAndRegister(file);
    }
    assetsStore.error = copy.value.runtime.signInBeforeAssetsError;
    upsertLog("asset-upload-cloud-required", "10:21:11", copy.value.runtime.signInBeforeAssets);
    return null;
  }
  const asset = await assetsStore.uploadAsset(project.value.id, file);
  if (asset) {
    projectStore.registerAsset(asset);
    appendLog(copy.value.runtime.assetUploaded(asset.name), "10:21:11");
    return asset;
  }
  if (options.allowLocalFallback) {
    return importLocalAssetAndRegister(file);
  }
  return null;
}

function importLocalAssetAndRegister(file: File): AssetRef | null {
  const asset = assetsStore.importLocalAsset(project.value.id, file);
  if (!asset) {
    return null;
  }
  projectStore.registerAsset(asset);
  appendLog(copy.value.runtime.assetImportedLocally(asset.name), "10:21:11");
  return asset;
}

function bindAssetFromPanel(assetId: string): void {
  const widget = selectedWidget.value;
  if (!widget || widget.type !== "image" || widget.locked) {
    appendLog(copy.value.runtime.selectImageWidgetBeforeBinding, "10:21:11");
    return;
  }
  projectStore.bindSelectedImageAsset(assetId);
  activeInspectorTab.value = "style";
  appendLog(copy.value.runtime.assetBoundFromPanel, "10:21:11");
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
  const localOnlyAsset = isLocalAsset(assetId);
  projectStore.unregisterAsset(assetId);
  const saved = await saveProjectWithLog();
  if (!saved) {
    projectStore.undo();
    return;
  }
  const deleted = localOnlyAsset
    ? assetsStore.deleteLocalAsset(assetId)
    : await assetsStore.deleteAsset(project.value.id, assetId);
  if (!deleted) {
    projectStore.undo();
    await saveProjectWithLog();
    return;
  }
  appendLog(copy.value.runtime.assetDeleted(assetName), "10:21:11");
  focusAssetToolbarAfterDelete();
}

async function deleteReferencedAssetNow(assetId: string): Promise<void> {
  const assetName = project.value.assets.find((asset) => asset.id === assetId)?.name ?? assetId;
  const localOnlyAsset = isLocalAsset(assetId);
  projectStore.unregisterAsset(assetId);
  const saved = await saveProjectWithLog();
  if (!saved) {
    projectStore.undo();
    return;
  }
  const deleted = localOnlyAsset
    ? assetsStore.deleteLocalAsset(assetId)
    : await assetsStore.deleteAsset(project.value.id, assetId);
  if (!deleted) {
    projectStore.undo();
    await saveProjectWithLog();
    return;
  }
  appendLog(copy.value.runtime.assetDeleted(assetName), "10:21:11");
  focusAssetToolbarAfterDelete();
}

function focusAssetToolbarAfterDelete(): void {
  void nextTick(() => {
    (editorShellRef.value?.querySelector('[data-testid="asset-list-view-button"]') as HTMLElement | null)?.focus();
  });
}

async function deleteActiveScreen(): Promise<void> {
  if (!activeScreen.value) {
    return;
  }
  await projectStore.deleteScreen(activeScreen.value.id);
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
    if (!keyboardNudge.value || keyboardNudge.value.widgetId !== widget.id) {
      keyboardNudge.value = {
        widgetId: widget.id,
        startLayout: cloneLayout(widget.layout)
      };
    }
    projectStore.updateSelectedLayoutDraft({ x: widget.layout.x + dx, y: widget.layout.y + dy });
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
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    commitKeyboardNudge();
  }
}

function commitKeyboardNudge(): void {
  const session = keyboardNudge.value;
  if (!session) {
    return;
  }
  const widget = projectStore.selectedWidget?.id === session.widgetId
    ? projectStore.selectedWidget
    : null;
  if (widget) {
    projectStore.commitSelectedLayoutSnapshot(session.startLayout, cloneLayout(widget.layout), "Move widget");
  }
  keyboardNudge.value = null;
}

async function mountSimulator(): Promise<void> {
  if (simulatorRuntime.value) {
    return;
  }
  const canvas = simulatorCanvas.value;
  const mountGeneration = simulatorMountGeneration;
  if (!canvas || !simulatorVisible.value) {
    return;
  }
  if (simulatorMountInFlightGeneration === mountGeneration) {
    return;
  }
  simulatorMountInFlightGeneration = mountGeneration;
  try {
    simulatorStore.markLoading(copy.value.runtime.loadingRuntime);
    const runtime = await loadRuntime({
      wasmModuleUrl: simulatorWasmModuleUrl,
      assetResolver: (asset) => assetsStore.previewUrls[asset.id] ?? null
    });
    if (mountGeneration !== simulatorMountGeneration || !simulatorVisible.value || simulatorCanvas.value !== canvas) {
      runtime.destroy();
      return;
    }
    simulatorRuntime.value = runtime;
    simulatorStore.setRuntimeKind(simulatorRuntime.value.getRuntimeKind?.() ?? "unknown");
    await simulatorRuntime.value.mount(canvas);
    if (mountGeneration !== simulatorMountGeneration || !simulatorVisible.value || simulatorCanvas.value !== canvas) {
      simulatorRuntime.value?.destroy();
      simulatorRuntime.value = null;
      return;
    }
    simulatorStore.markReady(copy.value.runtime.simulatorLoaded);
    upsertLog("simulator-loaded", "10:21:13", copy.value.runtime.simulatorLoaded);
    await renderSimulator();
  } catch (error) {
    if (mountGeneration !== simulatorMountGeneration || !simulatorVisible.value || simulatorCanvas.value !== canvas) {
      return;
    }
    const message = simulatorErrorMessage(error, copy.value.runtime.runtimeLoadFailed);
    simulatorStore.markFailed(message);
    upsertLog("simulator-load-failed", "10:21:13", message);
  } finally {
    if (simulatorMountInFlightGeneration === mountGeneration) {
      simulatorMountInFlightGeneration = null;
    }
  }
}

async function renderSimulator(): Promise<boolean> {
  const runtime = simulatorRuntime.value;
  const canvas = simulatorCanvas.value;
  const renderGeneration = simulatorMountGeneration;
  if (!runtime || !canvas || !simulatorVisible.value) {
    return false;
  }
  try {
    const screenName = activeScreen.value?.name ?? "Screen_1";
    simulatorStore.markRendering(screenName, copy.value.runtime.renderScreen(screenName));
    await runtime.renderProject(projectDocForRuntime(project.value, activeScreen.value?.id ?? null));
    if (renderGeneration !== simulatorMountGeneration || simulatorRuntime.value !== runtime || simulatorCanvas.value !== canvas || !simulatorVisible.value) {
      return false;
    }
    simulatorStore.markReady(copy.value.runtime.previewUpdated);
    appendSimulatorRenderLog(screenName);
    upsertLog("preview-updated", "10:21:13", copy.value.runtime.previewUpdated);
    return true;
  } catch (error) {
    if (renderGeneration !== simulatorMountGeneration || simulatorRuntime.value !== runtime || simulatorCanvas.value !== canvas || !simulatorVisible.value) {
      return false;
    }
    const message = simulatorErrorMessage(error, copy.value.runtime.previewFailed);
    simulatorStore.markFailed(message);
    appendLog(message, "10:21:13");
    return false;
  }
}

function simulatorErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof SimulatorRuntimeError) {
    const summary = localizedErrorForCode(error.code, localeStore.locale, "RUNTIME_LOAD_FAILED");
    if (localeStore.locale === "en-US" && error.message) {
      return error.message.startsWith(summary) ? error.message : `${summary}: ${error.message}`;
    }
    return summary;
  }
  return error instanceof Error && localeStore.locale === "en-US" ? error.message : fallback;
}

function appendSimulatorRenderLog(screenName: string): void {
  upsertLog("simulator-render", "10:21:13", copy.value.runtime.renderScreen(screenName));
}

function localizedOperationError(error: unknown, fallbackCode: string, fallbackMessage: string): string {
  if (error instanceof Error && "code" in error) {
    return localizeError(error, localeStore.locale, fallbackCode);
  }
  return localizedErrorForCode(fallbackCode, localeStore.locale) || fallbackMessage;
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
