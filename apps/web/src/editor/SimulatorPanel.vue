<template>
  <div class="simulator-panel panel" :class="`simulator-bg-${background}`" data-testid="simulator-panel">
    <div class="panel-title simulator-title">
      <span class="simulator-heading">{{ copy.previewRuntime.simulator }}</span>
      <span class="runtime-pill" data-testid="simulator-runtime-kind" :aria-label="runtimeKindLabel" :title="runtimeKindLabel">
        {{ runtimeKindText }}
      </span>
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
    <p class="simulator-message" data-testid="simulator-message" role="status" aria-live="polite" aria-atomic="true">{{ simulatorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useCopy } from "../i18n/useCopy";
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
  runtimeKind: "canvas" | "wasm" | "unknown";
  message: string;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const screenshotLinkRef = ref<HTMLAnchorElement | null>(null);
const copy = useCopy();
const simulatorScreenName = computed(() => props.activeScreenName ?? copy.value.previewRuntime.currentScreen);
const refreshSimulatorLabel = computed(() => copy.value.previewRuntime.refreshSimulator(simulatorScreenName.value));
const captureScreenshotLabel = computed(() => copy.value.previewRuntime.captureSimulatorScreenshot(simulatorScreenName.value));
const downloadScreenshotLabel = computed(() => copy.value.previewRuntime.downloadSimulatorScreenshot(simulatorScreenName.value));
const fullscreenSimulatorLabel = computed(() => copy.value.previewRuntime.fullscreenSimulator(simulatorScreenName.value));
const simulatorStatusLabel = computed(() => copy.value.previewRuntime.simulatorStatus(props.status));
const runtimeKindText = computed(() => copy.value.previewRuntime.runtimeKinds[props.runtimeKind]);
const runtimeKindLabel = computed(() => copy.value.previewRuntime.runtimeMode(runtimeKindText.value));
const backgroundToggleLabel = computed(() =>
  props.background === "dark" ? copy.value.previewRuntime.switchSimulatorLight : copy.value.previewRuntime.switchSimulatorDark
);
const simulatorMessage = computed(() => {
  if (matchesKnownRuntimeMessage(props.message, "loadingRuntime")) {
    return copy.value.runtime.loadingRuntime;
  }
  if (matchesKnownRuntimeMessage(props.message, "simulatorLoaded")) {
    return copy.value.runtime.simulatorLoaded;
  }
  if (matchesKnownRuntimeMessage(props.message, "previewUpdated")) {
    return copy.value.runtime.previewUpdated;
  }
  if (matchesKnownRuntimeMessage(props.message, "simulatorHidden")) {
    return copy.value.runtime.simulatorHidden;
  }
  const renderedScreenName = renderedScreenNameFromMessage(props.message);
  if (renderedScreenName) {
    return copy.value.runtime.renderScreen(renderedScreenName);
  }
  return props.message;
});

function matchesKnownRuntimeMessage(message: string, key: "loadingRuntime" | "previewUpdated" | "simulatorHidden" | "simulatorLoaded"): boolean {
  return message === copy.value.runtime[key] || knownRuntimeMessages[key].includes(message);
}

function renderedScreenNameFromMessage(message: string): string | null {
  for (const prefix of renderPrefixes) {
    if (message.startsWith(prefix)) {
      return message.slice(prefix.length);
    }
  }
  return null;
}

const knownRuntimeMessages = {
  loadingRuntime: ["Loading runtime", "正在加载 runtime"],
  previewUpdated: ["Preview updated", "预览已更新"],
  simulatorHidden: ["Simulator hidden", "模拟器已隐藏"],
  simulatorLoaded: ["Simulator loaded", "模拟器已加载"]
};

const renderPrefixes = ["Rendering ", "正在渲染 "];

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
