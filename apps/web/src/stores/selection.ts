import type { ProjectDoc } from "@hiveton-lvgl/schema";
import { defineStore } from "pinia";
import { ref } from "vue";
import { findWidgetById } from "../commands/editorCommands";

export const useSelectionStore = defineStore("selection", () => {
  const selectedWidgetId = ref<string | null>("time-label");
  const hoveredWidgetId = ref<string | null>(null);

  function selectWidget(widgetId: string | null): void {
    selectedWidgetId.value = widgetId;
  }

  function hoverWidget(widgetId: string | null): void {
    hoveredWidgetId.value = widgetId;
  }

  function clearSelection(): void {
    selectedWidgetId.value = null;
  }

  function reconcileSelection(doc: ProjectDoc): void {
    if (selectedWidgetId.value && !findWidgetById(doc, selectedWidgetId.value)) {
      selectedWidgetId.value = null;
    }
    if (hoveredWidgetId.value && !findWidgetById(doc, hoveredWidgetId.value)) {
      hoveredWidgetId.value = null;
    }
  }

  return {
    selectedWidgetId,
    hoveredWidgetId,
    selectWidget,
    hoverWidget,
    clearSelection,
    reconcileSelection
  };
});
