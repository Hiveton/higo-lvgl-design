<template>
  <div class="simulator-panel panel" :class="`simulator-bg-${background}`" data-testid="simulator-panel">
    <div class="panel-title simulator-title">
      <span>Simulator</span>
      <span class="simulator-actions" data-testid="simulator-actions">
        <button class="mini-action" type="button" data-testid="simulator-refresh-button" :aria-label="refreshSimulatorLabel" :title="refreshSimulatorLabel" @click="emit('refresh')">
          <IconGlyph name="refresh" />
        </button>
        <button class="mini-action" type="button" data-testid="simulator-screenshot-button" :aria-label="captureScreenshotLabel" :title="captureScreenshotLabel" @click="emit('screenshot')">
          <IconGlyph name="camera" />
        </button>
        <a
          v-if="screenshotUrl"
          ref="screenshotLinkRef"
          class="mini-action"
          data-testid="simulator-screenshot-link"
          :href="screenshotUrl"
          download="simulator.png"
          :aria-label="downloadScreenshotLabel"
          :title="downloadScreenshotLabel"
        >
          <IconGlyph name="download" />
        </a>
        <button
          class="mini-action"
          type="button"
          data-testid="simulator-background-button"
          :aria-label="backgroundToggleLabel"
          :title="backgroundToggleLabel"
          :aria-pressed="background === 'light' ? 'true' : 'false'"
          @click="emit('toggle-background')"
        >
          <IconGlyph name="grid" />
        </button>
        <button class="mini-action" type="button" data-testid="simulator-fullscreen-button" :aria-label="fullscreenSimulatorLabel" :title="fullscreenSimulatorLabel" @click="emit('fullscreen')">
          <IconGlyph name="fullscreen" />
        </button>
        <span
          class="status-dot"
          :class="`status-${status}`"
          :data-testid="`simulator-status-${status}`"
          role="img"
          :aria-label="simulatorStatusLabel"
          :title="simulatorStatusLabel"
        />
      </span>
    </div>
    <canvas ref="canvasRef" class="simulator-device" data-testid="simulator-canvas" />
    <p class="simulator-message" data-testid="simulator-message" role="status" aria-live="polite" aria-atomic="true">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import IconGlyph from "./IconGlyph.vue";

const emit = defineEmits<{
  fullscreen: [];
  mounted: [canvas: HTMLCanvasElement];
  refresh: [];
  screenshot: [];
  "toggle-background": [];
}>();

const props = defineProps<{
  activeScreenName?: string;
  background: "dark" | "light";
  screenshotUrl: string | null;
  status: "loading" | "ready" | "rendering" | "failed";
  message: string;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const screenshotLinkRef = ref<HTMLAnchorElement | null>(null);
const simulatorScreenName = computed(() => props.activeScreenName ?? "current screen");
const refreshSimulatorLabel = computed(() => `Refresh ${simulatorScreenName.value} simulator`);
const captureScreenshotLabel = computed(() => `Capture ${simulatorScreenName.value} simulator screenshot`);
const downloadScreenshotLabel = computed(() => `Download ${simulatorScreenName.value} simulator screenshot`);
const fullscreenSimulatorLabel = computed(() => `Open ${simulatorScreenName.value} simulator fullscreen`);
const simulatorStatusLabel = computed(() => `Simulator status: ${props.status}`);
const backgroundToggleLabel = computed(() =>
  props.background === "dark" ? "Switch simulator to light background" : "Switch simulator to dark background"
);

onMounted(() => {
  if (canvasRef.value) {
    emit("mounted", canvasRef.value);
  }
});

watch(
  () => props.screenshotUrl,
  (url, previousUrl) => {
    if (!url || url === previousUrl) {
      return;
    }
    void nextTick(() => {
      screenshotLinkRef.value?.focus();
    });
  }
);
</script>
