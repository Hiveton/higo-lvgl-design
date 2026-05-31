import { defineStore } from "pinia";
import { computed } from "vue";
import type { WidgetNode, WidgetType, WidgetPropValue } from "@hiveton-lvgl/schema";
import { widgetCatalog } from "@hiveton-lvgl/schema";
import {
  addWidget,
  deleteWidget,
  findWidgetById,
  moveWidget,
  resizeWidget,
  updateWidgetLayout,
  updateWidgetProps,
  updateWidgetStyle
} from "../commands/editorCommands";
import { useProjectStore } from "./project";
import { useSelectionStore } from "./selection";

type DropPoint = {
  x: number;
  y: number;
};

type SizeInput = {
  width: number;
  height: number;
};

type AddWidgetOptions = {
  parentId?: string;
};

export const useWidgetStore = defineStore("widget", () => {
  const projectStore = useProjectStore();
  const selectionStore = useSelectionStore();

  function addWidgetFromCatalog(type: Exclude<WidgetType, "screen">, point: DropPoint, options: AddWidgetOptions = {}): void {
    const catalogItem = widgetCatalog.find((item) => item.type === type);
    if (!catalogItem || !projectStore.activeScreen) {
      return;
    }

    const selected = projectStore.selectedWidget;
    const explicitParent = options.parentId ? findWidgetById(projectStore.project, options.parentId) : null;
    const parentId = explicitParent?.type === "container" && !explicitParent.locked
      ? explicitParent.id
      : selected?.type === "container" && !selected.locked
        ? selected.id
        : projectStore.activeScreen.root.id;
    const name = nextWidgetName(projectStore.project, catalogItem.label);
    const widget: WidgetNode = {
      id: createEditorUUID(),
      type,
      name,
      parentId,
      children: [],
      layout: {
        x: point.x,
        y: point.y,
        width: catalogItem.defaultSize.width,
        height: catalogItem.defaultSize.height
      },
      props: defaultPropsFor(type),
      style: {},
      locked: false,
      hidden: false
    };

    projectStore.executeCommand(addWidget({ parentId, widget }));
    selectionStore.selectWidget(widget.id);
  }

  function deleteSelectedWidget(): void {
    const widget = projectStore.selectedWidget;
    if (!widget || widget.type === "screen" || widget.locked) {
      return;
    }
    const deletedWidgetId = widget.id;
    projectStore.executeCommand(deleteWidget({ widgetId: deletedWidgetId }));
    if (!findWidgetById(projectStore.project, deletedWidgetId)) {
      selectionStore.selectWidget(null);
    }
  }

  function updateSelectedProps(props: Record<string, WidgetPropValue>): void {
    const widget = projectStore.selectedWidget;
    if (!widget || widget.locked) {
      return;
    }
    projectStore.executeCommand(updateWidgetProps({ widgetId: widget.id, props }));
  }

  function updateSelectedStyle(style: WidgetNode["style"]): void {
    const widget = projectStore.selectedWidget;
    if (!widget || widget.locked) {
      return;
    }
    projectStore.executeCommand(updateWidgetStyle({ widgetId: widget.id, style }));
  }

  function moveSelectedWidget(point: DropPoint): void {
    const widget = projectStore.selectedWidget;
    if (!widget || widget.locked) {
      return;
    }
    projectStore.executeCommand(moveWidget({ widgetId: widget.id, x: point.x, y: point.y }));
  }

  function resizeSelectedWidget(size: SizeInput): void {
    const widget = projectStore.selectedWidget;
    if (!widget || widget.locked) {
      return;
    }
    projectStore.executeCommand(resizeWidget({ widgetId: widget.id, width: size.width, height: size.height }));
  }

  function updateWidgetLayoutById(widgetId: string, layout: Partial<{ x: number; y: number; width: number; height: number }>): void {
    projectStore.executeCommand(updateWidgetLayout({ widgetId, layout }));
  }

  return {
    addWidgetFromCatalog,
    deleteSelectedWidget,
    updateSelectedProps,
    updateSelectedStyle,
    moveSelectedWidget,
    resizeSelectedWidget,
    updateWidgetLayoutById
  };
});

function createEditorUUID(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (character) => {
    const random = Math.trunc(Math.random() * 16);
    const value = Number(character) ^ (random & (15 >> (Number(character) / 4)));
    return value.toString(16);
  });
}

function defaultPropsFor(type: Exclude<WidgetType, "screen">): Record<string, WidgetPropValue> {
  if (type === "label") {
    return { text: "Label" };
  }
  if (type === "button") {
    return { text: "Button" };
  }
  if (type === "checkbox") {
    return { text: "Checkbox", checked: false };
  }
  if (type === "switch") {
    return { checked: false };
  }
  if (type === "slider" || type === "bar" || type === "arc") {
    return { min: 0, max: 100, value: 0 };
  }
  if (type === "dropdown") {
    return { options: "Option 1\nOption 2", selected: 0 };
  }
  if (type === "spinner") {
    return { spinTime: 1000, arcLength: 60 };
  }
  if (type === "chart") {
    return { min: 0, max: 100, pointCount: 8 };
  }
  return {};
}

function nextWidgetName(doc: { screens: Array<{ root: WidgetNode }> }, label: string): string {
  const existing = collectExistingWidgetNames(doc);
  let index = 1;
  let candidate = `${label}_${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${label}_${index}`;
  }
  return candidate;
}

function collectExistingWidgetNames(doc: { screens: Array<{ root: WidgetNode }> }): Set<string> {
  const names = new Set<string>();
  for (const screen of doc.screens) {
    collectNames(screen.root, names);
  }
  return names;
}

function collectNames(widget: WidgetNode, names: Set<string>): void {
  names.add(widget.name);
  for (const child of widget.children) {
    collectNames(child, names);
  }
}
