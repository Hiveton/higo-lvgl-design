import type { ProjectDoc } from "@hiveton-lvgl/schema";
import { defineStore } from "pinia";
import { ref } from "vue";
import { createHistory, type EditorCommand, type EditorHistory } from "../commands/editorCommands";

export const useHistoryStore = defineStore("history", () => {
  const history = ref<EditorHistory | null>(null);
  const doc = ref<ProjectDoc | null>(null);
  const entries = ref<EditorHistory["entries"]>([]);

  function initialize(initialDoc: ProjectDoc): void {
    history.value = createHistory(initialDoc);
    syncSnapshots();
  }

  function execute(command: EditorCommand): void {
    history.value?.execute(command);
    syncSnapshots();
  }

  function replaceDoc(nextDoc: ProjectDoc): void {
    history.value?.replaceDoc(nextDoc);
    syncSnapshots();
  }

  function undo(): void {
    history.value?.undo();
    syncSnapshots();
  }

  function redo(): void {
    history.value?.redo();
    syncSnapshots();
  }

  function syncSnapshots(): void {
    doc.value = history.value?.doc ?? null;
    entries.value = history.value?.entries ?? [];
  }

  return {
    doc,
    entries,
    initialize,
    execute,
    replaceDoc,
    undo,
    redo
  };
});
