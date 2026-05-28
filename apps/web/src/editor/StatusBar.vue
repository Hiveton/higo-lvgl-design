<template>
  <footer class="status-bar">
    <span class="status-dot" data-testid="status-save-dot" role="img" :aria-label="saveStatusLabel" :title="saveStatusLabel" />
    <span>{{ copy.status.autosave }}</span>
    <span>{{ saveStateLabel }}</span>
    <span class="status-activity" data-testid="status-activity" role="status" aria-live="polite" aria-atomic="true">{{ activityMessage }}</span>
    <span class="toolbar-spacer" />
    <span class="status-pill" data-testid="persistence-status">{{ persistenceLabel }}</span>
    <span class="status-pill" data-testid="status-lvgl-version">{{ copy.status.lvglVersion(lvglVersion) }}</span>
    <span class="status-pill" data-testid="status-dpi">{{ copy.status.dpi(dpi) }}</span>
    <span class="status-pill" data-testid="status-coordinates">{{ copy.status.coordinates(coordinates.x, coordinates.y) }}</span>
  </footer>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCopy } from "../i18n/useCopy";

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

const copy = useCopy();
const saveStatusLabel = computed(() => copy.value.status.saveStatus(props.saveStateLabel));
</script>
