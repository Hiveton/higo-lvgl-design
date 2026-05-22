<template>
  <section class="center-region">
    <div class="canvas-toolbar">
      <strong data-testid="center-panel-title">{{ centerPanelTitle }}</strong>
      <span class="screen-tab" data-testid="active-screen-label">{{ activeScreenName }}</span>
      <button class="mini-action screen-tab-add" aria-label="Add screen from canvas toolbar" title="Add screen from canvas toolbar" data-testid="canvas-add-screen-button" type="button" @click="emit('add-screen')"><IconGlyph name="add" /></button>
      <span class="toolbar-spacer" />
      <button
        class="select-like"
        type="button"
        data-testid="canvas-target-settings-button"
        :aria-label="`Open target settings for ${project.target.width} x ${project.target.height}`"
        :title="`Open target settings for ${project.target.width} x ${project.target.height}`"
        @click="emit('show-settings')"
      >
        {{ project.target.width }} x {{ project.target.height }} ˅
      </button>
      <button class="icon-button" type="button" :aria-label="fitViewLabel" :title="fitViewLabel" data-testid="fit-view-button" @click="emit('fit-view')"><IconGlyph name="fit" /></button>
      <button class="icon-button" type="button" :aria-label="fullscreenCanvasLabel" :title="fullscreenCanvasLabel" data-testid="fullscreen-canvas-button" @click="emit('fullscreen-canvas')"><IconGlyph name="fullscreen" /></button>
      <select class="select-like" data-testid="zoom-select" aria-label="Canvas zoom" title="Canvas zoom" :value="zoomPercent" @change="updateZoom">
        <option v-for="level in zoomLevels" :key="level" :value="level">{{ level }}%</option>
      </select>
    </div>
    <div v-if="activeCenterPanel === 'code'" class="code-stage">
      <header class="code-stage-header">
        <div>
          <span class="panel-kicker">Generated Source</span>
          <strong>{{ activeScreenName ?? "Screen" }}.c</strong>
        </div>
        <div class="code-stage-meta">
          <span data-testid="code-line-count">{{ codeLineCount }} lines</span>
          <span>{{ project.target.lvglVersion }} / {{ project.target.colorDepth }} bit</span>
        </div>
        <div class="code-stage-actions">
          <button class="mini-action" type="button" data-testid="copy-code-button" :aria-label="copyCodeLabel" :title="copyCodeLabel" @click="emit('copy-generated-code')"><IconGlyph name="copy" /></button>
          <button class="select-like" type="button" data-testid="code-back-to-canvas-button" :aria-label="backToCanvasLabel" :title="backToCanvasLabel" @click="emit('show-canvas')">Back to Canvas</button>
        </div>
      </header>
      <p class="code-stage-status" data-testid="code-copy-status" role="status" aria-live="polite" aria-atomic="true">{{ codeCopyStatus }}</p>
      <pre data-testid="code-preview">{{ codePreview }}</pre>
    </div>
    <div v-else-if="activeCenterPanel === 'settings'" class="settings-stage" data-testid="settings-panel">
      <section class="settings-card">
        <div class="settings-card-header">
          <h2>Project Settings</h2>
          <button class="select-like" type="button" data-testid="settings-back-to-canvas-button" :aria-label="backToCanvasLabel" :title="backToCanvasLabel" @click="emit('show-canvas')">Back to Canvas</button>
        </div>
        <div class="settings-form">
          <label>Project Name<input data-testid="settings-project-name-input" aria-label="Project name" title="Project name" :value="project.name" @input="emitText('rename-project', $event)" /></label>
          <label>
            Device
            <input data-testid="settings-target-device-name-input" aria-label="Target device name" title="Target device name" :value="project.target.deviceName" :aria-invalid="inspectorErrors['target-device-name'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-device-name'] ? 'settings-target-device-name-error' : undefined" @input="emitText('update-target-device-name', $event)" />
            <p v-if="inspectorErrors['target-device-name']" id="settings-target-device-name-error" class="field-error" data-testid="settings-target-device-name-error" role="alert">{{ inspectorErrors['target-device-name'] }}</p>
          </label>
          <label>
            LVGL Version
            <select data-testid="settings-target-lvgl-version-select" aria-label="Target LVGL version" title="Target LVGL version" :value="project.target.lvglVersion" @change="emitText('update-target-lvgl-version', $event)">
              <option value="8.3">8.3</option>
            </select>
          </label>
          <div class="settings-form-row">
            <label>
              Width
              <input data-testid="settings-target-width-input" type="number" aria-label="Target width" title="Target width" min="1" step="1" :value="project.target.width" :aria-invalid="inspectorErrors['target-width'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-width'] ? 'settings-target-width-error' : undefined" @input="emitTargetNumber('width', $event)" />
              <p v-if="inspectorErrors['target-width']" id="settings-target-width-error" class="field-error" data-testid="settings-target-width-error" role="alert">{{ inspectorErrors['target-width'] }}</p>
            </label>
            <label>
              Height
              <input data-testid="settings-target-height-input" type="number" aria-label="Target height" title="Target height" min="1" step="1" :value="project.target.height" :aria-invalid="inspectorErrors['target-height'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-height'] ? 'settings-target-height-error' : undefined" @input="emitTargetNumber('height', $event)" />
              <p v-if="inspectorErrors['target-height']" id="settings-target-height-error" class="field-error" data-testid="settings-target-height-error" role="alert">{{ inspectorErrors['target-height'] }}</p>
            </label>
          </div>
          <div class="settings-form-row">
            <label>
              DPI
              <input data-testid="settings-target-dpi-input" type="number" aria-label="Target DPI" title="Target DPI" min="1" step="1" :value="project.target.dpi" :aria-invalid="inspectorErrors['target-dpi'] ? 'true' : undefined" :aria-describedby="inspectorErrors['target-dpi'] ? 'settings-target-dpi-error' : undefined" @input="emitTargetNumber('dpi', $event)" />
              <p v-if="inspectorErrors['target-dpi']" id="settings-target-dpi-error" class="field-error" data-testid="settings-target-dpi-error" role="alert">{{ inspectorErrors['target-dpi'] }}</p>
            </label>
            <label>
              Color Depth
              <select data-testid="settings-target-color-depth-select" aria-label="Target color depth" title="Target color depth" :value="project.target.colorDepth" @change="emitText('update-target-color-depth', $event)">
                <option value="16">16 bit</option>
                <option value="32">32 bit</option>
              </select>
            </label>
          </div>
          <label>
            Theme
            <select data-testid="settings-theme-select" aria-label="Project theme" title="Project theme" :value="project.theme" @change="emitTheme">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
        </div>
        <div class="settings-summary">
          <span>Target</span>
          <strong class="settings-summary-value" data-testid="settings-summary-target">LVGL {{ project.target.lvglVersion }} / {{ project.target.deviceName }} / {{ project.target.width }} x {{ project.target.height }} / {{ project.target.dpi }} DPI</strong>
          <span>Save</span>
          <strong class="settings-summary-value" data-testid="settings-summary-save">{{ saveStateLabel }}</strong>
        </div>
      </section>
    </div>
    <div v-else class="canvas-stage" data-testid="canvas-stage" @mousedown="emit('start-canvas-pan', $event)">
      <div class="canvas-pan" :style="canvasPanStyle" data-testid="canvas-pan">
        <div class="ruler ruler-top" :style="rulerTopStyle" data-testid="ruler-top">
          <span
            v-for="tick in rulerXTicks"
            :key="`x-${tick}`"
            class="ruler-tick"
            :style="{ left: `${tick}px` }"
          >
            {{ tick }}
          </span>
        </div>
        <div class="ruler ruler-left" :style="rulerLeftStyle" data-testid="ruler-left">
          <span
            v-for="tick in rulerYTicks"
            :key="`y-${tick}`"
            class="ruler-tick"
            :style="{ top: `${tick}px` }"
          >
            {{ tick }}
          </span>
        </div>
        <div
          ref="artboardRef"
          class="artboard"
          :class="{ 'show-grid': gridEnabled }"
          :style="artboardStyle"
          data-testid="artboard"
          @mousemove="emit('update-mouse-coordinates', $event)"
          @dragover.prevent
          @drop.prevent="emit('drop-widget', $event)"
        >
          <span
            v-for="guide in alignmentGuides.vertical"
            :key="`v-${guide}`"
            class="alignment-guide vertical"
            data-testid="alignment-guide-vertical"
            :style="{ left: `${guide}px` }"
          />
          <span
            v-for="guide in alignmentGuides.horizontal"
            :key="`h-${guide}`"
            class="alignment-guide horizontal"
            data-testid="alignment-guide-horizontal"
            :style="{ top: `${guide}px` }"
          />
          <div class="device-surface" :class="{ empty: renderedWidgets.length === 0 }" :style="deviceSurfaceStyle" data-testid="device-surface">
            <WidgetRenderer
              v-for="item in renderedWidgets"
              :key="item.widget.id"
              :image-preview-url="imagePreviewUrl"
              :item="item"
              :selected-widget-id="selectedWidget?.id ?? null"
              :to-test-id="toTestId"
              :widget-style="widgetStyle"
              :widget-text="widgetText"
              @select-widget="emit('select-widget', $event)"
              @start-move="(widget, event) => emit('start-move', widget, event)"
              @start-resize="(widget, event) => emit('start-resize', widget, event)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { ProjectDoc, WidgetNode } from "@hiveton-lvgl/schema";
