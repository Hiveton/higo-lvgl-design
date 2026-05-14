<template>
  <footer class="status-bar">
    <span class="status-dot" />
    <span>Autosave</span>
    <span>{{ saveStateLabel }}</span>
    <span class="toolbar-spacer" />
    <span data-testid="persistence-status">{{ persistenceLabel }}</span>
    <span>LVGL v{{ lvglVersion }}</span>
    <span>DPI: {{ dpi }}</span>
    <span data-testid="status-coordinates">X: {{ coordinates.x }} Y: {{ coordinates.y }}</span>
  </footer>
</template>

<script setup lang="ts">
defineProps<{
  saveStateLabel: string;
  persistenceLabel: string;
  lvglVersion: string;
  dpi: number;
  coordinates: {
    x: number;
    y: number;
  };
}>();
</script>
