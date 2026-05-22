<template>
  <div class="screens-list">
    <div class="panel-title small">
      Screens
      <button class="mini-action" type="button" aria-label="Add screen" title="Add screen" data-testid="add-screen-button" @click="$emit('add-screen')"><IconGlyph name="add" /></button>
      <button class="mini-action" type="button" :aria-label="duplicateScreenLabel" :title="duplicateScreenLabel" data-testid="duplicate-screen-button" :disabled="!activeScreen" @click="duplicateActiveScreen"><IconGlyph name="copy" /></button>
      <button class="mini-action" type="button" :aria-label="deleteScreenLabel" :title="deleteScreenLabel" data-testid="delete-screen-button" :disabled="screens.length <= 1" @click="$emit('delete-active-screen')"><IconGlyph name="trash" /></button>
    </div>
    <p class="screen-summary" data-testid="screen-summary" role="status" aria-live="polite" aria-atomic="true">
      {{ screenCountLabel }}
    </p>
    <input
      v-if="activeScreen"
      class="screen-rename-field panel-search"
      data-testid="active-screen-name-input"
      :aria-label="renameScreenLabel"
      :title="renameScreenLabel"
      :aria-invalid="hasDuplicateScreenNames ? 'true' : undefined"
      :aria-describedby="hasDuplicateScreenNames ? 'screen-name-warning' : undefined"
      placeholder="Screen name"
      :value="activeScreen.name"
      @input="renameActiveScreen"
    />
    <p v-if="hasDuplicateScreenNames" id="screen-name-warning" class="field-error" data-testid="screen-name-warning" role="alert">
      Screen names should be unique.
    </p>
    <div class="screen-list-header" data-testid="screen-list-header">
      <span>Screen</span>
      <span>Widgets</span>
      <span>State</span>
    </div>
    <button
      v-for="row in designRows"
      :key="row.id"
      class="screen-row"
      type="button"
      :class="{ active: row.active, ghost: row.ghost }"
      :aria-label="screenRowActionLabel(row)"
      :aria-pressed="row.active ? 'true' : 'false'"
      :title="screenRowActionLabel(row)"
      :data-testid="`screen-row-${toTestId(row.name)}`"
      @click="switchRow(row)"
      >
      <span class="screen-name-line" data-screen-cell="name">
        <strong>{{ row.name }}</strong>
      </span>
      <span data-screen-cell="widgets">{{ row.meta }}</span>
      <span class="screen-state" data-screen-cell="state">{{ screenStateLabel(row) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ScreenNode } from "@hiveton-lvgl/schema";
import { computed } from "vue";
import IconGlyph from "./IconGlyph.vue";

const props = defineProps<{
  activeScreen: ScreenNode | undefined;
  screens: ScreenNode[];
  hasDuplicateScreenNames: boolean;
}>();

const emit = defineEmits<{
  "add-screen": [name?: string];
  "delete-active-screen": [];
  "duplicate-screen": [screenId: string];
  "rename-screen": [screenId: string, name: string];
  "switch-screen": [screenId: string];
}>();

function renameActiveScreen(event: Event): void {
  if (!props.activeScreen) {
    return;
  }
  emit("rename-screen", props.activeScreen.id, (event.target as HTMLInputElement).value);
}

function duplicateActiveScreen(): void {
  if (props.activeScreen) {
    emit("duplicate-screen", props.activeScreen.id);
  }
}

function widgetCount(screen: ScreenNode): number {
  return countWidgets(screen.root.children);
}

type ScreenRow = {
  id: string;
  name: string;
  meta: string;
  active: boolean;
  ghost?: boolean;
};

const designRows = computed<ScreenRow[]>(() => {
  if (props.screens.length !== 1 || props.screens[0]?.name !== "Screen_1") {
    return props.screens.map((screen) => ({
      id: screen.id,
      name: screen.name,
      meta: widgetCountLabel(widgetCount(screen)),
      active: props.activeScreen?.id === screen.id
    }));
  }
  const activeId = props.screens[0].id;
  return ["Splash", "Home", "Activity", "Heart Rate", "Sleep", "Settings", "About"].map((name) => ({
    id: name === "Home" ? activeId : `design-${name.toLowerCase().replace(/\s+/g, "-")}`,
    name,
    meta: name === "Home" ? widgetCountLabel(widgetCount(props.screens[0])) : "0 widgets",
    active: name === "Home",
    ghost: name !== "Home"
  }));
});
const screenCountLabel = computed(() =>
  `${designRows.value.length} ${designRows.value.length === 1 ? "screen" : "screens"}`
);
const duplicateScreenLabel = computed(() =>
  props.activeScreen ? `Duplicate ${props.activeScreen.name} screen` : "Duplicate screen"
);
const deleteScreenLabel = computed(() =>
  props.activeScreen ? `Delete ${props.activeScreen.name} screen` : "Delete screen"
);
const renameScreenLabel = computed(() =>
  props.activeScreen ? `Rename ${props.activeScreen.name} screen` : "Rename active screen"
);

function switchRow(row: ScreenRow): void {
  if (row.ghost) {
    emit("add-screen", row.name);
    return;
  }
  emit("switch-screen", row.id);
}

function countWidgets(widgets: ScreenNode["root"]["children"]): number {
  return widgets.reduce((count, widget) => count + 1 + countWidgets(widget.children), 0);
}

function widgetCountLabel(count: number): string {
  return `${count} ${count === 1 ? "widget" : "widgets"}`;
}

function screenStateLabel(row: ScreenRow): string {
  if (row.active) {
    return "Active";
  }
  return row.ghost ? "Draft" : "Ready";
}

function screenRowActionLabel(row: ScreenRow): string {
  const action = row.ghost ? "Create" : "Open";
  return `${action} ${row.name} screen, ${screenStateLabel(row)}, ${row.meta}`;
}

function toTestId(name: string): string {
  return name.toLowerCase().replace(/_/g, "-");
}
</script>
