<template>
  <aside class="layers-panel panel">
    <slot />
    <div class="panel-title layers-title">{{ copy.layers.title }}</div>
    <div class="layer-search-row">
      <input ref="layerSearchInputRef" v-model="layerQuery" class="panel-search layer-search" data-testid="layer-search-input" :placeholder="copy.layers.searchPlaceholder" :aria-label="copy.layers.search" :title="copy.layers.search" />
      <button v-if="layerQuery" class="mini-action" type="button" data-testid="clear-layer-search-button" :aria-label="copy.layers.clearSearch" :title="copy.layers.clearSearch" @click="clearLayerSearch">
        <IconGlyph name="close" />
      </button>
    </div>
    <div class="layer-search-meta" data-testid="layer-search-result-count" role="status" aria-live="polite" aria-atomic="true">{{ layerCountLabel }}</div>
    <div class="layer-list-header" data-testid="layer-list-header">
      <span>{{ copy.layers.columnObject }}</span>
      <span>{{ copy.layers.columnState }}</span>
      <span>{{ copy.layers.columnTools }}</span>
    </div>
    <ol class="layer-tree">
      <li>
        <button
          class="screen-root-layer"
          type="button"
          :class="{ 'selected-layer': selectedWidgetId === activeScreenRootId }"
          data-testid="layer-row-screen-root"
          :aria-pressed="selectedWidgetId === activeScreenRootId ? 'true' : 'false'"
          :aria-label="copy.layers.selectScreenRoot(activeScreenName ?? copy.layers.screenFallback)"
          :title="copy.layers.selectScreenRoot(activeScreenName ?? copy.layers.screenFallback)"
          @click="$emit('select-widget', activeScreenRootId)"
        >
          <span>▾ {{ activeScreenName }}</span>
          <em>{{ copy.layers.screenType }}</em>
        </button>
        <ol>
          <li
            v-for="row in filteredRows"
            :key="row.widget.id"
            :class="{ 'selected-layer': selectedWidgetId === row.widget.id, 'locked-layer': row.widget.locked, 'hidden-layer': row.widget.hidden }"
            :data-testid="`layer-row-${toTestId(row.widget.name)}`"
            :style="{ paddingLeft: `${4 + row.depth * 14}px` }"
            :draggable="!row.widget.locked"
            role="button"
            tabindex="0"
            :aria-pressed="selectedWidgetId === row.widget.id ? 'true' : 'false'"
            :aria-label="copy.layers.selectLayer(row.widget.name, widgetTypeLabel(row.widget.type))"
            :title="copy.layers.selectLayer(row.widget.name, widgetTypeLabel(row.widget.type))"
            @click="$emit('select-widget', row.widget.id)"
            @keydown.enter.prevent="$emit('select-widget', row.widget.id)"
            @keydown.space.prevent="$emit('select-widget', row.widget.id)"
            @dragstart="startLayerDrag(row.widget, $event)"
            @dragover.prevent
            @drop.stop="$emit('drop-widget', row.widget.id)"
          >
            <span class="layer-main" data-layer-cell="name">
              <IconGlyph :name="layerIcon(row.widget.type)" />
              <input
                class="layer-name-input"
                :data-testid="`layer-name-${toTestId(row.widget.name)}`"
                :aria-label="copy.layers.renameLayer(row.widget.name)"
                :title="copy.layers.renameLayer(row.widget.name)"
                :value="row.widget.name"
                :disabled="row.widget.locked"
                @click.stop
                @focus="$emit('select-widget', row.widget.id)"
                @input="renameWidget(row.widget.id, $event)"
              />
            </span>
            <span class="layer-state" data-layer-cell="state" :data-testid="`layer-state-${toTestId(row.widget.name)}`">
              <span class="layer-eye layer-eye-status" role="img" :aria-label="row.widget.hidden ? copy.layers.layerHidden : copy.layers.layerVisible" :title="row.widget.hidden ? copy.layers.layerHidden : copy.layers.layerVisible">
                <IconGlyph :name="row.widget.hidden ? 'eyeOff' : 'eye'" />
              </span>
              <em v-if="row.widget.hidden">{{ copy.layers.hidden }}</em>
              <em v-if="row.widget.locked">{{ copy.layers.locked }}</em>
            </span>
            <span class="layer-actions" data-layer-cell="actions">
              <button class="mini-action" type="button" :aria-label="lockLayerLabel(row.widget)" :title="lockLayerLabel(row.widget)" :data-testid="`layer-lock-${toTestId(row.widget.name)}`" @click.stop="$emit('toggle-locked', row.widget.id)">
                <IconGlyph :name="row.widget.locked ? 'lock' : 'unlock'" />
              </button>
              <button class="mini-action" type="button" :aria-label="hideLayerLabel(row.widget)" :title="hideLayerLabel(row.widget)" :data-testid="`layer-hide-${toTestId(row.widget.name)}`" :disabled="row.widget.locked" @click.stop="$emit('toggle-hidden', row.widget.id)">
                <IconGlyph :name="row.widget.hidden ? 'eyeOff' : 'eye'" />
              </button>
              <button class="mini-action" type="button" :aria-label="moveLayerLabel(row.widget, 'up')" :title="moveLayerLabel(row.widget, 'up')" :data-testid="`layer-up-${toTestId(row.widget.name)}`" :disabled="row.widget.locked || !row.canMoveUp" @click.stop="$emit('reorder', row.widget.id, -1)">
                <IconGlyph name="arrowUp" />
              </button>
              <button class="mini-action" type="button" :aria-label="moveLayerLabel(row.widget, 'down')" :title="moveLayerLabel(row.widget, 'down')" :data-testid="`layer-down-${toTestId(row.widget.name)}`" :disabled="row.widget.locked || !row.canMoveDown" @click.stop="$emit('reorder', row.widget.id, 1)">
                <IconGlyph name="arrowDown" />
              </button>
              <button class="mini-action" type="button" :aria-label="deleteLayerLabel(row.widget)" :title="deleteLayerLabel(row.widget)" :data-testid="`layer-delete-${toTestId(row.widget.name)}`" :disabled="row.widget.locked" @click.stop="$emit('delete-widget', row.widget.id)">
                <IconGlyph name="trash" />
              </button>
            </span>
          </li>
        </ol>
        <p v-if="filteredRows.length === 0" class="layer-empty-state" data-testid="layer-empty-state" role="status" aria-live="polite" aria-atomic="true">
          {{ layerEmptyMessage }}
        </p>
      </li>
    </ol>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { WidgetNode } from "@hiveton-lvgl/schema";
