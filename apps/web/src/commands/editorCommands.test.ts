import { createDefaultProjectDoc } from "@hiveton-lvgl/schema";
import { describe, expect, it } from "vitest";
import {
  addEventBindingCommand,
  addWidget,
  createHistory,
  deleteWidget,
  moveWidget,
  moveWidgetToParent,
  replaceProjectDocCommand,
  removeEventBindingCommand,
  reorderWidget,
  resizeWidget,
  updateWidgetLayout,
  updateWidgetMeta,
  updateWidgetStyle
} from "./editorCommands";

describe("editor commands", () => {
  it("adds a widget and can undo it", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    const history = createHistory(doc);

    history.execute(
      addWidget({
        parentId: "root-screen-1",
        widget: {
          id: "label-1",
          type: "label",
          name: "Label_1",
          parentId: "root-screen-1",
          children: [],
          layout: { x: 10, y: 20, width: 120, height: 32 },
          props: { text: "Hello" },
          style: {},
          locked: false,
          hidden: false
        }
      })
    );

    expect(history.doc.screens[0].root.children.map((child) => child.id)).toEqual(["label-1"]);
    expect(history.entries).toMatchObject([{ label: "Add Label_1", status: "done" }]);

    history.undo();

    expect(history.doc.screens[0].root.children).toEqual([]);
    expect(history.entries[0]).toMatchObject({ label: "Add Label_1", status: "undone" });
  });

  it("moves a widget and can redo the move", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    const history = createHistory(doc);

    history.execute(
      addWidget({
        parentId: "root-screen-1",
        widget: {
          id: "button-1",
          type: "button",
          name: "Button_1",
          parentId: "root-screen-1",
          children: [],
          layout: { x: 10, y: 20, width: 120, height: 44 },
          props: {},
          style: {},
          locked: false,
          hidden: false
        }
      })
    );
    history.execute(moveWidget({ widgetId: "button-1", x: 42, y: 64 }));

    expect(history.doc.screens[0].root.children[0].layout).toMatchObject({ x: 42, y: 64 });

    history.undo();
    expect(history.doc.screens[0].root.children[0].layout).toMatchObject({ x: 10, y: 20 });

    history.redo();
    expect(history.doc.screens[0].root.children[0].layout).toMatchObject({ x: 42, y: 64 });
    expect(history.entries.some((entry) => entry.label === "Move widget" && entry.status === "done")).toBe(true);
  });

  it("tracks duplicate command labels by history entry id", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    const history = createHistory(doc);

    history.execute(
      addWidget({
        parentId: "root-screen-1",
        widget: {
          id: "button-1",
          type: "button",
          name: "Button_1",
          parentId: "root-screen-1",
          children: [],
          layout: { x: 10, y: 20, width: 120, height: 44 },
          props: {},
          style: {},
          locked: false,
          hidden: false
        }
      })
    );
    history.execute(moveWidget({ widgetId: "button-1", x: 42, y: 64 }));
    history.execute(moveWidget({ widgetId: "button-1", x: 50, y: 72 }));

    history.undo();

    const moveEntries = history.entries.filter((entry) => entry.label === "Move widget");
    expect(moveEntries.map((entry) => entry.status)).toEqual(["done", "undone"]);

    history.redo();
    expect(history.entries.filter((entry) => entry.label === "Move widget").map((entry) => entry.status)).toEqual(["done", "done"]);
  });

  it("keeps command history capped at the configured limit", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    const history = createHistory(doc, 3);

    for (let index = 1; index <= 5; index += 1) {
      history.execute(replaceProjectDocCommand({
        id: `rename-${index}`,
        label: `Rename ${index}`,
        update: (current) => ({ ...current, name: `Project ${index}` })
      }));
    }

    expect(history.entries.map((entry) => entry.label)).toEqual(["Rename 3", "Rename 4", "Rename 5"]);
    history.undo();
    history.undo();
    history.undo();
    history.undo();
    expect(history.doc.name).toBe("Project 2");
  });

  it("updates widget style without mutating the original document", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    const history = createHistory(doc);
    history.execute(
      addWidget({
        parentId: "root-screen-1",
        widget: {
          id: "label-1",
          type: "label",
          name: "Label_1",
          parentId: "root-screen-1",
          children: [],
          layout: { x: 10, y: 20, width: 120, height: 32 },
          props: { text: "Hello" },
          style: {},
          locked: false,
          hidden: false
        }
      })
    );
    const beforeStyle = history.doc.screens[0].root.children[0].style;

    history.execute(updateWidgetStyle({ widgetId: "label-1", style: { textColor: "#FFFFFF" } }));

    expect(beforeStyle).toEqual({});
    expect(history.doc.screens[0].root.children[0].style).toEqual({ textColor: "#FFFFFF" });
  });

  it("resizes a widget and restores its previous size on undo", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    const history = createHistory(doc);
    history.execute(
      addWidget({
        parentId: "root-screen-1",
        widget: {
          id: "button-1",
          type: "button",
          name: "Button_1",
          parentId: "root-screen-1",
          children: [],
          layout: { x: 10, y: 20, width: 120, height: 44 },
          props: {},
          style: {},
          locked: false,
          hidden: false
        }
      })
    );

    history.execute(resizeWidget({ widgetId: "button-1", width: 180, height: 52 }));
    expect(history.doc.screens[0].root.children[0].layout).toMatchObject({ width: 180, height: 52 });

    history.undo();
    expect(history.doc.screens[0].root.children[0].layout).toMatchObject({ width: 120, height: 44 });
  });

  it("deletes a widget and restores it on undo", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    const history = createHistory(doc);
    history.execute(
      addWidget({
        parentId: "root-screen-1",
        widget: {
          id: "label-1",
          type: "label",
          name: "Label_1",
          parentId: "root-screen-1",
          children: [],
          layout: { x: 10, y: 20, width: 120, height: 32 },
          props: { text: "Hello" },
          style: {},
          locked: false,
          hidden: false
        }
      })
    );

    history.execute(deleteWidget({ widgetId: "label-1" }));
    expect(history.doc.screens[0].root.children).toHaveLength(0);

    history.undo();
    expect(history.doc.screens[0].root.children[0].name).toBe("Label_1");
  });

  it("removes deleted widget event bindings and restores them on undo", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "container-1",
      type: "container",
      name: "Container_1",
      parentId: "root-screen-1",
      children: [
        {
          id: "label-1",
          type: "label",
          name: "Label_1",
          parentId: "container-1",
          children: [],
          layout: { x: 8, y: 8, width: 120, height: 32 },
          props: { text: "Hello" },
          style: {},
          locked: false,
          hidden: false
        }
      ],
      layout: { x: 10, y: 20, width: 180, height: 120 },
      props: {},
      style: {},
      locked: false,
      hidden: false
    });
    doc.events = [
      { id: "event-container", widgetId: "container-1", event: "LV_EVENT_CLICKED", handlerName: "on_container_clicked" },
      { id: "event-label", widgetId: "label-1", event: "LV_EVENT_READY", handlerName: "on_label_ready" }
    ];
    const history = createHistory(doc);

    history.execute(deleteWidget({ widgetId: "container-1" }));

    expect(history.doc.events).toEqual([]);

    history.undo();

    expect(history.doc.events.map((event) => event.id)).toEqual(["event-container", "event-label"]);
  });

  it("updates widget lock and hidden flags with undo support", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    const history = createHistory(doc);
    history.execute(
      addWidget({
        parentId: "root-screen-1",
        widget: {
          id: "label-1",
          type: "label",
          name: "Label_1",
          parentId: "root-screen-1",
          children: [],
          layout: { x: 10, y: 20, width: 120, height: 32 },
          props: { text: "Hello" },
          style: {},
          locked: false,
          hidden: false
        }
      })
    );

    history.execute(updateWidgetMeta({ widgetId: "label-1", locked: true, hidden: true }));
    expect(history.doc.screens[0].root.children[0]).toMatchObject({ locked: true, hidden: true });

    history.undo();
    expect(history.doc.screens[0].root.children[0]).toMatchObject({ locked: false, hidden: false });
  });

  it("reorders sibling widgets and can undo the layer move", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    const history = createHistory(doc);
    for (const id of ["label-1", "label-2"]) {
      history.execute(
        addWidget({
          parentId: "root-screen-1",
          widget: {
            id,
            type: "label",
            name: id === "label-1" ? "Label_1" : "Label_2",
            parentId: "root-screen-1",
            children: [],
            layout: { x: 10, y: 20, width: 120, height: 32 },
            props: { text: "Hello" },
            style: {},
            locked: false,
            hidden: false
          }
        })
      );
    }

    history.execute(reorderWidget({ widgetId: "label-2", direction: -1 }));
    expect(history.doc.screens[0].root.children.map((widget) => widget.id)).toEqual(["label-2", "label-1"]);

    history.undo();
    expect(history.doc.screens[0].root.children.map((widget) => widget.id)).toEqual(["label-1", "label-2"]);
  });

  it("moves a widget into another parent and can undo the parent move", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    const history = createHistory(doc);
    history.execute(
      addWidget({
        parentId: "root-screen-1",
        widget: {
          id: "container-1",
          type: "container",
          name: "Container_1",
          parentId: "root-screen-1",
          children: [],
          layout: { x: 0, y: 0, width: 200, height: 160 },
          props: {},
          style: {},
          locked: false,
          hidden: false
        }
      })
    );
    history.execute(
      addWidget({
        parentId: "root-screen-1",
        widget: {
          id: "label-1",
          type: "label",
          name: "Label_1",
          parentId: "root-screen-1",
          children: [],
          layout: { x: 10, y: 20, width: 120, height: 32 },
          props: { text: "Hello" },
          style: {},
          locked: false,
          hidden: false
        }
      })
    );

    history.execute(moveWidgetToParent({ widgetId: "label-1", targetParentId: "container-1" }));

    expect(history.doc.screens[0].root.children).toHaveLength(1);
    expect(history.doc.screens[0].root.children[0].children[0]).toMatchObject({
      id: "label-1",
      parentId: "container-1"
    });

    history.undo();
    expect(history.doc.screens[0].root.children.map((widget) => widget.id)).toEqual(["container-1", "label-1"]);
  });

  it("updates advanced layout metadata and restores it on undo", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    const history = createHistory(doc);
    history.execute(
      addWidget({
        parentId: "root-screen-1",
        widget: {
          id: "container-1",
          type: "container",
          name: "Container_1",
          parentId: "root-screen-1",
          children: [],
          layout: { x: 10, y: 20, width: 120, height: 80 },
          props: {},
          style: {},
          locked: false,
          hidden: false
        }
      })
    );

    history.execute(updateWidgetLayout({
      widgetId: "container-1",
      layout: { align: "center", flex: { direction: "row", gap: 8, wrap: false } }
    }));

    expect(history.doc.screens[0].root.children[0].layout).toMatchObject({
      align: "center",
      flex: { direction: "row", gap: 8, wrap: false }
    });
    history.undo();
    expect(history.doc.screens[0].root.children[0].layout.align).toBeUndefined();
  });

  it("adds and removes event bindings with undo support", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    doc.screens[0].root.children.push({
      id: "label-1",
      type: "label",
      name: "Label_1",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 10, y: 20, width: 120, height: 32 },
      props: { text: "Hello" },
      style: {},
      locked: false,
      hidden: false
    });
    const history = createHistory(doc);

    history.execute(addEventBindingCommand({
      binding: {
        id: "event-label-clicked",
        widgetId: "label-1",
        event: "LV_EVENT_CLICKED",
        handlerName: "on_label_clicked"
      }
    }));

    expect(history.doc.events.map((event) => event.id)).toEqual(["event-label-clicked"]);

    history.undo();
    expect(history.doc.events).toEqual([]);

    history.redo();
    expect(history.doc.events.map((event) => event.id)).toEqual(["event-label-clicked"]);

    history.execute(removeEventBindingCommand({ eventId: "event-label-clicked" }));
    expect(history.doc.events).toEqual([]);

    history.undo();
    expect(history.doc.events.map((event) => event.id)).toEqual(["event-label-clicked"]);
  });

  it("replaces document-level fields with undo support", () => {
    const doc = createDefaultProjectDoc({
      id: "project-1",
      name: "My Watch UI",
      updatedAt: "2026-05-08T00:00:00Z"
    });
    const history = createHistory(doc);

    history.execute(replaceProjectDocCommand({
      id: "rename-project",
      label: "Rename project",
      update(current) {
        return {
          ...current,
          name: "Renamed UI"
        };
      }
    }));

    expect(history.doc.name).toBe("Renamed UI");

    history.undo();
    expect(history.doc.name).toBe("My Watch UI");

    history.redo();
    expect(history.doc.name).toBe("Renamed UI");
  });
});
