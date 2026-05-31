import type { WidgetNode } from "@hiveton-lvgl/schema";

export function collectWidgetIds(widget: WidgetNode): Set<string> {
  const ids = new Set<string>([widget.id]);
  for (const child of widget.children) {
    for (const childId of collectWidgetIds(child)) {
      ids.add(childId);
    }
  }
  return ids;
}

export function collectNames(widget: WidgetNode, names: Set<string> = new Set()): Set<string> {
  names.add(widget.name);
  for (const child of widget.children) {
    collectNames(child, names);
  }
  return names;
}

export function collectExistingWidgetNames(widgets: WidgetNode[]): Set<string> {
  const names = new Set<string>();
  for (const widget of widgets) {
    collectNames(widget, names);
  }
  return names;
}

export function findWidgetById(widget: WidgetNode, id: string): WidgetNode | null {
  if (widget.id === id) return widget;
  for (const child of widget.children) {
    const found = findWidgetById(child, id);
    if (found) return found;
  }
  return null;
}
