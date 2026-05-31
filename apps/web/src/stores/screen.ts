import { defineStore } from "pinia";
import { computed } from "vue";
import type { WidgetNode } from "@hiveton-lvgl/schema";
import { getActiveScreen, type ProjectDoc } from "@hiveton-lvgl/schema";
import { replaceProjectDocCommand } from "../commands/editorCommands";
import { createEditorUUID, collectWidgetIds, collectExistingWidgetNames } from "../utils";
import { useProjectStore } from "./project";
import { useSelectionStore } from "./selection";

export const useScreenStore = defineStore("screen", () => {
  const projectStore = useProjectStore();
  const selectionStore = useSelectionStore();

  const activeScreenId = computed({
    get: () => projectStore.activeScreenId,
    set: (id: string) => {
      projectStore.activeScreenId = id;
    }
  });

  const activeScreen = computed(() =>
    getActiveScreen(projectStore.project, activeScreenId.value)
  );

  const screens = computed(() => projectStore.project.screens);

  function addScreen(name?: string): void {
    const doc = projectStore.project;
    const index = nextScreenIndex(doc);
    const id = createEditorUUID();
    const rootId = createEditorUUID();
    const screenName = uniqueScreenName(name?.trim() || `Screen_${index}`, doc.screens.map((screen) => screen.name));
    projectStore.executeCommand(replaceProjectDocCommand({
      id: `add-screen-${id}`,
      label: "Add screen",
      message: { key: "addScreen" },
      update(doc) {
        return {
          ...doc,
          screens: [
            ...doc.screens,
            {
              id,
              name: screenName,
              root: {
                id: rootId,
                type: "screen",
                name: screenName,
                parentId: null,
                children: [],
                layout: {
                  x: 0,
                  y: 0,
                  width: doc.target.width,
                  height: doc.target.height
                },
                props: {},
                style: { bgColor: "#101010" },
                locked: false,
                hidden: false
              }
            }
          ]
        };
      }
    }));
    activeScreenId.value = id;
    selectionStore.selectWidget(null);
  }

  function deleteScreen(screenId: string): void {
    const doc = projectStore.project;
    if (doc.screens.length <= 1) {
      return;
    }
    const deletingActiveScreen = activeScreenId.value === screenId;
    const deletedScreenIndex = doc.screens.findIndex((screen) => screen.id === screenId);
    const deletedScreen = doc.screens.find((screen) => screen.id === screenId);
    const nextScreens = doc.screens.filter((screen) => screen.id !== screenId);
    if (nextScreens.length === doc.screens.length) {
      return;
    }
    const deletedWidgetIds = deletedScreen ? collectWidgetIds(deletedScreen.root) : new Set<string>();
    projectStore.executeCommand(replaceProjectDocCommand({
      id: `delete-screen-${screenId}`,
      label: "Delete screen",
      message: { key: "deleteScreen" },
      update(doc) {
        return {
          ...doc,
          screens: doc.screens.filter((screen) => screen.id !== screenId),
          events: doc.events.filter((event) => !deletedWidgetIds.has(event.widgetId))
        };
      }
    }));
    if (deletingActiveScreen) {
      const adjacentIndex = Math.min(Math.max(deletedScreenIndex, 0), nextScreens.length - 1);
      const adjacentScreen = nextScreens[adjacentIndex];
      activeScreenId.value = adjacentScreen.id;
      selectionStore.selectWidget(adjacentScreen.root.children[0]?.id ?? null);
    }
  }

  function switchScreen(screenId: string): void {
    const doc = projectStore.project;
    if (!doc.screens.some((screen) => screen.id === screenId)) {
      return;
    }
    activeScreenId.value = screenId;
    selectionStore.selectWidget(doc.screens.find((screen) => screen.id === screenId)?.root.children[0]?.id ?? null);
  }

  function duplicateScreen(screenId: string): void {
    const doc = projectStore.project;
    const source = doc.screens.find((screen) => screen.id === screenId);
    if (!source) {
      return;
    }
    const nextIndex = doc.screens.length + 1;
    const nextScreenId = createEditorUUID();
    const names = collectExistingWidgetNames(doc.screens.map(s => s.root));
    const sequence = { count: 1 };
    const root = cloneWidgetForPaste(source.root, null, names, sequence);
    const nextName = nextCopyName(new Set(doc.screens.map((screen) => screen.name)), source.name);
    const nextRoot = {
      ...root,
      id: createEditorUUID(),
      type: "screen" as const,
      name: nextName,
      parentId: null,
      layout: {
        ...source.root.layout,
        width: doc.target.width,
        height: doc.target.height
      }
    };
    normalizeChildParentIds(nextRoot);
    const clonedWidgetIds = mapClonedWidgetIds(source.root, nextRoot);
    const clonedEvents = doc.events
      .filter((event) => clonedWidgetIds.has(event.widgetId))
      .map((event) => ({
        ...event,
        id: createEditorUUID(),
        widgetId: clonedWidgetIds.get(event.widgetId) ?? event.widgetId
      }));
    projectStore.executeCommand(replaceProjectDocCommand({
      id: `duplicate-screen-${screenId}`,
      label: "Duplicate screen",
      message: { key: "duplicateScreen" },
      update(doc) {
        return {
          ...doc,
          screens: [
            ...doc.screens,
            {
              id: nextScreenId,
              name: nextName,
              root: nextRoot
            }
          ],
          events: [...doc.events, ...clonedEvents]
        };
      }
    }));
    activeScreenId.value = nextScreenId;
    selectionStore.selectWidget(nextRoot.children[0]?.id ?? null);
  }

  function renameScreen(screenId: string, name: string): void {
    const nextName = name.trim();
    if (!nextName) {
      return;
    }
    projectStore.executeCommand(replaceProjectDocCommand({
      id: `rename-screen-${screenId}`,
      label: "Rename screen",
      message: { key: "renameScreen" },
      update(doc) {
        return {
          ...doc,
          screens: doc.screens.map((screen) =>
            screen.id === screenId
              ? {
                  ...screen,
                  name: nextName,
                  root: {
                    ...screen.root,
                    name: nextName
                  }
                }
              : screen
          )
        };
      }
    }));
  }

  return {
    activeScreenId,
    activeScreen,
    screens,
    addScreen,
    deleteScreen,
    switchScreen,
    duplicateScreen,
    renameScreen
  };
});

