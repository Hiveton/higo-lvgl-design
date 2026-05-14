<template>
  <div class="simulator-panel panel">
    <div class="panel-title simulator-title">
      Simulator
      <span class="status-dot" :class="`status-${status}`" :data-testid="`simulator-status-${status}`" />
    </div>
    <canvas ref="canvasRef" class="simulator-device" data-testid="simulator-canvas" />
    <p class="simulator-message" data-testid="simulator-message">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

const emit = defineEmits<{
  mounted: [canvas: HTMLCanvasElement];
}>();

defineProps<{
  status: "loading" | "ready" | "rendering" | "failed";
  message: string;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

onMounted(() => {
  if (canvasRef.value) {
    emit("mounted", canvasRef.value);
  }
});
</script>
