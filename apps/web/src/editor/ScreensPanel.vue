<template>
  <div class="screens-list">
    <div class="panel-title small">
      Screens
      <button class="mini-action" data-testid="add-screen-button" @click="$emit('add-screen')">+</button>
      <button class="mini-action" data-testid="duplicate-screen-button" :disabled="!activeScreen" @click="duplicateActiveScreen">⧉</button>
      <button class="mini-action" data-testid="delete-screen-button" :disabled="screens.length <= 1" @click="$emit('delete-active-screen')">×</button>
    </div>
    <p class="screen-summary" data-testid="screen-summary">
      {{ screens.length }} screen{{ screens.length === 1 ? "" : "s" }} · {{ activeWidgetCount }} widgets
    </p>
    <input
      v-if="activeScreen"
      class="panel-search"
      data-testid="active-screen-name-input"
      :value="activeScreen.name"
      @input="renameActiveScreen"
    />
    <p v-if="hasDuplicateScreenNames" class="field-error" data-testid="screen-name-warning">
      Screen names should be unique.
    </p>
    <button
      v-for="screen in screens"
      :key="screen.id"
      class="screen-row"
      :class="{ active: activeScreen?.id === screen.id }"
      :data-testid="`screen-row-${toTestId(screen.name)}`"
      @click="$emit('switch-screen', screen.id)"
    >
      <strong>{{ screen.name }}</strong>
      <span>{{ widgetCount(screen) }} widgets</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ScreenNode } from "@hiveton-lvgl/schema";
import { computed } from "vue";

const props = defineProps<{
  activeScreen: ScreenNode | undefined;
  screens: ScreenNode[];
  hasDuplicateScreenNames: boolean;
}>();

const emit = defineEmits<{
  "add-screen": [];
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

const activeWidgetCount = computed(() => props.activeScreen ? widgetCount(props.activeScreen) : 0);

function countWidgets(widgets: ScreenNode["root"]["children"]): number {
  return widgets.reduce((count, widget) => count + 1 + countWidgets(widget.children), 0);
}

function toTestId(name: string): string {
  return name.toLowerCase().replace(/_/g, "-");
}
</script>
