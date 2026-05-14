<template>
  <aside class="inspector-panel panel">
    <div class="tabs">
      <button
        class="tab"
        :class="{ active: activeInspectorTab === 'style' }"
        data-testid="inspector-style-tab"
        @click="emit('update:active-inspector-tab', 'style')"
      >
        Style
      </button>
      <button
        class="tab"
        :class="{ active: activeInspectorTab === 'events' }"
        data-testid="inspector-events-tab"
        @click="emit('update:active-inspector-tab', 'events')"
      >
        Events
      </button>
      <button
        class="tab"
        :class="{ active: activeInspectorTab === 'layout' }"
        data-testid="inspector-layout-tab"
        @click="emit('update:active-inspector-tab', 'layout')"
      >
        Layout
      </button>
    </div>
    <section v-if="!selectedWidget" class="inspector-section inspector-empty" data-testid="inspector-empty-state">
      <h2>No widget selected</h2>
      <p>Select a widget from Canvas or Layers to edit Style, Events and Layout.</p>
    </section>
    <section v-else class="inspector-section">
      <h2>Selector</h2>
      <input
        data-testid="selector-input"
        :disabled="selectedWidget?.locked"
        :value="selectedWidget?.name"
        @input="emitInput('rename-widget', $event)"
      />
    </section>
    <section v-if="activeInspectorTab === 'style' && canEditText" class="inspector-section">
      <h2>Text</h2>
      <label>
        Text
        <input
          data-testid="selected-text-input"
          :disabled="selectedWidget?.locked"
          :value="selectedText"
          @input="emitInput('update-text', $event)"
        />
      </label>
      <label>
        Font
        <select data-testid="style-font-select" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.font ?? ''" @change="emitInput('update-style-font', $event)">
          <option value="">Default</option>
          <option value="lv_font_montserrat_14">lv_font_montserrat_14</option>
          <option value="lv_font_montserrat_20">lv_font_montserrat_20</option>
          <option value="lv_font_montserrat_32">lv_font_montserrat_32</option>
          <option value="lv_font_montserrat_48">lv_font_montserrat_48</option>
          <option v-for="asset in fontAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
        </select>
      </label>
      <label>
        Align
        <select data-testid="style-align-select" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.align ?? 'left'" @change="emitInput('update-style-align', $event)">
          <option value="left">left</option>
          <option value="center">center</option>
          <option value="right">right</option>
        </select>
      </label>
    </section>
    <section v-if="activeInspectorTab === 'style' && hasRangeProps" class="inspector-section">
      <h2>Props</h2>
      <label>Min<input data-testid="prop-min-input" :disabled="selectedWidget?.locked" :value="propNumber('min', 0)" @input="emitFieldInput('update-prop-number', 'min', $event)" /></label>
      <label>Max<input data-testid="prop-max-input" :disabled="selectedWidget?.locked" :value="propNumber('max', 100)" @input="emitFieldInput('update-prop-number', 'max', $event)" /></label>
      <label>Value<input data-testid="prop-value-input" :disabled="selectedWidget?.locked" :value="propNumber('value', 0)" @input="emitFieldInput('update-prop-number', 'value', $event)" /></label>
      <p v-if="inspectorErrors['prop-value']" class="field-error" data-testid="prop-value-error">{{ inspectorErrors['prop-value'] }}</p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'chart'" class="inspector-section">
      <h2>Props</h2>
      <label>Min<input data-testid="prop-min-input" :disabled="selectedWidget?.locked" :value="propNumber('min', 0)" @input="emitFieldInput('update-prop-number', 'min', $event)" /></label>
      <label>Max<input data-testid="prop-max-input" :disabled="selectedWidget?.locked" :value="propNumber('max', 100)" @input="emitFieldInput('update-prop-number', 'max', $event)" /></label>
      <label>Point Count<input data-testid="prop-point-count-input" :disabled="selectedWidget?.locked" :value="propNumber('pointCount', 8)" @input="emitFieldInput('update-prop-number', 'pointCount', $event)" /></label>
      <p v-if="inspectorErrors['prop-point-count']" class="field-error" data-testid="prop-point-count-error">{{ inspectorErrors['prop-point-count'] }}</p>
      <label>Values<textarea data-testid="prop-values-input" :disabled="selectedWidget?.locked" :value="propValues()" @input="emit('update-prop-values', inputValue($event))" /></label>
      <p v-if="inspectorErrors['prop-values']" class="field-error" data-testid="prop-values-error">{{ inspectorErrors['prop-values'] }}</p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'spinner'" class="inspector-section">
      <h2>Props</h2>
      <label>Spin Time<input data-testid="prop-spin-time-input" :disabled="selectedWidget?.locked" :value="propNumber('spinTime', 1000)" @input="emitFieldInput('update-prop-number', 'spinTime', $event)" /></label>
      <p v-if="inspectorErrors['prop-spin-time']" class="field-error" data-testid="prop-spin-time-error">{{ inspectorErrors['prop-spin-time'] }}</p>
      <label>Arc Length<input data-testid="prop-arc-length-input" :disabled="selectedWidget?.locked" :value="propNumber('arcLength', 60)" @input="emitFieldInput('update-prop-number', 'arcLength', $event)" /></label>
      <p v-if="inspectorErrors['prop-arc-length']" class="field-error" data-testid="prop-arc-length-error">{{ inspectorErrors['prop-arc-length'] }}</p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'switch'" class="inspector-section">
      <h2>Props</h2>
      <label><input data-testid="prop-checked-input" type="checkbox" :disabled="selectedWidget?.locked" :checked="selectedWidget?.props.checked === true" @change="emit('update-prop-checked', ($event.target as HTMLInputElement).checked)" /> Checked</label>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'checkbox'" class="inspector-section">
      <h2>Props</h2>
      <label>Text<input data-testid="prop-text-input" :disabled="selectedWidget?.locked" :value="propString('text')" @input="emitFieldInput('update-prop-text', 'text', $event)" /></label>
      <label><input data-testid="prop-checked-input" type="checkbox" :disabled="selectedWidget?.locked" :checked="selectedWidget?.props.checked === true" @change="emit('update-prop-checked', ($event.target as HTMLInputElement).checked)" /> Checked</label>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'dropdown'" class="inspector-section">
      <h2>Props</h2>
      <label>Options<textarea data-testid="prop-options-input" :disabled="selectedWidget?.locked" :value="propString('options')" @input="emitFieldInput('update-prop-text', 'options', $event)" /></label>
      <label>Selected<input data-testid="prop-selected-input" :disabled="selectedWidget?.locked" :value="propNumber('selected', 0)" @input="emitFieldInput('update-prop-number', 'selected', $event)" /></label>
      <p v-if="inspectorErrors['prop-selected']" class="field-error" data-testid="prop-selected-error">{{ inspectorErrors['prop-selected'] }}</p>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget?.type === 'image'" class="inspector-section">
      <h2>Image</h2>
      <label>
        Asset
        <select
          data-testid="image-asset-select"
          :value="selectedWidget?.props.assetId ?? ''"
          :disabled="selectedWidget?.locked"
          @change="emitInput('bind-image-asset', $event)"
        >
          <option value="">None</option>
          <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">
            {{ asset.name }}
          </option>
        </select>
      </label>
    </section>
    <section v-if="activeInspectorTab === 'style' && selectedWidget" class="inspector-section">
      <h2>Appearance</h2>
      <label>Text Color<input data-testid="style-text-color-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.textColor ?? '#FFFFFF'" @input="emitStyleText('textColor', $event)" /></label>
      <label>Background<input data-testid="style-bg-color-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.bgColor ?? ''" @input="emitStyleText('bgColor', $event)" /></label>
      <label>Border<input data-testid="style-border-color-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.borderColor ?? ''" @input="emitStyleText('borderColor', $event)" /></label>
      <label>Opacity<input data-testid="style-opacity-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.opacity ?? 100" @input="emitStyleNumber('opacity', $event)" /></label>
      <p v-if="inspectorErrors.opacity" class="field-error" data-testid="style-opacity-error">{{ inspectorErrors.opacity }}</p>
      <label>Radius<input data-testid="style-radius-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.radius ?? 0" @input="emitStyleNumber('radius', $event)" /></label>
      <p v-if="inspectorErrors.radius" class="field-error" data-testid="style-radius-error">{{ inspectorErrors.radius }}</p>
      <label>Padding Top<input data-testid="style-padding-top-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.padding?.top ?? 0" @input="emitPaddingSide('top', $event)" /></label>
      <p v-if="inspectorErrors['padding-top']" class="field-error" data-testid="style-padding-top-error">{{ inspectorErrors['padding-top'] }}</p>
      <label>Padding Right<input data-testid="style-padding-right-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.padding?.right ?? 0" @input="emitPaddingSide('right', $event)" /></label>
      <p v-if="inspectorErrors['padding-right']" class="field-error" data-testid="style-padding-right-error">{{ inspectorErrors['padding-right'] }}</p>
      <label>Padding Bottom<input data-testid="style-padding-bottom-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.padding?.bottom ?? 0" @input="emitPaddingSide('bottom', $event)" /></label>
      <p v-if="inspectorErrors['padding-bottom']" class="field-error" data-testid="style-padding-bottom-error">{{ inspectorErrors['padding-bottom'] }}</p>
      <label>Padding Left<input data-testid="style-padding-left-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.padding?.left ?? 0" @input="emitPaddingSide('left', $event)" /></label>
      <p v-if="inspectorErrors['padding-left']" class="field-error" data-testid="style-padding-left-error">{{ inspectorErrors['padding-left'] }}</p>
      <label v-if="canEditText">Letter Space<input data-testid="style-letter-space-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.letterSpace ?? 0" @input="emitStyleNumber('letterSpace', $event)" /></label>
      <label v-if="canEditText">Line Space<input data-testid="style-line-space-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.style.lineSpace ?? 0" @input="emitStyleNumber('lineSpace', $event)" /></label>
    </section>
    <section v-if="activeInspectorTab === 'layout' && selectedWidget" class="inspector-section">
      <h2>Target</h2>
      <label>Device<input data-testid="target-device-name-input" :value="project.target.deviceName" @input="emitInput('update-target-device-name', $event)" /></label>
      <p v-if="inspectorErrors['target-device-name']" class="field-error" data-testid="target-device-name-error">{{ inspectorErrors['target-device-name'] }}</p>
      <label>
        LVGL
        <select data-testid="target-lvgl-version-select" :value="project.target.lvglVersion" @change="emitInput('update-target-lvgl-version', $event)">
          <option value="8.3">8.3</option>
        </select>
      </label>
      <label>Width<input data-testid="target-width-input" :value="project.target.width" @input="emitTargetNumber('width', $event)" /></label>
      <p v-if="inspectorErrors['target-width']" class="field-error" data-testid="target-width-error">{{ inspectorErrors['target-width'] }}</p>
      <label>Height<input data-testid="target-height-input" :value="project.target.height" @input="emitTargetNumber('height', $event)" /></label>
      <p v-if="inspectorErrors['target-height']" class="field-error" data-testid="target-height-error">{{ inspectorErrors['target-height'] }}</p>
      <label>DPI<input data-testid="target-dpi-input" :value="project.target.dpi" @input="emitTargetNumber('dpi', $event)" /></label>
      <p v-if="inspectorErrors['target-dpi']" class="field-error" data-testid="target-dpi-error">{{ inspectorErrors['target-dpi'] }}</p>
      <label>
        Color Depth
        <select data-testid="target-color-depth-select" :value="project.target.colorDepth" @change="emitInput('update-target-color-depth', $event)">
          <option value="16">16</option>
          <option value="32">32</option>
        </select>
      </label>
    </section>
    <section v-if="activeInspectorTab === 'layout' && selectedWidget" class="inspector-section">
      <h2>Layout</h2>
      <label>X<input data-testid="layout-x-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.x" @input="emitLayoutNumber('x', $event)" /></label>
      <label>Y<input data-testid="layout-y-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.y" @input="emitLayoutNumber('y', $event)" /></label>
      <label>Width<input data-testid="layout-width-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.width" @input="emitLayoutNumber('width', $event)" /></label>
      <p v-if="inspectorErrors.width" class="field-error" data-testid="layout-width-error">{{ inspectorErrors.width }}</p>
      <label>Height<input data-testid="layout-height-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.height" @input="emitLayoutNumber('height', $event)" /></label>
      <p v-if="inspectorErrors.height" class="field-error" data-testid="layout-height-error">{{ inspectorErrors.height }}</p>
      <label>
        Align
        <select data-testid="layout-align-select" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.align ?? 'top-left'" @change="emitInput('update-layout-align', $event)">
          <option value="top-left">top-left</option>
          <option value="top-right">top-right</option>
          <option value="center">center</option>
          <option value="bottom-left">bottom-left</option>
          <option value="bottom-right">bottom-right</option>
        </select>
      </label>
      <label v-if="canEditFlex">
        Flex Direction
        <select data-testid="layout-flex-direction-select" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.flex?.direction ?? 'row'" @change="emitInput('update-flex-direction', $event)">
          <option value="row">row</option>
          <option value="column">column</option>
        </select>
      </label>
      <label v-if="canEditFlex">Gap<input data-testid="layout-gap-input" :disabled="selectedWidget?.locked" :value="selectedWidget?.layout.flex?.gap ?? 0" @input="emitInput('update-flex-gap', $event)" /></label>
      <p v-if="inspectorErrors.gap" class="field-error" data-testid="layout-gap-error">{{ inspectorErrors.gap }}</p>
      <label v-if="canEditFlex"><input data-testid="layout-flex-wrap-input" type="checkbox" :disabled="selectedWidget?.locked" :checked="selectedWidget?.layout.flex?.wrap === true" @change="emit('update-flex-wrap', ($event.target as HTMLInputElement).checked)" /> Wrap</label>
    </section>
    <section v-if="activeInspectorTab === 'events' && selectedWidget" class="inspector-section">
      <h2>Events</h2>
      <label>
        Event
        <select data-testid="event-type-select" :disabled="eventEditorDisabled" :value="eventType" @change="updateEventType">
          <option value="LV_EVENT_CLICKED">LV_EVENT_CLICKED</option>
          <option value="LV_EVENT_VALUE_CHANGED">LV_EVENT_VALUE_CHANGED</option>
          <option value="LV_EVENT_READY">LV_EVENT_READY</option>
          <option value="LV_EVENT_CANCEL">LV_EVENT_CANCEL</option>
        </select>
      </label>
      <label>
        Target
        <select data-testid="event-target-select" :value="eventTargetWidgetId" @change="emitInput('update:event-target-widget-id', $event)">
          <option v-for="row in eventTargetRows" :key="row.widget.id" :value="row.widget.id">
            {{ row.widget.name }}
          </option>
        </select>
      </label>
      <label>
        Handler
        <input data-testid="event-handler-input" :disabled="eventEditorDisabled" :value="eventHandler" @input="emitInput('update:event-handler', $event)" />
      </label>
      <button class="select-like" data-testid="add-event-button" :disabled="eventEditorDisabled" @click="emit('add-event')">Add Event</button>
      <ul class="event-list">
        <li v-for="event in selectedEvents" :key="event.id">
          {{ event.event }} · {{ event.handlerName }}
          <button
            class="mini-action"
            :data-testid="`remove-event-${event.id}`"
            :disabled="eventWidgetLocked(event.widgetId)"
            @click="emit('remove-event', event.id)"
          >
            ×
          </button>
        </li>
      </ul>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AssetRef, EventBinding, ProjectDoc, WidgetNode } from "@hiveton-lvgl/schema";
