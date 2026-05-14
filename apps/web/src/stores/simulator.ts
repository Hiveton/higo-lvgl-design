import { defineStore } from "pinia";
import { ref } from "vue";

export type SimulatorStatus = "loading" | "ready" | "rendering" | "failed";

export const useSimulatorStore = defineStore("simulator", () => {
  const status = ref<SimulatorStatus>("loading");
  const message = ref("Loading runtime");
  const lastError = ref<string | null>(null);

  function markLoading(nextMessage = "Loading runtime"): void {
    status.value = "loading";
    message.value = nextMessage;
    lastError.value = null;
  }

  function markReady(nextMessage = "Simulator loaded"): void {
    status.value = "ready";
    message.value = nextMessage;
    lastError.value = null;
  }

  function markRendering(screenName: string): void {
    status.value = "rendering";
    message.value = `Rendering ${screenName}`;
    lastError.value = null;
  }

  function markFailed(nextMessage: string): void {
    status.value = "failed";
    message.value = nextMessage;
    lastError.value = nextMessage;
  }

  return {
    status,
    message,
    lastError,
    markLoading,
    markReady,
    markRendering,
    markFailed
  };
});
