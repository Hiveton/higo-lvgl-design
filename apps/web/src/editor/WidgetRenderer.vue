<template>
  <button
    class="canvas-widget"
    type="button"
    :class="{ selected: selected }"
    :data-testid="`canvas-widget-${toTestId(item.widget.name)}`"
    :aria-label="canvasWidgetActionLabel"
    :aria-pressed="selected ? 'true' : 'false'"
    :title="canvasWidgetActionLabel"
    :style="widgetStyle(item)"
    @click="emit('select-widget', item.widget.id)"
    @mousedown="emit('start-move', item.widget, $event)"
  >
    <span v-if="selected" class="selected-widget-label">
      {{ item.widget.name }}
    </span>
    <img
      v-if="previewUrl"
      class="widget-image-preview"
      :src="previewUrl"
      :alt="widgetText(item.widget)"
    />
    <span v-else-if="item.widget.type === 'image'" class="widget-content image-placeholder">
      {{ copy.previewRuntime.imageMissing }}
      <small>{{ imagePlaceholderHint }}</small>
    </span>
    <span v-else-if="item.widget.type === 'label' || item.widget.type === 'button' || item.widget.type === 'container'" class="widget-content">
      {{ widgetText(item.widget) }}
    </span>
    <span v-else-if="item.widget.type === 'checkbox'" class="widget-control checkbox-preview">
      <span class="checkbox-box" :class="{ checked: isChecked }" />
      <span>{{ propText("text", item.widget.name) }}</span>
    </span>
    <span v-else-if="item.widget.type === 'switch'" class="widget-control switch-preview" :class="{ checked: isChecked }">
      <span class="switch-thumb" />
    </span>
    <span v-else-if="item.widget.type === 'slider' || item.widget.type === 'bar'" class="widget-control range-preview">
      <span class="range-track">
        <span class="range-fill" :style="{ width: `${valuePercent}%` }" />
        <span v-if="item.widget.type === 'slider'" class="range-thumb" :style="{ left: `${valuePercent}%` }" />
      </span>
    </span>
    <span v-else-if="item.widget.type === 'arc'" class="widget-control arc-preview" :style="arcStyle">
      <span>{{ valuePercent }}%</span>
    </span>
    <span v-else-if="item.widget.type === 'line'" class="widget-control line-preview" />
    <span v-else-if="item.widget.type === 'dropdown'" class="widget-control dropdown-preview">
      <span>{{ selectedDropdownOption }}</span>
      <span>⌄</span>
    </span>
    <span v-else-if="item.widget.type === 'spinner'" class="widget-control spinner-preview" />
    <span v-else-if="item.widget.type === 'chart'" class="widget-control chart-preview">
      <span v-for="(height, index) in chartBarHeights" :key="index" :style="{ height: `${height}%` }" />
    </span>
    <span v-else class="widget-content">{{ widgetText(item.widget) }}</span>
    <span
      v-if="selected"
      class="resize-handle"
      :data-testid="`resize-handle-${toTestId(item.widget.name)}`"
      :title="resizeHandleTitle"
      @mousedown.stop="emit('start-resize', item.widget, $event)"
    />
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { WidgetNode } from "@hiveton-lvgl/schema";
import { useCopy } from "../i18n/useCopy";
import type { RenderedWidget } from "./CanvasWorkspace.vue";

const props = defineProps<{
  imagePreviewUrl: (widget: WidgetNode) => string | null;
  item: RenderedWidget;
  selectedWidgetId: string | null;
  toTestId: (name: string) => string;
  widgetStyle: (item: RenderedWidget) => Record<string, string>;
  widgetText: (widget: WidgetNode) => string;
}>();

const emit = defineEmits<{
  "select-widget": [widgetId: string];
  "start-move": [widget: WidgetNode, event: MouseEvent];
  "start-resize": [widget: WidgetNode, event: MouseEvent];
}>();

const selected = computed(() => props.selectedWidgetId === props.item.widget.id);
const copy = useCopy();
const canvasWidgetActionLabel = computed(() =>
  copy.value.previewRuntime.selectWidget(props.item.widget.name, widgetTypeLabel(props.item.widget.type))
);
const resizeHandleTitle = computed(() => copy.value.previewRuntime.resizeWidget(props.item.widget.name));
const previewUrl = computed(() => props.imagePreviewUrl(props.item.widget));
const imagePlaceholderHint = computed(() =>
  props.item.widget.props.assetId ? props.widgetText(props.item.widget) : copy.value.previewRuntime.selectAsset
);
const isChecked = computed(() => props.item.widget.props.checked === true);
const valuePercent = computed(() => {
  const min = propNumber("min", 0);
  const max = propNumber("max", 100);
  const value = propNumber("value", 0);
  if (max <= min) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(((value - min) / (max - min)) * 100)));
});
const arcStyle = computed(() => ({
  background: `conic-gradient(#2f9bff 0deg ${Math.round(valuePercent.value * 3.6)}deg, rgba(255, 255, 255, 0.12) ${Math.round(valuePercent.value * 3.6)}deg 360deg)`
}));
const selectedDropdownOption = computed(() => {
  const text = propText("text", "");
  if (text) {
    return text;
  }
  const options = propText("options", copy.value.previewRuntime.dropdownDefaultOptions).split(/\r?\n/).filter(Boolean);
  return options[propNumber("selected", 0)] ?? options[0] ?? copy.value.previewRuntime.dropdownFallback;
});
const chartBarHeights = computed(() => {
  const values = props.item.widget.props.values;
  const min = propNumber("min", 0);
  const max = propNumber("max", 100);
  const pointCount = Math.max(1, Math.floor(propNumber("pointCount", 8)));
  const rawValues = Array.isArray(values) && values.length > 0
    ? values.filter((value) => Number.isFinite(value)).slice(0, pointCount).map((value) => Math.max(min, Math.min(max, value)))
    : Array.from({ length: pointCount }, (_unused, index) => min + ((index * 37 + 20) % (Math.max(0, max - min) + 1)));
  if (!rawValues.length) {
    return [min];
  }
  const span = Math.max(1, max - min);
  return rawValues.map((value) => Math.max(4, Math.min(100, Math.round(((value - min) / span) * 100))));
});

function propText(key: string, fallback: string): string {
  const value = props.item.widget.props[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function propNumber(key: string, fallback: number): number {
  const value = props.item.widget.props[key];
  return typeof value === "number" ? value : fallback;
}

function widgetTypeLabel(type: WidgetNode["type"]): string {
  const label = copy.value.widgets.names[type];
  return label && label.toLowerCase() !== type ? label : type;
}

</script>