import type { LayerRow } from "./LayersPanel.vue";

export type InspectorTab = "style" | "events" | "layout";

const props = defineProps<{
  activeInspectorTab: InspectorTab;
  eventHandler: string;
  eventTargetWidgetId: string;
  eventType: EventBinding["event"];
  fontAssets: AssetRef[];
  imageAssets: AssetRef[];
  inspectorErrors: Record<string, string>;
  eventTargetRows: LayerRow[];
  layerRows: LayerRow[];
  project: ProjectDoc;
  selectedEvents: EventBinding[];
  selectedWidget: WidgetNode | null;
}>();

const emit = defineEmits<{
  "add-event": [];
  "bind-image-asset": [assetId: string];
  "remove-event": [eventId: string];
  "rename-widget": [name: string];
  "update:event-handler": [handler: string];
  "update:event-target-widget-id": [widgetId: string];
  "update:event-type": [eventType: EventBinding["event"]];
  "update:active-inspector-tab": [tab: InspectorTab];
  "update-flex-direction": [direction: string];
  "update-flex-gap": [gap: string];
  "update-flex-wrap": [wrap: boolean];
  "update-layout-align": [align: string];
  "update-layout-number": [field: "x" | "y" | "width" | "height", value: string];
  "update-padding-side": [side: "top" | "right" | "bottom" | "left", value: string];
  "update-prop-checked": [checked: boolean];
  "update-prop-number": [field: string, value: string];
  "update-prop-text": [field: string, value: string];
  "update-prop-values": [value: string];
  "update-style-align": [align: string];
  "update-style-font": [font: string];
  "update-style-number": [field: "opacity" | "radius" | "letterSpace" | "lineSpace", value: string];
  "update-style-text": [field: "textColor" | "bgColor" | "borderColor", value: string];
  "update-target-color-depth": [value: string];
  "update-target-device-name": [value: string];
  "update-target-lvgl-version": [value: string];
  "update-target-number": [field: "width" | "height" | "dpi", value: string];
  "update-text": [text: string];
}>();

