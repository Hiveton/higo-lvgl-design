<template>
  <section
    ref="overlayRef"
    class="preview-overlay"
    data-testid="preview-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="copy.previewRuntime.devicePreview"
    aria-labelledby="preview-dialog-title"
    aria-describedby="preview-screen-name preview-target-label preview-status-message"
    tabindex="-1"
    @click.self="emit('close')"
    @keydown.escape.prevent="emit('close')"
    @keydown.tab="handleTabKeydown"
  >
    <div class="preview-toolbar">
      <strong id="preview-dialog-title">{{ copy.previewRuntime.preview }}</strong>
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
      <button class="icon-button" type="button" data-testid="screenshot-preview-button" :disabled="previewScreenshotDisabled" :aria-label="captureScreenshotLabel" :title="captureScreenshotLabel" @click="emit('screenshot')"><IconGlyph name="camera" /></button>
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
          {{ copy.previewRuntime.imageMissing }}
          <small>{{ imagePlaceholderHint(item.widget) }}</small>
        </span>
        <button v-else-if="item.widget.type === 'button'" class="widget-content preview-text-button" type="button" tabindex="-1" :data-testid="`preview-control-${toTestId(item.widget.name)}`" @click="emitPreviewEvent(item.widget, 'LV_EVENT_CLICKED')">
          {{ widgetText(item.widget) }}
        </button>
        <span v-else-if="item.widget.type === 'label' || item.widget.type === 'container'" class="widget-content">{{ widgetText(item.widget) }}</span>
        <button v-else-if="item.widget.type === 'checkbox'" class="widget-control checkbox-preview preview-control-button" type="button" :data-testid="`preview-control-${toTestId(item.widget.name)}`" :aria-pressed="previewChecked(item.widget) ? 'true' : 'false'" @click="togglePreviewChecked(item.widget)">
          <span class="checkbox-box" :class="{ checked: previewChecked(item.widget) }" />
          <span>{{ propText(item.widget, 'text', item.widget.name) }}</span>
        </button>
        <button v-else-if="item.widget.type === 'switch'" class="widget-control switch-preview preview-control-button" :class="{ checked: previewChecked(item.widget) }" type="button" :data-testid="`preview-control-${toTestId(item.widget.name)}`" :aria-pressed="previewChecked(item.widget) ? 'true' : 'false'" @click="togglePreviewChecked(item.widget)">
          <span class="switch-thumb" />
        </button>
        <span v-else-if="item.widget.type === 'slider' || item.widget.type === 'bar'" class="widget-control range-preview">
          <span class="range-track">
            <span class="range-fill" :style="{ width: `${previewValuePercent(item.widget)}%` }" />
            <span v-if="item.widget.type === 'slider'" class="range-thumb" :style="{ left: `${previewValuePercent(item.widget)}%` }" />
          </span>
          <input
            v-if="item.widget.type === 'slider'"
            class="preview-range-input"
            type="range"
            :data-testid="`preview-control-${toTestId(item.widget.name)}`"
            :min="propNumber(item.widget, 'min', 0)"
            :max="propNumber(item.widget, 'max', 100)"
            :value="previewNumber(item.widget, 'value', 0)"
            @input="setPreviewNumber(item.widget, 'value', inputValue($event))"
          />
        </span>
        <span v-else-if="item.widget.type === 'arc'" class="widget-control arc-preview" :style="arcStyle(item.widget)">
          <span>{{ previewValuePercent(item.widget) }}%</span>
        </span>
        <span v-else-if="item.widget.type === 'line'" class="widget-control line-preview" />
        <select v-else-if="item.widget.type === 'dropdown'" class="widget-control dropdown-preview preview-select" :data-testid="`preview-control-${toTestId(item.widget.name)}`" :value="previewNumber(item.widget, 'selected', 0)" @change="setPreviewNumber(item.widget, 'selected', inputValue($event))">
          <option v-for="(option, index) in dropdownOptions(item.widget)" :key="`${item.widget.id}-${option}-${index}`" :value="index">{{ option }}</option>
        </select>
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
import type { EventBinding, WidgetNode } from "@hiveton-lvgl/schema";
import { useCopy } from "../i18n/useCopy";
import type { RenderedWidget } from "./CanvasWorkspace.vue";
import IconGlyph from "./IconGlyph.vue";

const props = defineProps<{
  activeScreenName?: string;
  eventBindings: EventBinding[];
  imagePreviewUrl: (widget: WidgetNode) => string | null;
  previewDeviceStyle: Record<string, string>;
  previewScreenshotUrl: string | null;
  previewScreenshotDisabled: boolean;
  previewStatusMessage: string;
  renderedWidgets: RenderedWidget[];
  targetLabel: string;
  toTestId: (name: string) => string;
  widgetStyle: (item: RenderedWidget) => Record<string, string>;
  widgetText: (widget: WidgetNode) => string;
}>();

