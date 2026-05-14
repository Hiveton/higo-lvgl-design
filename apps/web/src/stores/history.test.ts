import { createDefaultProjectDoc } from "@hiveton-lvgl/schema";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { updateWidgetProps } from "../commands/editorCommands";
import { useHistoryStore } from "./history";

describe("useHistoryStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("executes commands and exposes undo/redo timeline entries", () => {
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
    const store = useHistoryStore();

    store.initialize(doc);
    store.execute(updateWidgetProps({ widgetId: "label-1", props: { text: "Updated" } }));

    expect(store.doc?.screens[0].root.children[0].props.text).toBe("Updated");
    expect(store.entries).toContainEqual(expect.objectContaining({ label: "Update widget props", status: "done" }));

    store.undo();
    expect(store.doc?.screens[0].root.children[0].props.text).toBe("Label");
    expect(store.entries).toContainEqual(expect.objectContaining({ label: "Update widget props", status: "undone" }));

    store.redo();
    expect(store.doc?.screens[0].root.children[0].props.text).toBe("Updated");
  });

  it("replaces the underlying document without adding a history entry", () => {
    const doc = createDefaultProjectDoc({
      id: "project-test",
      name: "Before",
      updatedAt: "2026-05-13T00:00:00Z"
    });
    const store = useHistoryStore();

    store.initialize(doc);
    store.replaceDoc({ ...doc, name: "After" });

    expect(store.doc?.name).toBe("After");
    expect(store.entries).toEqual([]);
  });
});
