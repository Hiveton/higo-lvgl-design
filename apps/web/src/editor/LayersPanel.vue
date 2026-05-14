<template>
  <aside class="layers-panel panel">
    <div class="panel-title">Layers</div>
    <ol class="layer-tree">
      <li>
        <button
          class="screen-root-layer"
          :class="{ 'selected-layer': selectedWidgetId === activeScreenRootId }"
          data-testid="layer-row-screen-root"
          @click="$emit('select-widget', activeScreenRootId)"
        >
          <span>▾ {{ activeScreenName }}</span>
          <em>screen</em>
        </button>
        <ol>
          <li
            v-for="row in rows"
            :key="row.widget.id"
            :class="{ 'selected-layer': selectedWidgetId === row.widget.id, 'locked-layer': row.widget.locked, 'hidden-layer': row.widget.hidden }"
            :data-testid="`layer-row-${toTestId(row.widget.name)}`"
            :style="{ paddingLeft: `${4 + row.depth * 14}px` }"
            :draggable="!row.widget.locked"
            @click="$emit('select-widget', row.widget.id)"
            @dragstart="startLayerDrag(row.widget, $event)"
            @dragover.prevent
            @drop.stop="$emit('drop-widget', row.widget.id)"
          >
            <input
              class="layer-name-input"
              :data-testid="`layer-name-${toTestId(row.widget.name)}`"
              :value="row.widget.name"
              :disabled="row.widget.locked"
              @click.stop
              @focus="$emit('select-widget', row.widget.id)"
              @input="renameWidget(row.widget.id, $event)"
            />
            <span class="layer-state" :data-testid="`layer-state-${toTestId(row.widget.name)}`">
              <em v-if="row.widget.locked">Locked</em>
              <em v-if="row.widget.hidden">Hidden</em>
            </span>
            <span class="layer-actions">
              <button class="mini-action" :aria-label="row.widget.locked ? 'Unlock layer' : 'Lock layer'" :title="row.widget.locked ? 'Unlock' : 'Lock'" :data-testid="`layer-lock-${toTestId(row.widget.name)}`" @click.stop="$emit('toggle-locked', row.widget.id)">
                {{ row.widget.locked ? "Lo" : "Un" }}
              </button>
              <button class="mini-action" :aria-label="row.widget.hidden ? 'Show layer' : 'Hide layer'" :title="row.widget.hidden ? 'Show' : 'Hide'" :data-testid="`layer-hide-${toTestId(row.widget.name)}`" :disabled="row.widget.locked" @click.stop="$emit('toggle-hidden', row.widget.id)">
                {{ row.widget.hidden ? "Sh" : "Hi" }}
              </button>
              <button class="mini-action" :data-testid="`layer-up-${toTestId(row.widget.name)}`" :disabled="row.widget.locked || !row.canMoveUp" @click.stop="$emit('reorder', row.widget.id, -1)">
                ↑
              </button>
              <button class="mini-action" :data-testid="`layer-down-${toTestId(row.widget.name)}`" :disabled="row.widget.locked || !row.canMoveDown" @click.stop="$emit('reorder', row.widget.id, 1)">
                ↓
              </button>
              <button class="mini-action" :data-testid="`layer-delete-${toTestId(row.widget.name)}`" :disabled="row.widget.locked" @click.stop="$emit('delete-widget', row.widget.id)">
                ×
              </button>
            </span>
          </li>
        </ol>
      </li>
    </ol>
    <slot />
  </aside>
</template>

<script setup lang="ts">
import type { WidgetNode } from "@hiveton-lvgl/schema";

export type LayerRow = {
  widget: WidgetNode;
  depth: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

defineProps<{
  activeScreenName: string | undefined;
  activeScreenRootId: string;
  rows: LayerRow[];
  selectedWidgetId: string | null;
}>();

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

function startLayerDrag(widget: WidgetNode, event: DragEvent): void {
  if (widget.locked) {
    event.preventDefault();
    return;
  }
  emit("drag-start", widget.id, event);
}

function toTestId(name: string): string {
  return name.toLowerCase().replace(/_/g, "-");
}
</script>
