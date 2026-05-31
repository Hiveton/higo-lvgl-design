import { defineStore } from "pinia";
import { ref } from "vue";
import type { WidgetNode, EventBinding } from "@hiveton-lvgl/schema";

type WidgetClipboard = {
  widget: WidgetNode;
  events: EventBinding[];
};

export const useClipboardStore = defineStore("clipboard", () => {
  const copiedWidget = ref<WidgetClipboard | null>(null);

  function copy(widget: WidgetNode, events: EventBinding[]) {
    copiedWidget.value = { widget: structuredClone(widget), events: structuredClone(events) };
  }

  function paste(): WidgetClipboard | null {
    return copiedWidget.value;
  }

  function clear() {
    copiedWidget.value = null;
  }

  return { copiedWidget, copy, paste, clear };
});
