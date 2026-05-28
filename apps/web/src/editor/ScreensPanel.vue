<template>
  <div class="screens-list">
    <div class="panel-title small">
      {{ copy.screens.title }}
      <button class="mini-action" type="button" :aria-label="copy.screens.add" :title="copy.screens.add" data-testid="add-screen-button" @click="$emit('add-screen')"><IconGlyph name="add" /></button>
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
      :placeholder="copy.screens.screenNamePlaceholder"
      :value="activeScreen.name"
      @input="renameActiveScreen"
    />
    <p v-if="hasDuplicateScreenNames" id="screen-name-warning" class="field-error" data-testid="screen-name-warning" role="alert">
      {{ copy.screens.uniqueNames }}
    </p>
    <div class="screen-list-header" data-testid="screen-list-header">
      <span>{{ copy.screens.columnScreen }}</span>
      <span>{{ copy.screens.columnWidgets }}</span>
      <span>{{ copy.screens.columnState }}</span>
    </div>
    <button
      v-for="row in screenRows"
      :key="row.id"
      class="screen-row"
      type="button"
      :class="{ active: row.active }"
      :aria-label="screenRowActionLabel(row)"
      :aria-pressed="row.active ? 'true' : 'false'"
      :title="screenRowActionLabel(row)"
      :data-testid="`screen-row-${toTestId(row.name)}`"
      @click="emit('switch-screen', row.id)"
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
import { useCopy } from "../i18n/useCopy";
import IconGlyph from "./IconGlyph.vue";
import { toTestId } from "./testId";

const props = defineProps<{
  activeScreen: ScreenNode | undefined;
  screens: ScreenNode[];
  hasDuplicateScreenNames: boolean;
}>();

const copy = useCopy();

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
};

const screenRows = computed<ScreenRow[]>(() =>
  props.screens.map((screen) => ({
    id: screen.id,
    name: screen.name,
    meta: widgetCountLabel(widgetCount(screen)),
    active: props.activeScreen?.id === screen.id
  }))
);
const screenCountLabel = computed(() =>
  copy.value.screens.screenCount(screenRows.value.length)
);
const duplicateScreenLabel = computed(() =>
  props.activeScreen ? copy.value.screens.duplicateScreen(props.activeScreen.name) : copy.value.screens.duplicate
);
const deleteScreenLabel = computed(() =>
  props.activeScreen ? copy.value.screens.deleteScreen(props.activeScreen.name) : copy.value.screens.delete
);
const renameScreenLabel = computed(() =>
  props.activeScreen ? copy.value.screens.renameScreen(props.activeScreen.name) : copy.value.screens.renameActiveScreen
);

function countWidgets(widgets: ScreenNode["root"]["children"]): number {
  return widgets.reduce((count, widget) => count + 1 + countWidgets(widget.children), 0);
}

function widgetCountLabel(count: number): string {
  return copy.value.screens.widgetCount(count);
}

function screenStateLabel(row: ScreenRow): string {
  if (row.active) {
    return copy.value.screens.active;
  }
  return copy.value.screens.ready;
}

function screenRowActionLabel(row: ScreenRow): string {
  const state = screenStateLabel(row);
  return copy.value.screens.openScreen(row.name, state, row.meta);
}

</script>
