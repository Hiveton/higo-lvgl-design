import { ref, onBeforeUnmount, type Ref } from "vue";
import type { ProjectDoc } from "@hiveton-lvgl/schema";
import { loadRuntime, SimulatorRuntimeError, type LvglRuntime } from "@hiveton-lvgl/lvgl-wasm-runtime";
import type { EditorCopy } from "../i18n/copy";
import { localizedErrorForCode } from "../i18n/errors";
import { useSimulatorStore } from "../stores/simulator";
import { useAssetsStore } from "../stores/assets";
import { useLocaleStore } from "../stores/locale";

export function useSimulator(
  project: Ref<ProjectDoc>,
  activeScreen: Ref<{ id: string; name: string } | undefined>,
  copy: Ref<EditorCopy>
) {
  const simulatorStore = useSimulatorStore();
  const assetsStore = useAssetsStore();
  const localeStore = useLocaleStore();
  const simulatorVisible = ref(true);
  const simulatorCanvas = ref<HTMLCanvasElement | null>(null);
  const simulatorRuntime = ref<LvglRuntime | null>(null);
  const simulatorRenderTimer = ref<ReturnType<typeof setTimeout> | null>(null);
  const simulatorBackground = ref<"dark" | "light">("dark");
  const simulatorScreenshotUrl = ref<string | null>(null);
  let simulatorMountGeneration = 0;
  let simulatorMountInFlightGeneration: number | null = null;

  const simulatorWasmModuleUrl = import.meta.env.VITE_LVGL_WASM_MODULE_URL?.trim() || undefined;

  const simulatorStatus = ref(simulatorStore.status);
  const simulatorRuntimeKind = ref(simulatorStore.runtimeKind);
  const simulatorMessage = ref(simulatorStore.message);

  function scheduleSimulatorRender(): void {
    if (simulatorRenderTimer.value) {
      clearTimeout(simulatorRenderTimer.value);
    }
    simulatorRenderTimer.value = setTimeout(() => {
      void renderSimulator();
    }, 500);
  }

  async function renderSimulator(): Promise<boolean> {
    const runtime = simulatorRuntime.value;
    const canvas = simulatorCanvas.value;
    const renderGeneration = simulatorMountGeneration;
    if (!runtime || !canvas || !simulatorVisible.value) {
      return false;
    }
    try {
      const screenName = activeScreen.value?.name ?? "Screen_1";
      simulatorStore.markRendering(screenName, copy.value.runtime.renderScreen(screenName));
      await runtime.renderProject(projectDocForRuntime(project.value, activeScreen.value?.id ?? null));
      if (renderGeneration !== simulatorMountGeneration || simulatorRuntime.value !== runtime || simulatorCanvas.value !== canvas || !simulatorVisible.value) {
        return false;
      }
      simulatorStore.markReady(copy.value.runtime.previewUpdated);
      return true;
    } catch (error) {
      if (renderGeneration !== simulatorMountGeneration || simulatorRuntime.value !== runtime || simulatorCanvas.value !== canvas || !simulatorVisible.value) {
        return false;
      }
      const message = simulatorErrorMessage(error, copy.value.runtime.previewFailed);
      simulatorStore.markFailed(message);
      return false;
    }
  }

  async function mountSimulator(): Promise<void> {
    if (simulatorRuntime.value) {
      return;
    }
    const canvas = simulatorCanvas.value;
    const mountGeneration = simulatorMountGeneration;
    if (!canvas || !simulatorVisible.value) {
      return;
    }
    if (simulatorMountInFlightGeneration === mountGeneration) {
      return;
    }
    simulatorMountInFlightGeneration = mountGeneration;
    try {
      simulatorStore.markLoading(copy.value.runtime.loadingRuntime);
      const runtime = await loadRuntime({
        wasmModuleUrl: simulatorWasmModuleUrl,
        assetResolver: (asset: { id: string }) => assetsStore.previewUrls[asset.id] ?? null
      });
      if (mountGeneration !== simulatorMountGeneration || !simulatorVisible.value || simulatorCanvas.value !== canvas) {
        runtime.destroy();
        return;
      }
      simulatorRuntime.value = runtime;
      simulatorStore.setRuntimeKind(simulatorRuntime.value.getRuntimeKind?.() ?? "unknown");
      await simulatorRuntime.value.mount(canvas);
      if (mountGeneration !== simulatorMountGeneration || !simulatorVisible.value || simulatorCanvas.value !== canvas) {
        simulatorRuntime.value?.destroy();
        simulatorRuntime.value = null;
        return;
      }
      simulatorStore.markReady(copy.value.runtime.simulatorLoaded);
      await renderSimulator();
    } catch (error) {
      if (mountGeneration !== simulatorMountGeneration || !simulatorVisible.value || simulatorCanvas.value !== canvas) {
        return;
      }
      const message = simulatorErrorMessage(error, copy.value.runtime.runtimeLoadFailed);
      simulatorStore.markFailed(message);
    } finally {
      if (simulatorMountInFlightGeneration === mountGeneration) {
        simulatorMountInFlightGeneration = null;
      }
    }
  }

  function toggleSimulatorPanel(): void {
    simulatorVisible.value = !simulatorVisible.value;
    if (!simulatorVisible.value) {
      simulatorMountGeneration += 1;
      simulatorRuntime.value?.destroy();
      simulatorRuntime.value = null;
      simulatorCanvas.value = null;
      simulatorStore.markLoading(copy.value.runtime.simulatorHidden);
    }
  }

  function handleSimulatorCanvasMounted(canvas: HTMLCanvasElement): void {
    simulatorMountGeneration += 1;
    simulatorCanvas.value = canvas;
    void mountSimulator();
  }

  function refreshSimulatorPanel(): void {
    simulatorScreenshotUrl.value = null;
    void renderSimulator();
  }

  function captureSimulatorScreenshot(): void {
    const canvas = simulatorCanvas.value;
    if (!canvas || typeof canvas.toDataURL !== "function") {
      return;
    }
    const screenshotUrl = captureCanvasDataUrl(canvas);
    if (!screenshotUrl) {
      return;
    }
    simulatorScreenshotUrl.value = screenshotUrl;
  }

  function toggleSimulatorBackground(): void {
    simulatorBackground.value = simulatorBackground.value === "dark" ? "light" : "dark";
  }

  async function requestSimulatorFullscreen(): Promise<void> {
    const canvas = simulatorCanvas.value as (HTMLCanvasElement & { requestFullscreen?: () => Promise<void> }) | null;
    if (!canvas?.requestFullscreen) {
      return;
    }
    try {
      await canvas.requestFullscreen();
    } catch (error) {
      console.error("Simulator fullscreen failed:", error);
    }
  }

  function captureCanvasDataUrl(canvas: HTMLCanvasElement): string | null {
    try {
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }

  function simulatorErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof SimulatorRuntimeError) {
      const summary = localizedErrorForCode(error.code, localeStore.locale, "RUNTIME_LOAD_FAILED");
      if (localeStore.locale === "en-US" && error.message) {
        return error.message.startsWith(summary) ? error.message : `${summary}: ${error.message}`;
      }
      return summary;
    }
    return error instanceof Error && localeStore.locale === "en-US" ? error.message : fallback;
  }

  function projectDocForRuntime(doc: ProjectDoc, activeScreenId: string | null): ProjectDoc {
    if (!activeScreenId) {
      return doc;
    }
    const activeIndex = doc.screens.findIndex((screen) => screen.id === activeScreenId);
    if (activeIndex <= 0) {
      return doc;
    }
    return {
      ...doc,
      screens: [
        doc.screens[activeIndex],
        ...doc.screens.slice(0, activeIndex),
        ...doc.screens.slice(activeIndex + 1)
      ]
    };
  }

  function destroySimulator(): void {
    simulatorMountGeneration += 1;
    if (simulatorRenderTimer.value) {
      clearTimeout(simulatorRenderTimer.value);
    }
    simulatorRuntime.value?.destroy();
  }

  onBeforeUnmount(() => {
    destroySimulator();
  });

  return {
    simulatorVisible,
    simulatorCanvas,
    simulatorRuntime,
    simulatorBackground,
    simulatorScreenshotUrl,
    simulatorStatus,
    simulatorRuntimeKind,
    simulatorMessage,
    scheduleSimulatorRender,
    renderSimulator,
    mountSimulator,
    toggleSimulatorPanel,
    handleSimulatorCanvasMounted,
    refreshSimulatorPanel,
    captureSimulatorScreenshot,
    toggleSimulatorBackground,
    requestSimulatorFullscreen,
    destroySimulator
  };
}
