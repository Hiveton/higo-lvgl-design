<template>
  <footer class="status-bar">
    <span class="status-dot" data-testid="status-save-dot" role="img" :aria-label="saveStatusLabel" :title="saveStatusLabel" />
    <span>Autosave</span>
    <span>{{ saveStateLabel }}</span>
    <span class="status-activity" data-testid="status-activity" role="status" aria-live="polite" aria-atomic="true">{{ activityMessage }}</span>
    <span class="toolbar-spacer" />
    <span class="status-pill" data-testid="persistence-status">{{ persistenceLabel }}</span>
    <span class="status-pill" data-testid="status-lvgl-version">LVGL v{{ lvglVersion }}</span>
    <span class="status-pill" data-testid="status-dpi">DPI: {{ dpi }}</span>
    <span class="status-pill" data-testid="status-coordinates">X: {{ coordinates.x }} Y: {{ coordinates.y }}</span>
  </footer>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  saveStateLabel: string;
  persistenceLabel: string;
  activityMessage: string;
  lvglVersion: string;
  dpi: number;
  coordinates: {
    x: number;
    y: number;
  };
}>();

const saveStatusLabel = computed(() => `Save status: ${props.saveStateLabel}`);
</script>