const selectedText = computed(() => String(props.selectedWidget?.props.text ?? ""));
const canEditText = computed(() =>
  props.selectedWidget?.type === "label"
  || props.selectedWidget?.type === "button"
  || props.selectedWidget?.type === "checkbox"
  || props.selectedWidget?.type === "dropdown"
);
const hasRangeProps = computed(() =>
  props.selectedWidget?.type === "slider" || props.selectedWidget?.type === "bar" || props.selectedWidget?.type === "arc"
);
const canEditFlex = computed(() => props.selectedWidget?.type === "container" || props.selectedWidget?.type === "screen");
const eventTargetWidget = computed(() =>
  props.eventTargetRows.find((row) => row.widget.id === props.eventTargetWidgetId)?.widget ?? null
);
const eventEditorDisabled = computed(() => eventTargetWidget.value?.locked === true);

function eventWidgetLocked(widgetId: string): boolean {
  return props.eventTargetRows.find((row) => row.widget.id === widgetId)?.widget.locked === true;
}

function propString(field: string): string {
  const value = props.selectedWidget?.props[field];
  return typeof value === "string" ? value : "";
}

function propNumber(field: string, fallback: number): number {
  const value = props.selectedWidget?.props[field];
  return typeof value === "number" ? value : fallback;
}