import IconGlyph from "./IconGlyph.vue";
import WidgetRenderer from "./WidgetRenderer.vue";

export type RenderedWidget = {
  widget: WidgetNode;
  x: number;
  y: number;
};

const props = defineProps<{
  activeCenterPanel: "canvas" | "code" | "settings";
  activeScreenName?: string;
  alignmentGuides: { vertical: number[]; horizontal: number[] };
  artboardStyle: Record<string, string>;
  canvasPanStyle: Record<string, string>;
  codePreview: string;
  codeCopyStatus: string;
  deviceSurfaceStyle: Record<string, string>;
  gridEnabled: boolean;
  imagePreviewUrl: (widget: WidgetNode) => string | null;
  inspectorErrors: Record<string, string>;
  project: ProjectDoc;
  renderedWidgets: RenderedWidget[];
  rulerLeftStyle: Record<string, string>;
  rulerTopStyle: Record<string, string>;
  rulerXTicks: number[];
  rulerYTicks: number[];
  saveStateLabel: string;
  selectedWidget: WidgetNode | null;
  toTestId: (name: string) => string;
  widgetStyle: (item: RenderedWidget) => Record<string, string>;
  widgetText: (widget: WidgetNode) => string;
  zoomLevels: number[];
  zoomPercent: number;
}>();

