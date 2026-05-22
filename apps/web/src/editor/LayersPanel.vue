<template>
  <aside class="layers-panel panel">
    <slot />
    <div class="panel-title layers-title">Layers</div>
    <div class="layer-search-row">
      <input ref="layerSearchInputRef" v-model="layerQuery" class="panel-search layer-search" data-testid="layer-search-input" placeholder="Search layers..." aria-label="Search layers" title="Search layers" />
      <button v-if="layerQuery" class="mini-action" type="button" data-testid="clear-layer-search-button" aria-label="Clear layer search" title="Clear layer search" @click="clearLayerSearch">
        <IconGlyph name="close" />
      </button>
    </div>
    <div class="layer-search-meta" data-testid="layer-search-result-count" role="status" aria-live="polite" aria-atomic="true">{{ layerCountLabel }}</div>
    <div class="layer-list-header" data-testid="layer-list-header">
      <span>Object</span>
      <span>State</span>
      <span>Tools</span>
    </div>
    <ol class="layer-tree">
      <li>
        <button
          class="screen-root-layer"
          type="button"
          :class="{ 'selected-layer': selectedWidgetId === activeScreenRootId }"
          data-testid="layer-row-screen-root"
          :aria-pressed="selectedWidgetId === activeScreenRootId ? 'true' : 'false'"
          :aria-label="`Select screen root ${activeScreenName ?? 'Screen'}`"
          :title="`Select screen root ${activeScreenName ?? 'Screen'}`"
          @click="$emit('select-widget', activeScreenRootId)"
        >
          <span>▾ {{ activeScreenName }}</span>
          <em>screen</em>
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
            :aria-label="`Select ${row.widget.name} ${row.widget.type} layer`"
            :title="`Select ${row.widget.name} ${row.widget.type} layer`"
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
                :aria-label="`Rename ${row.widget.name} layer`"
                :title="`Rename ${row.widget.name} layer`"
                :value="row.widget.name"
                :disabled="row.widget.locked"
                @click.stop
                @focus="$emit('select-widget', row.widget.id)"
                @input="renameWidget(row.widget.id, $event)"
              />
            </span>
            <span class="layer-state" data-layer-cell="state" :data-testid="`layer-state-${toTestId(row.widget.name)}`">
              <span class="layer-eye layer-eye-status" role="img" :aria-label="row.widget.hidden ? 'Layer hidden' : 'Layer visible'" :title="row.widget.hidden ? 'Layer hidden' : 'Layer visible'">
                <IconGlyph :name="row.widget.hidden ? 'eyeOff' : 'eye'" />
              </span>
              <em v-if="row.widget.hidden">Hidden</em>
              <em v-if="row.widget.locked">Locked</em>
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
import IconGlyph from "./IconGlyph.vue";

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
    ? "No layers match this search."
    : "No widgets on this screen. Add one from Widgets or drop it on the canvas."
);
const layerCountLabel = computed(() =>
  `${filteredRows.value.length} ${filteredRows.value.length === 1 ? "layer" : "layers"}`
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

function lockLayerLabel(widget: WidgetNode): string {
  return `${widget.locked ? "Unlock" : "Lock"} ${widget.name} layer`;
}

function hideLayerLabel(widget: WidgetNode): string {
  return `${widget.hidden ? "Show" : "Hide"} ${widget.name} layer`;
}

function moveLayerLabel(widget: WidgetNode, direction: "up" | "down"): string {
  return `Move ${widget.name} layer ${direction}`;
}

function deleteLayerLabel(widget: WidgetNode): string {
  return `Delete ${widget.name} layer`;
}

function toTestId(name: string): string {
  return name.toLowerCase().replace(/_/g, "-");
}
</script>