function cloneWidgetForPaste(
  widget: WidgetNode,
  parentId: string | null,
  existingNames: Set<string>,
  sequence: { count: number }
): WidgetNode {
  const pastedName = nextCopyName(existingNames, widget.name);
  existingNames.add(pastedName);
  const id = createEditorUUID();
  sequence.count += 1;
  const nextWidget: WidgetNode = {
    ...cloneWidgetTree(widget),
    id,
    name: pastedName,
    parentId,
    layout: {
      ...widget.layout,
      x: widget.layout.x + 16,
      y: widget.layout.y + 16
    },
    children: []
  };
  nextWidget.children = widget.children.map((child) => cloneWidgetForPaste(child, id, existingNames, sequence));
  return nextWidget;
}

function cloneWidgetTree(widget: WidgetNode): WidgetNode {
  return JSON.parse(JSON.stringify(widget)) as WidgetNode;
}

function normalizeChildParentIds(widget: WidgetNode): void {
  for (const child of widget.children) {
    child.parentId = widget.id;
    normalizeChildParentIds(child);
  }
}

function mapClonedWidgetIds(source: WidgetNode, clone: WidgetNode, result = new Map<string, string>()): Map<string, string> {
  result.set(source.id, clone.id);
  for (let index = 0; index < source.children.length; index += 1) {
    const sourceChild = source.children[index];
    const cloneChild = clone.children[index];
    if (sourceChild && cloneChild) {
      mapClonedWidgetIds(sourceChild, cloneChild, result);
    }
  }
  return result;
}

function nextCopyName(existingNames: Set<string>, sourceName: string): string {
  let index = 1;
  let candidate = `${sourceName}_${index}`;
  while (existingNames.has(candidate)) {
    index += 1;
    candidate = `${sourceName}_${index}`;
  }
  return candidate;
}

function uniqueScreenName(name: string, existingNames: string[]): string {
  const names = new Set(existingNames);
  if (!names.has(name)) {
    return name;
  }
  return nextCopyName(names, name);
}

function nextScreenIndex(doc: ProjectDoc): number {
  let maxIndex = 0;
  for (const screen of doc.screens) {
    maxIndex = Math.max(
      maxIndex,
      numericSuffix(screen.id, /^screen-(\d+)$/),
      numericSuffix(screen.root.id, /^root-screen-(\d+)$/),
      numericSuffix(screen.name, /^Screen_(\d+)$/)
    );
  }
  return maxIndex + 1;
}

function numericSuffix(value: string, pattern: RegExp): number {
  const match = value.match(pattern);
  const index = match ? Number(match[1]) : NaN;
  return Number.isInteger(index) && index > 0 ? index : 0;
}
