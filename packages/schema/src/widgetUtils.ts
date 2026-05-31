import type { WidgetNode } from "./index";

export function collectWidgetIds(widget: WidgetNode): Set<string> {
  const ids = new Set<string>([widget.id]);
  for (const child of widget.children) {
    for (const childId of collectWidgetIds(child)) {
      ids.add(childId);
    }
  }
  return ids;
}

export function isBuiltInLvglFont(font: string): boolean {
  return /^lv_font_montserrat_\d+$/.test(font);
}
