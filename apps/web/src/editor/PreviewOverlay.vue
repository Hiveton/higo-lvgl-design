<template>
  <section
    ref="overlayRef"
    class="preview-overlay"
    data-testid="preview-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Device preview"
    aria-labelledby="preview-dialog-title"
    aria-describedby="preview-screen-name preview-target-label preview-status-message"
    tabindex="-1"
    @click.self="emit('close')"
    @keydown.escape.prevent="emit('close')"
    @keydown.tab="handleTabKeydown"
  >
    <div class="preview-toolbar">
      <strong id="preview-dialog-title">Preview</strong>
      <span id="preview-screen-name" class="preview-meta-pill" data-testid="preview-screen-name">{{ activeScreenName }}</span>
      <span id="preview-target-label" class="preview-meta-pill" data-testid="preview-target-label">{{ targetLabel }}</span>
      <span
        id="preview-status-message"
        class="preview-meta-pill preview-status-message"
        data-testid="preview-status-message"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ previewStatusMessage }}
      </span>
      <button class="icon-button" type="button" data-testid="refresh-preview-button" :aria-label="refreshPreviewLabel" :title="refreshPreviewLabel" @click="emit('refresh')"><IconGlyph name="refresh" /></button>
      <button class="icon-button" type="button" data-testid="screenshot-preview-button" :aria-label="captureScreenshotLabel" :title="captureScreenshotLabel" @click="emit('screenshot')"><IconGlyph name="camera" /></button>
      <a
        v-if="previewScreenshotUrl"
        ref="previewScreenshotLinkRef"
        class="icon-button"
        data-testid="preview-screenshot-link"
        :href="previewScreenshotUrl"
        download="lvgl-preview.png"
        :aria-label="downloadScreenshotLabel"
        :title="downloadScreenshotLabel"
      >
        <IconGlyph name="download" />
      </a>
      <button class="icon-button" type="button" data-testid="close-preview-button" :aria-label="closePreviewLabel" :title="closePreviewLabel" @click="emit('close')"><IconGlyph name="close" /></button>
    </div>
    <div
      class="preview-device"
      data-testid="preview-device"
      role="img"
      :aria-label="previewDeviceLabel"
      :title="previewDeviceLabel"
      :style="previewDeviceStyle"
    >
      <div
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
          <small>{{ imagePlaceholderHint(item.widget) }}</small>
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
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { WidgetNode } from "@hiveton-lvgl/schema";
import type { RenderedWidget } from "./CanvasWorkspace.vue";
import IconGlyph from "./IconGlyph.vue";

const props = defineProps<{
  activeScreenName?: string;
  imagePreviewUrl: (widget: WidgetNode) => string | null;
  previewDeviceStyle: Record<string, string>;
  previewScreenshotUrl: string | null;
  previewStatusMessage: string;
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

const overlayRef = ref<HTMLElement | null>(null);
const previewScreenshotLinkRef = ref<HTMLAnchorElement | null>(null);
const previewName = computed(() => props.activeScreenName ?? "current screen");
const refreshPreviewLabel = computed(() => `Refresh ${previewName.value} preview`);
const captureScreenshotLabel = computed(() => `Capture ${previewName.value} preview screenshot`);
const downloadScreenshotLabel = computed(() => `Download ${previewName.value} preview screenshot`);
const closePreviewLabel = computed(() => `Close ${previewName.value} preview`);
const previewDeviceLabel = computed(() => `${previewName.value} preview on ${props.targetLabel}`);

onMounted(() => {
  void nextTick(() => {
    overlayRef.value?.focus();
  });
});

watch(
  () => props.previewScreenshotUrl,
  (url, previousUrl) => {
    if (!url || url === previousUrl) {
      return;
    }
    void nextTick(() => {
      previewScreenshotLinkRef.value?.focus();
    });
  }
);

function handleTabKeydown(event: KeyboardEvent): void {
  const focusableItems = overlayRef.value
    ? Array.from(
        overlayRef.value.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true")
    : [];
  if (!focusableItems.length) {
    event.preventDefault();
    overlayRef.value?.focus();
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

function propText(widget: WidgetNode, key: string, fallback: string): string {
  const value = widget.props[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function imagePlaceholderHint(widget: WidgetNode): string {
  return widget.props.assetId ? props.widgetText(widget) : "Select an asset";
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