const emit = defineEmits<{
  "add-screen": [];
  "artboard-mounted": [element: HTMLElement];
  "copy-generated-code": [];
  "drop-widget": [event: DragEvent];
  "fit-view": [];
  "fullscreen-canvas": [];
  "rename-project": [name: string];
  "select-widget": [widgetId: string];
  "show-settings": [];
  "show-canvas": [];
  "start-canvas-pan": [event: MouseEvent];
  "start-move": [widget: WidgetNode, event: MouseEvent];
  "start-resize": [widget: WidgetNode, event: MouseEvent];
  "update-mouse-coordinates": [event: MouseEvent];
  "update-target-color-depth": [value: string];
  "update-target-device-name": [value: string];
  "update-target-lvgl-version": [value: string];
  "update-target-number": [field: "width" | "height" | "dpi", value: string];
  "update-theme": [theme: ProjectDoc["theme"]];
  "update:zoom-percent": [zoom: number];
}>();

const artboardRef = ref<HTMLElement | null>(null);
const codeLineCount = computed(() => props.codePreview.split("\n").filter(Boolean).length);
const canvasScreenName = computed(() => props.activeScreenName ?? "current screen");
const codeFileName = computed(() => `${props.activeScreenName ?? "Screen"}.c`);
const copyCodeLabel = computed(() => `Copy generated code for ${codeFileName.value}`);
const fitViewLabel = computed(() => `Fit ${canvasScreenName.value} canvas view`);
const fullscreenCanvasLabel = computed(() => `Open ${canvasScreenName.value} canvas fullscreen`);
const backToCanvasLabel = computed(() => `Back to ${canvasScreenName.value} canvas`);
const centerPanelTitle = computed(() => {
  if (props.activeCenterPanel === "code") {
    return "Code";
  }
  if (props.activeCenterPanel === "settings") {
    return "Settings";
  }
  return "Canvas";
});

onMounted(() => {
  if (artboardRef.value) {
    emit("artboard-mounted", artboardRef.value);
  }
});

function updateZoom(event: Event): void {
  emit("update:zoom-percent", Number((event.target as HTMLSelectElement).value));
}

function emitText(
  eventName: "rename-project" | "update-target-device-name" | "update-target-lvgl-version" | "update-target-color-depth",
  event: Event
): void {
  const value = (event.target as HTMLInputElement | HTMLSelectElement).value;
  if (eventName === "rename-project") {
    emit("rename-project", value);
    return;
  }
  if (eventName === "update-target-device-name") {
    emit("update-target-device-name", value);
    return;
  }
  if (eventName === "update-target-lvgl-version") {
    emit("update-target-lvgl-version", value);
    return;
  }
  emit("update-target-color-depth", value);
}

function emitTargetNumber(field: "width" | "height" | "dpi", event: Event): void {
  emit("update-target-number", field, (event.target as HTMLInputElement).value);
}

function emitTheme(event: Event): void {
  const theme = (event.target as HTMLSelectElement).value;
  if (theme === "dark" || theme === "light") {
    emit("update-theme", theme);
  }
}
</script>
