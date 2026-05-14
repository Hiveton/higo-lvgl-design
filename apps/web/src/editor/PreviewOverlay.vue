<template>
  <section class="preview-overlay" data-testid="preview-overlay" @click.self="emit('close')">
    <div class="preview-toolbar">
      <strong>Preview</strong>
      <span data-testid="preview-screen-name">{{ activeScreenName }}</span>
      <span>{{ targetLabel }}</span>
      <button class="select-like" data-testid="refresh-preview-button" @click="emit('refresh')">Refresh</button>
      <button class="select-like" data-testid="screenshot-preview-button" @click="emit('screenshot')">Screenshot</button>
      <a
        v-if="previewScreenshotUrl"
        class="download-link"
        data-testid="preview-screenshot-link"
        :href="previewScreenshotUrl"
        download="lvgl-preview.png"
      >
        Download Screenshot
      </a>
      <button class="select-like" data-testid="close-preview-button" @click="emit('close')">Close</button>
    </div>
    <div class="preview-device" :style="previewDeviceStyle">
      <button
        v-for="item in renderedWidgets"
        :key="item.widget.id"
        class="canvas-widget preview-widget"
        :data-testid="`preview-widget-${toTestId(item.widget.name)}`"
        :style="widgetStyle(item)"
      >
        <img
          v-if="imagePreviewUrl(item.widget)"
          class="widget-image-preview"
          :src="imagePreviewUrl(item.widget) ?? ''"
          :alt="widgetText(item.widget)"
        />
        <span v-else-if="item.widget.type === 'image'" class="widget-content image-placeholder">
          Missing preview
          <small>{{ widgetText(item.widget) }}</small>
        </span>
        <span v-else-if="item.widget.type === 'label' || item.widget.type === 'button' || item.widget.type === 'container'" class="widget-content">
          {{ widgetText(item.widget) }}
        </span>
        <span v-else-if="item.widget.type === 'checkbox'" class="widget-control checkbox-preview">
          <span class="checkbox-box" :class="{ checked: item.widget.props.checked === true }" />
          <span>{{ propText(item.widget, 'text', item.widget.name) }}</span>
        </span>
        <span v-else-if="item.widget.type === 'switch'" class="widget-control switch-preview" :class="{ checked: item.widget.props.checked === true }">
          <span class="switch-thumb" />
        </span>
        <span v-else-if="item.widget.type === 'slider' || item.widget.type === 'bar'" class="widget-control range-preview">
          <span class="range-track">
            <span class="range-fill" :style="{ width: `${valuePercent(item.widget)}%` }" />
            <span v-if="item.widget.type === 'slider'" class="range-thumb" :style="{ left: `${valuePercent(item.widget)}%` }" />
          </span>
        </span>
        <span v-else-if="item.widget.type === 'arc'" class="widget-control arc-preview" :style="arcStyle(item.widget)">
          <span>{{ valuePercent(item.widget) }}%</span>
        </span>
        <span v-else-if="item.widget.type === 'line'" class="widget-control line-preview" />
        <span v-else-if="item.widget.type === 'dropdown'" class="widget-control dropdown-preview">
          <span>{{ selectedDropdownOption(item.widget) }}</span>
          <span>⌄</span>
        </span>
        <span v-else-if="item.widget.type === 'spinner'" class="widget-control spinner-preview" />
        <span v-else-if="item.widget.type === 'chart'" class="widget-control chart-preview">
          <span v-for="(height, index) in chartBarHeights(item.widget)" :key="index" :style="{ height: `${height}%` }" />
        </span>
        <span v-else class="widget-content">{{ widgetText(item.widget) }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { WidgetNode } from "@hiveton-lvgl/schema";
import type { RenderedWidget } from "./CanvasWorkspace.vue";

defineProps<{
  activeScreenName?: string;
  imagePreviewUrl: (widget: WidgetNode) => string | null;
  previewDeviceStyle: Record<string, string>;
  previewScreenshotUrl: string | null;
  renderedWidgets: RenderedWidget[];
  targetLabel: string;
  toTestId: (name: string) => string;
  widgetStyle: (item: RenderedWidget) => Record<string, string>;
  widgetText: (widget: WidgetNode) => string;
}>();

const emit = defineEmits<{
  close: [];
  refresh: [];
  screenshot: [];
}>();

function propText(widget: WidgetNode, key: string, fallback: string): string {
  const value = widget.props[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function propNumber(widget: WidgetNode, key: string, fallback: number): number {
  const value = widget.props[key];
  return typeof value === "number" ? value : fallback;
}

function valuePercent(widget: WidgetNode): number {
  const min = propNumber(widget, "min", 0);
  const max = propNumber(widget, "max", 100);
  const value = propNumber(widget, "value", 0);
  if (max <= min) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(((value - min) / (max - min)) * 100)));
}

function arcStyle(widget: WidgetNode): Record<string, string> {
  const degrees = Math.round(valuePercent(widget) * 3.6);
  return {
    background: `conic-gradient(#2f9bff 0deg ${degrees}deg, rgba(255, 255, 255, 0.12) ${degrees}deg 360deg)`
  };
}

function selectedDropdownOption(widget: WidgetNode): string {
  const options = propText(widget, "options", "Option 1\nOption 2").split(/\r?\n/).filter(Boolean);
  return options[propNumber(widget, "selected", 0)] ?? options[0] ?? "Dropdown";
}

function chartBarHeights(widget: WidgetNode): number[] {
  const values = widget.props.values;
  const rawValues = Array.isArray(values) && values.length > 0
    ? values.filter((value) => Number.isFinite(value))
    : Array.from({ length: 6 }, (_unused, index) => 24 + (((index + 1) * 19) % 58));
  if (!rawValues.length) {
    return [24, 43, 62, 81, 42, 61];
  }
  const min = propNumber(widget, "min", 0);
  const max = propNumber(widget, "max", 100);
  const span = Math.max(1, max - min);
  return rawValues.map((value) => Math.max(4, Math.min(100, Math.round(((value - min) / span) * 100))));
}
</script>
