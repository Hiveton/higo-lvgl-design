import { createDefaultProjectDoc } from "@hiveton-lvgl/schema";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useSelectionStore } from "./selection";

describe("useSelectionStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("tracks selected and hovered widget ids", () => {
    const store = useSelectionStore();

    store.selectWidget("button-1");
    store.hoverWidget("label-1");

    expect(store.selectedWidgetId).toBe("button-1");
    expect(store.hoveredWidgetId).toBe("label-1");

    store.clearSelection();
    expect(store.selectedWidgetId).toBeNull();
  });

  it("clears stale selected and hovered widget ids after ProjectDoc changes", () => {
    const doc = createDefaultProjectDoc({
      id: "project-test",
      name: "Test UI",
      updatedAt: "2026-05-13T00:00:00Z"
    });
    doc.screens[0].root.children = [
      {
        id: "label-1",
        type: "label",
        name: "Label_1",
        parentId: doc.screens[0].root.id,
        children: [],
        layout: { x: 0, y: 0, width: 120, height: 32 },
        props: { text: "Label" },
        style: {},
        locked: false,
        hidden: false
      }
    ];
    const store = useSelectionStore();

    store.selectWidget("missing-widget");
    store.hoverWidget("label-1");
    store.reconcileSelection(doc);

    expect(store.selectedWidgetId).toBeNull();
    expect(store.hoveredWidgetId).toBe("label-1");

    doc.screens[0].root.children = [];
    store.reconcileSelection(doc);
    expect(store.hoveredWidgetId).toBeNull();
  });
});