function propValues(): string {
  const value = props.selectedWidget?.props.values;
  return Array.isArray(value) ? value.join(", ") : "";
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
}

type StringInputEvent =
  | "bind-image-asset"
  | "rename-widget"
  | "update:event-handler"
  | "update:event-target-widget-id"
  | "update-flex-direction"
  | "update-flex-gap"
  | "update-layout-align"
  | "update-style-align"
  | "update-style-font"
  | "update-target-color-depth"
  | "update-target-device-name"
  | "update-target-lvgl-version"
  | "update-text";

function emitInput(eventName: StringInputEvent, event: Event): void {
  const value = inputValue(event);
  switch (eventName) {
    case "bind-image-asset":
      emit("bind-image-asset", value);
      break;
    case "rename-widget":
      emit("rename-widget", value);
      break;
    case "update:event-handler":
      emit("update:event-handler", value);
      break;
    case "update:event-target-widget-id":
      emit("update:event-target-widget-id", value);
      break;
    case "update-flex-direction":
      emit("update-flex-direction", value);
      break;
    case "update-flex-gap":
      emit("update-flex-gap", value);
      break;
    case "update-layout-align":
      emit("update-layout-align", value);
      break;
    case "update-style-align":
      emit("update-style-align", value);
      break;
    case "update-style-font":
      emit("update-style-font", value);
      break;
    case "update-target-color-depth":
      emit("update-target-color-depth", value);
      break;
    case "update-target-device-name":
      emit("update-target-device-name", value);
      break;
    case "update-target-lvgl-version":
      emit("update-target-lvgl-version", value);
      break;
    case "update-text":
      emit("update-text", value);
      break;
  }
}

