<template>
  <section class="center-region">
    <div class="canvas-toolbar">
      <strong>Canvas</strong>
      <span data-testid="active-screen-label">{{ activeScreenName }}</span>
      <span class="toolbar-spacer" />
      <button class="select-like" data-testid="canvas-target-settings-button" @click="emit('show-settings')">
        {{ project.target.width }} x {{ project.target.height }} ˅
      </button>
      <button class="icon-button" aria-label="Fit view" data-testid="fit-view-button" @click="emit('fit-view')">⤢</button>
      <button class="icon-button" aria-label="Fullscreen canvas" data-testid="fullscreen-canvas-button" @click="emit('fullscreen-canvas')">⛶</button>
      <select class="select-like" data-testid="zoom-select" :value="zoomPercent" @change="updateZoom">
        <option v-for="level in zoomLevels" :key="level" :value="level">{{ level }}%</option>
      </select>
    </div>
    <div v-if="activeCenterPanel === 'code'" class="code-stage">
      <pre data-testid="code-preview">{{ codePreview }}</pre>
    </div>
    <div v-else-if="activeCenterPanel === 'settings'" class="settings-stage" data-testid="settings-panel">
      <section class="settings-card">
        <h2>Project Settings</h2>
        <div class="settings-form">
          <label>Project Name<input data-testid="settings-project-name-input" :value="project.name" @input="emitText('rename-project', $event)" /></label>
          <label>
            Device
            <input data-testid="settings-target-device-name-input" :value="project.target.deviceName" @input="emitText('update-target-device-name', $event)" />
            <p v-if="inspectorErrors['target-device-name']" class="field-error" data-testid="settings-target-device-name-error">{{ inspectorErrors['target-device-name'] }}</p>
          </label>
          <label>
            LVGL Version
            <select data-testid="settings-target-lvgl-version-select" :value="project.target.lvglVersion" @change="emitText('update-target-lvgl-version', $event)">
              <option value="8.3">8.3</option>
            </select>
          </label>
          <div class="settings-form-row">
            <label>
              Width
              <input data-testid="settings-target-width-input" :value="project.target.width" @input="emitTargetNumber('width', $event)" />
              <p v-if="inspectorErrors['target-width']" class="field-error" data-testid="settings-target-width-error">{{ inspectorErrors['target-width'] }}</p>
            </label>
            <label>
              Height
              <input data-testid="settings-target-height-input" :value="project.target.height" @input="emitTargetNumber('height', $event)" />
              <p v-if="inspectorErrors['target-height']" class="field-error" data-testid="settings-target-height-error">{{ inspectorErrors['target-height'] }}</p>
            </label>
          </div>
          <div class="settings-form-row">
            <label>
              DPI
              <input data-testid="settings-target-dpi-input" :value="project.target.dpi" @input="emitTargetNumber('dpi', $event)" />
              <p v-if="inspectorErrors['target-dpi']" class="field-error" data-testid="settings-target-dpi-error">{{ inspectorErrors['target-dpi'] }}</p>
            </label>
            <label>
              Color Depth
              <select data-testid="settings-target-color-depth-select" :value="project.target.colorDepth" @change="emitText('update-target-color-depth', $event)">
                <option value="16">16 bit</option>
                <option value="32">32 bit</option>
              </select>
            </label>
          </div>
          <label>
            Theme
            <select data-testid="settings-theme-select" :value="project.theme" @change="emitTheme">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
        </div>
        <div class="settings-summary">
          <span>Target</span>
          <strong>LVGL {{ project.target.lvglVersion }} / {{ project.target.deviceName }} / {{ project.target.width }} x {{ project.target.height }} / {{ project.target.dpi }} DPI</strong>
          <span>Save</span>
          <strong>{{ saveStateLabel }}</strong>
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
          <div class="device-surface" :style="deviceSurfaceStyle">
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
import { onMounted, ref } from "vue";
import type { ProjectDoc, WidgetNode } from "@hiveton-lvgl/schema";
import WidgetRenderer from "./WidgetRenderer.vue";

export type RenderedWidget = {
  widget: WidgetNode;
  x: number;
  y: number;
};

defineProps<{
  activeCenterPanel: "canvas" | "code" | "settings";
  activeScreenName?: string;
  alignmentGuides: { vertical: number[]; horizontal: number[] };
  artboardStyle: Record<string, string>;
  canvasPanStyle: Record<string, string>;
  codePreview: string;
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
  "artboard-mounted": [element: HTMLElement];
  "drop-widget": [event: DragEvent];
  "fit-view": [];
  "fullscreen-canvas": [];
  "rename-project": [name: string];
  "select-widget": [widgetId: string];
  "show-settings": [];
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