import { useCopy } from "../i18n/useCopy";
import IconGlyph from "./IconGlyph.vue";
import { toTestId } from "./testId";

export type LayerRow = {
  widget: WidgetNode;
  depth: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

const props = defineProps<{
  activeScreenName: string | undefined;
  activeScreenRootId: string;
  rows: LayerRow[];
  selectedWidgetId: string | null;
}>();

const layerQuery = ref("");
const layerSearchInputRef = ref<HTMLInputElement | null>(null);
const copy = useCopy();
const filteredRows = computed(() => {
  const query = layerQuery.value.trim().toLowerCase();
  if (!query) {
    return props.rows;
  }
  return props.rows.filter((row) =>
    row.widget.name.toLowerCase().includes(query) ||
    row.widget.type.toLowerCase().includes(query)
  );
});
const layerEmptyMessage = computed(() =>
  layerQuery.value.trim()
    ? copy.value.layers.noSearchResults
    : copy.value.layers.empty
);
const layerCountLabel = computed(() =>
  copy.value.layers.layerCount(filteredRows.value.length)
);

const emit = defineEmits<{
  "select-widget": [widgetId: string];
  "rename-widget": [widgetId: string, name: string];
  "toggle-locked": [widgetId: string];
  "toggle-hidden": [widgetId: string];
  reorder: [widgetId: string, direction: -1 | 1];
  "delete-widget": [widgetId: string];
  "drag-start": [widgetId: string, event: DragEvent];
  "drop-widget": [widgetId: string];
}>();

function renameWidget(widgetId: string, event: Event): void {
  emit("rename-widget", widgetId, (event.target as HTMLInputElement).value);
}

function clearLayerSearch(): void {
  layerQuery.value = "";
  layerSearchInputRef.value?.focus();
}

function startLayerDrag(widget: WidgetNode, event: DragEvent): void {
  if (widget.locked) {
    event.preventDefault();
    return;
  }
  emit("drag-start", widget.id, event);
}

function layerIcon(type: WidgetNode["type"]): InstanceType<typeof IconGlyph>["$props"]["name"] {
  const icons: Partial<Record<WidgetNode["type"], InstanceType<typeof IconGlyph>["$props"]["name"]>> = {
    arc: "spinner",
    bar: "bar",
    button: "button",
    chart: "bar",
    checkbox: "checkbox",
    container: "container",
    dropdown: "dropdown",
    image: "image",
    label: "label",
    line: "line",
    screen: "screens",
    slider: "slider",
    spinner: "spinner",
    switch: "slider"
  };
  return icons[type] ?? "widgets";
}

function widgetTypeLabel(type: WidgetNode["type"]): string {
  const label = copy.value.widgets.names[type];
  return label && label.toLowerCase() !== type ? label : type;
}

function lockLayerLabel(widget: WidgetNode): string {
  return widget.locked ? copy.value.layers.unlockLayer(widget.name) : copy.value.layers.lockLayer(widget.name);
}

function hideLayerLabel(widget: WidgetNode): string {
  return widget.hidden ? copy.value.layers.showLayer(widget.name) : copy.value.layers.hideLayer(widget.name);
}

function moveLayerLabel(widget: WidgetNode, direction: "up" | "down"): string {
  return copy.value.layers.moveLayer(widget.name, direction);
}

function deleteLayerLabel(widget: WidgetNode): string {
  return copy.value.layers.deleteLayer(widget.name);
}

</script>