function emitFieldInput(eventName: "update-prop-number" | "update-prop-text", field: string, event: Event): void {
  if (eventName === "update-prop-number") {
    emit("update-prop-number", field, inputValue(event));
    return;
  }
  emit("update-prop-text", field, inputValue(event));
}

function emitStyleText(field: "textColor" | "bgColor" | "borderColor", event: Event): void {
  emit("update-style-text", field, inputValue(event));
}

function emitStyleNumber(field: "opacity" | "radius" | "letterSpace" | "lineSpace", event: Event): void {
  emit("update-style-number", field, inputValue(event));
}

function emitPaddingSide(side: "top" | "right" | "bottom" | "left", event: Event): void {
  emit("update-padding-side", side, inputValue(event));
}

function emitLayoutNumber(field: "x" | "y" | "width" | "height", event: Event): void {
  emit("update-layout-number", field, inputValue(event));
}

function emitTargetNumber(field: "width" | "height" | "dpi", event: Event): void {
  emit("update-target-number", field, inputValue(event));
}

function updateEventType(event: Event): void {
  const value = inputValue(event);
  if (value === "LV_EVENT_CLICKED" || value === "LV_EVENT_VALUE_CHANGED" || value === "LV_EVENT_READY" || value === "LV_EVENT_CANCEL") {
    emit("update:event-type", value);
  }
}
</script>