const emit = defineEmits<{
  close: [];
  "preview-interaction": [];
  "preview-event": [widgetId: string, eventName: EventBinding["event"]];
  refresh: [];
  screenshot: [];
}>();

const overlayRef = ref<HTMLElement | null>(null);
const previewScreenshotLinkRef = ref<HTMLAnchorElement | null>(null);
const previewProps = ref<Record<string, Record<string, number | boolean>>>({});
const copy = useCopy();
const previewName = computed(() => props.activeScreenName ?? copy.value.previewRuntime.currentScreen);
const refreshPreviewLabel = computed(() => copy.value.previewRuntime.refreshPreview(previewName.value));
const captureScreenshotLabel = computed(() => copy.value.previewRuntime.capturePreviewScreenshot(previewName.value));
const downloadScreenshotLabel = computed(() => copy.value.previewRuntime.downloadPreviewScreenshot(previewName.value));
const closePreviewLabel = computed(() => copy.value.previewRuntime.closePreview(previewName.value));
const previewDeviceLabel = computed(() => copy.value.previewRuntime.previewDevice(previewName.value, props.targetLabel));

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
      ).filter((element) => element.tabIndex >= 0 && !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true")
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
  return widget.props.assetId ? props.widgetText(widget) : copy.value.previewRuntime.selectAsset;
}

function propNumber(widget: WidgetNode, key: string, fallback: number): number {
  const value = widget.props[key];
  return typeof value === "number" ? value : fallback;
}

function previewNumber(widget: WidgetNode, key: string, fallback: number): number {
  const value = previewProps.value[widget.id]?.[key] ?? widget.props[key];
  return typeof value === "number" ? value : fallback;
}

function previewChecked(widget: WidgetNode): boolean {
  const value = previewProps.value[widget.id]?.checked ?? widget.props.checked;
  return value === true;
}

function setPreviewNumber(widget: WidgetNode, key: string, rawValue: string): void {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return;
  }
  setPreviewProp(widget.id, key, value);
  emit("preview-interaction");
  emitPreviewEvent(widget, "LV_EVENT_VALUE_CHANGED");
}

function togglePreviewChecked(widget: WidgetNode): void {
  setPreviewProp(widget.id, "checked", !previewChecked(widget));
  emit("preview-interaction");
  emitPreviewEvent(widget, "LV_EVENT_VALUE_CHANGED");
}

function emitPreviewEvent(widget: WidgetNode, eventName: EventBinding["event"]): void {
  if (props.eventBindings.some((binding) => binding.widgetId === widget.id && binding.event === eventName)) {
    emit("preview-event", widget.id, eventName);
  }
}

function setPreviewProp(widgetId: string, key: string, value: number | boolean): void {
  previewProps.value = {
    ...previewProps.value,
    [widgetId]: {
      ...previewProps.value[widgetId],
      [key]: value
    }
  };
}

function previewValuePercent(widget: WidgetNode): number {
  const min = propNumber(widget, "min", 0);
  const max = propNumber(widget, "max", 100);
  const value = previewNumber(widget, "value", 0);
  if (max <= min) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(((value - min) / (max - min)) * 100)));
}

function arcStyle(widget: WidgetNode): Record<string, string> {
  const degrees = Math.round(previewValuePercent(widget) * 3.6);
  return {
    background: `conic-gradient(#2f9bff 0deg ${degrees}deg, rgba(255, 255, 255, 0.12) ${degrees}deg 360deg)`
  };
}

function dropdownOptions(widget: WidgetNode): string[] {
  const options = propText(widget, "options", copy.value.previewRuntime.dropdownDefaultOptions).split(/\r?\n/).filter(Boolean);
  return options.length ? options : [copy.value.previewRuntime.dropdownFallback];
}

function chartBarHeights(widget: WidgetNode): number[] {
  const values = widget.props.values;
  const min = propNumber(widget, "min", 0);
  const max = propNumber(widget, "max", 100);
  const pointCount = Math.max(1, Math.floor(propNumber(widget, "pointCount", 8)));
  const rawValues = Array.isArray(values) && values.length > 0
    ? values.filter((value) => Number.isFinite(value)).slice(0, pointCount).map((value) => Math.max(min, Math.min(max, value)))
    : Array.from({ length: pointCount }, (_unused, index) => min + ((index * 37 + 20) % (Math.max(0, max - min) + 1)));
  if (!rawValues.length) {
    return [min];
  }
  const span = Math.max(1, max - min);
  return rawValues.map((value) => Math.max(4, Math.min(100, Math.round(((value - min) / span) * 100))));
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement).value;
}
</script>
