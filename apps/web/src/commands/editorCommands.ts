import type { EventBinding, LayoutBox, ProjectDoc, WidgetNode, WidgetPropValue, WidgetStyle } from "@hiveton-lvgl/schema";

export type EditorCommand = {
  id: string;
  label: string;
  message: EditorCommandMessage;
  apply(doc: ProjectDoc): ProjectDoc;
  revert(doc: ProjectDoc): ProjectDoc;
};

export type EditorCommandMessage =
  | { key: "addWidget"; widgetType: WidgetNode["type"] }
  | { key: "addEventBinding" }
  | { key: "addScreen" }
  | { key: "deleteScreen" }
  | { key: "deleteWidget" }
  | { key: "duplicateScreen" }
  | { key: "moveWidget" }
  | { key: "moveWidgetInLayers" }
  | { key: "registerAsset" }
  | { key: "removeEventBinding" }
  | { key: "renameProject" }
  | { key: "renameScreen" }
  | { key: "reorderWidget" }
  | { key: "resizeWidget" }
  | { key: "updateProjectStyles" }
  | { key: "updateTarget" }
  | { key: "updateTheme" }
  | { key: "updateWidgetLayout" }
  | { key: "updateWidgetMetadata" }
  | { key: "updateWidgetProps" }
  | { key: "updateWidgetStyle" }
  | { key: "unregisterAsset" };

export type EditorHistory = {
  doc: ProjectDoc;
  entries: HistoryEntry[];
  execute(command: EditorCommand): void;
  replaceDoc(nextDoc: ProjectDoc): void;
  undo(): void;
  redo(): void;
};

export type HistoryEntry = {
  id: string;
  label: string;
  message: EditorCommandMessage;
  status: "done" | "undone";
  sequence: number;
};

type WidgetVisitor = (widget: WidgetNode) => WidgetNode;
type CommandStackEntry = {
  command: EditorCommand;
  entryId: string;
};
type WidgetLocation = {
  parentId: string;
  index: number;
  siblingCount: number;
  widget: WidgetNode;
};

export function createHistory(initialDoc: ProjectDoc, limit = 100): EditorHistory {
  let doc = cloneProjectDoc(initialDoc);
  const undoStack: CommandStackEntry[] = [];
  const redoStack: CommandStackEntry[] = [];
  const entries: HistoryEntry[] = [];
  let sequence = 1;

  return {
    get doc() {
      return doc;
    },
    get entries() {
      return entries.map((entry) => ({ ...entry }));
    },
    execute(command) {
      doc = command.apply(doc);
      const entryId = `${command.id}-${sequence}`;
      undoStack.push({ command, entryId });
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        if (entries[index].status === "undone") {
          entries.splice(index, 1);
        }
      }
      entries.push({
        id: entryId,
        label: command.label,
        message: command.message,
        status: "done",
        sequence
      });
      sequence += 1;
      if (undoStack.length > limit) {
        undoStack.shift();
        entries.shift();
      }
      redoStack.length = 0;
    },
    replaceDoc(nextDoc) {
      doc = cloneProjectDoc(nextDoc);
    },
    undo() {
      const stackEntry = undoStack.pop();
      if (!stackEntry) {
        return;
      }
      const { command, entryId } = stackEntry;
      doc = command.revert(doc);
      redoStack.push(stackEntry);
      const entry = entries.find((item) => item.id === entryId);
      if (entry) {
        entry.status = "undone";
      }
    },
    redo() {
      const stackEntry = redoStack.pop();
      if (!stackEntry) {
        return;
      }
      const { command, entryId } = stackEntry;
      doc = command.apply(doc);
      undoStack.push(stackEntry);
      const entry = entries.find((item) => item.id === entryId);
      if (entry) {
        entry.status = "done";
      }
    }
  };
}

export function addWidget(input: { parentId: string; widget: WidgetNode }): EditorCommand {
  return {
    id: `add-${input.widget.id}`,
    label: `Add ${input.widget.name}`,
    message: { key: "addWidget", widgetType: input.widget.type },
    apply(doc) {
      return updateWidget(doc, input.parentId, (parent) => ({
        ...parent,
        children: [...parent.children, cloneWidget(input.widget)]
      }));
    },
    revert(doc) {
      return removeWidget(doc, input.widget.id);
    }
  };
}

export function moveWidget(input: { widgetId: string; x: number; y: number }): EditorCommand {
  let previous: { x: number; y: number } | null = null;

  return {
    id: `move-${input.widgetId}`,
    label: "Move widget",
    message: { key: "moveWidget" },
    apply(doc) {
      const current = findWidget(doc, input.widgetId);
      previous ??= current ? { x: current.layout.x, y: current.layout.y } : null;
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        layout: {
          ...widget.layout,
          x: input.x,
          y: input.y
        }
      }));
    },
    revert(doc) {
      const priorPosition = previous;
      if (!priorPosition) {
        return doc;
      }
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        layout: {
          ...widget.layout,
          x: priorPosition.x,
          y: priorPosition.y
        }
      }));
    }
  };
}

export function updateWidgetStyle(input: { widgetId: string; style: WidgetStyle }): EditorCommand {
  let previous: WidgetStyle | null = null;

  return {
    id: `style-${input.widgetId}`,
    label: "Update widget style",
    message: { key: "updateWidgetStyle" },
    apply(doc) {
      const current = findWidget(doc, input.widgetId);
      previous ??= current ? { ...current.style } : null;
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        style: normalizeWidgetStyle({
          ...widget.style,
          ...input.style
        }, widget.style, doc.assets)
      }));
    },
    revert(doc) {
      if (!previous) {
        return doc;
      }
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        style: { ...previous }
      }));
    }
  };
}

export function resizeWidget(input: { widgetId: string; width: number; height: number }): EditorCommand {
  let previous: { width: number; height: number } | null = null;

  return {
    id: `resize-${input.widgetId}`,
    label: "Resize widget",
    message: { key: "resizeWidget" },
    apply(doc) {
      const current = findWidget(doc, input.widgetId);
      previous ??= current ? { width: current.layout.width, height: current.layout.height } : null;
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        layout: normalizeLayoutBox({
          ...widget.layout,
          width: input.width,
          height: input.height
        }, widget.layout)
      }));
    },
    revert(doc) {
      const priorSize = previous;
      if (!priorSize) {
        return doc;
      }
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        layout: {
          ...widget.layout,
          width: priorSize.width,
          height: priorSize.height
        }
      }));
    }
  };
}

export function setWidgetLayoutSnapshot(input: {
  widgetId: string;
  before: LayoutBox;
  after: LayoutBox;
  label?: string;
}): EditorCommand {
  return {
    id: `layout-snapshot-${input.widgetId}`,
    label: input.label ?? "Update widget layout",
    message: commandMessageForLabel(input.label ?? "Update widget layout"),
    apply(doc) {
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        layout: normalizeLayoutBox(input.after, widget.layout)
      }));
    },
    revert(doc) {
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        layout: cloneLayout(input.before)
      }));
    }
  };
}

export function updateWidgetLayout(input: { widgetId: string; layout: Partial<LayoutBox> }): EditorCommand {
  let previous: LayoutBox | null = null;

  return {
    id: `layout-${input.widgetId}`,
    label: "Update widget layout",
    message: { key: "updateWidgetLayout" },
    apply(doc) {
      const current = findWidget(doc, input.widgetId);
      previous ??= current ? { ...current.layout } : null;
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        layout: normalizeLayoutBox({
          ...widget.layout,
          ...input.layout
        }, widget.layout)
      }));
    },
    revert(doc) {
      const priorLayout = previous;
      if (!priorLayout) {
        return doc;
      }
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        layout: cloneLayout(priorLayout)
      }));
    }
  };
}

export function deleteWidget(input: { widgetId: string }): EditorCommand {
  let deleted: WidgetLocation | null = null;
  let previousEvents: ProjectDoc["events"] | null = null;

  return {
    id: `delete-${input.widgetId}`,
    label: "Delete widget",
    message: { key: "deleteWidget" },
    apply(doc) {
      deleted ??= findWidgetLocation(doc, input.widgetId);
      if (!deleted) {
        return doc;
      }
      previousEvents ??= doc.events.map((event) => ({ ...event }));
      const deletedWidgetIds = collectWidgetIds(deleted.widget);
      return {
        ...removeWidget(doc, input.widgetId),
        events: doc.events.filter((event) => !deletedWidgetIds.has(event.widgetId))
      };
    },
    revert(doc) {
      if (!deleted) {
        return doc;
      }
      return {
        ...insertWidget(doc, deleted.parentId, deleted.index, deleted.widget),
        events: previousEvents ?? doc.events
      };
    }
  };
}

export function reorderWidget(input: { widgetId: string; direction: -1 | 1 }): EditorCommand {
  let previous: WidgetLocation | null = null;
  let appliedIndex: number | null = null;

  return {
    id: `reorder-${input.widgetId}-${input.direction}`,
    label: "Reorder widget",
    message: { key: "reorderWidget" },
    apply(doc) {
      const current = findWidgetLocation(doc, input.widgetId);
      if (!current) {
        return doc;
      }
      previous ??= current;
      const nextIndex = Math.max(0, Math.min(current.siblingCount - 1, current.index + input.direction));
      appliedIndex = nextIndex;
      if (nextIndex === current.index) {
        return doc;
      }
      return moveWidgetWithinParent(doc, current.parentId, current.index, nextIndex);
    },
    revert(doc) {
      if (!previous || appliedIndex === null || previous.index === appliedIndex) {
        return doc;
      }
      return moveWidgetWithinParent(doc, previous.parentId, appliedIndex, previous.index);
    }
  };
}

export function moveWidgetToParent(input: { widgetId: string; targetParentId: string; targetIndex?: number }): EditorCommand {
  let previous: WidgetLocation | null = null;
  let insertedParentId: string | null = null;
  let insertedIndex: number | null = null;

  return {
    id: `move-parent-${input.widgetId}-${input.targetParentId}`,
    label: "Move widget in layers",
    message: { key: "moveWidgetInLayers" },
    apply(doc) {
      const current = findWidgetLocation(doc, input.widgetId);
      const targetParent = findWidget(doc, input.targetParentId);
      if (!current || !targetParent || targetParent.type !== "container" && targetParent.type !== "screen") {
        return doc;
      }
      if (input.widgetId === input.targetParentId || isWidgetDescendant(current.widget, input.targetParentId)) {
        return doc;
      }
      previous ??= current;
      const targetIndex = Math.max(0, Math.min(input.targetIndex ?? targetParent.children.length, targetParent.children.length));
      const movedWidget = {
        ...cloneWidget(current.widget),
        parentId: input.targetParentId
      };
      const withoutWidget = removeWidget(doc, input.widgetId);
      insertedParentId = input.targetParentId;
      insertedIndex = current.parentId === input.targetParentId && current.index < targetIndex ? targetIndex - 1 : targetIndex;
      return insertWidget(withoutWidget, input.targetParentId, insertedIndex, movedWidget);
    },
    revert(doc) {
      if (!previous || insertedParentId === null || insertedIndex === null) {
        return doc;
      }
      const withoutMovedWidget = removeWidget(doc, input.widgetId);
      return insertWidget(withoutMovedWidget, previous.parentId, previous.index, previous.widget);
    }
  };
}

export function updateWidgetProps(input: {
  widgetId: string;
  props: Record<string, WidgetPropValue>;
}): EditorCommand {
  let previous: Record<string, WidgetPropValue> | null = null;

  return {
    id: `props-${input.widgetId}`,
    label: "Update widget props",
    message: { key: "updateWidgetProps" },
    apply(doc) {
      const current = findWidget(doc, input.widgetId);
      previous ??= current ? { ...current.props } : null;
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        props: normalizeWidgetProps(widget.type, {
          ...widget.props,
          ...input.props
        }, widget.props)
      }));
    },
    revert(doc) {
      if (!previous) {
        return doc;
      }
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        props: { ...previous }
      }));
    }
  };
}

export function updateWidgetMeta(input: {
  widgetId: string;
  name?: string;
  locked?: boolean;
  hidden?: boolean;
}): EditorCommand {
  let previous: Pick<WidgetNode, "name" | "locked" | "hidden"> | null = null;

  return {
    id: `meta-${input.widgetId}`,
    label: "Update widget metadata",
    message: { key: "updateWidgetMetadata" },
    apply(doc) {
      const current = findWidget(doc, input.widgetId);
      previous ??= current
        ? { name: current.name, locked: current.locked, hidden: current.hidden }
        : null;
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        name: input.name ?? widget.name,
        locked: input.locked ?? widget.locked,
        hidden: input.hidden ?? widget.hidden
      }));
    },
    revert(doc) {
      if (!previous) {
        return doc;
      }
      return updateWidget(doc, input.widgetId, (widget) => ({
        ...widget,
        ...previous
      }));
    }
  };
}

export function addEventBindingCommand(input: { binding: EventBinding }): EditorCommand {
  let previousEvents: ProjectDoc["events"] | null = null;

  return {
    id: `add-event-${input.binding.id}`,
    label: "Add event binding",
    message: { key: "addEventBinding" },
    apply(doc) {
      if (!findWidget(doc, input.binding.widgetId)) {
        return doc;
      }
      previousEvents ??= doc.events.map((event) => ({ ...event }));
      return {
        ...doc,
        events: [
          ...doc.events.filter((event) =>
            event.id !== input.binding.id
            && !(event.widgetId === input.binding.widgetId && event.event === input.binding.event)
          ),
          { ...input.binding }
        ]
      };
    },
    revert(doc) {
      return {
        ...doc,
        events: previousEvents ?? doc.events
      };
    }
  };
}

export function removeEventBindingCommand(input: { eventId: string }): EditorCommand {
  let previousEvents: ProjectDoc["events"] | null = null;
  let removed: EventBinding | null = null;

  return {
    id: `remove-event-${input.eventId}`,
    label: "Remove event binding",
    message: { key: "removeEventBinding" },
    apply(doc) {
      previousEvents ??= doc.events.map((event) => ({ ...event }));
      removed ??= doc.events.find((event) => event.id === input.eventId) ?? null;
      if (!removed) {
        return doc;
      }
      return {
        ...doc,
        events: doc.events.filter((event) => event.id !== input.eventId)
      };
    },
    revert(doc) {
      return {
        ...doc,
        events: previousEvents ?? doc.events
      };
    }
  };
}

export function replaceProjectDocCommand(input: {
  id: string;
  label: string;
  message?: EditorCommandMessage;
  update(doc: ProjectDoc): ProjectDoc;
}): EditorCommand {
  let previous: ProjectDoc | null = null;

  return {
    id: input.id,
    label: input.label,
    message: input.message ?? commandMessageForLabel(input.label),
    apply(doc) {
      previous ??= cloneProjectDoc(doc);
      return input.update(cloneProjectDoc(doc));
    },
    revert(doc) {
      return previous ? cloneProjectDoc(previous) : doc;
    }
  };
}

function commandMessageForLabel(label: string): EditorCommandMessage {
  const messages: Record<string, EditorCommandMessage> = {
    "Add event binding": { key: "addEventBinding" },
    "Add screen": { key: "addScreen" },
    "Delete screen": { key: "deleteScreen" },
    "Delete widget": { key: "deleteWidget" },
    "Duplicate screen": { key: "duplicateScreen" },
    "Move widget": { key: "moveWidget" },
    "Move widget in layers": { key: "moveWidgetInLayers" },
    "Register asset": { key: "registerAsset" },
    "Remove event binding": { key: "removeEventBinding" },
    "Rename project": { key: "renameProject" },
    "Rename screen": { key: "renameScreen" },
    "Reorder widget": { key: "reorderWidget" },
    "Resize widget": { key: "resizeWidget" },
    "Update target": { key: "updateTarget" },
    "Update theme": { key: "updateTheme" },
    "Update widget layout": { key: "updateWidgetLayout" },
    "Update widget metadata": { key: "updateWidgetMetadata" },
    "Update widget props": { key: "updateWidgetProps" },
    "Update widget style": { key: "updateWidgetStyle" },
    "Unregister asset": { key: "unregisterAsset" }
  };
  return messages[label] ?? { key: "updateWidgetProps" };
}

export function findWidgetById(doc: ProjectDoc, widgetId: string | null): WidgetNode | null {
  if (!widgetId) {
    return null;
  }
  return findWidget(doc, widgetId);
}

function cloneProjectDoc(doc: ProjectDoc): ProjectDoc {
  return structuredClone(doc);
}

function cloneWidget(widget: WidgetNode): WidgetNode {
  return structuredClone(widget);
}

function cloneLayout(layout: LayoutBox): LayoutBox {
  return {
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    align: layout.align,
    flex: layout.flex ? { ...layout.flex } : undefined
  };
}

function normalizeLayoutBox(layout: LayoutBox, fallback: LayoutBox): LayoutBox {
  return {
    x: normalizeInteger(layout.x, fallback.x),
    y: normalizeInteger(layout.y, fallback.y),
    width: normalizePositiveInteger(layout.width, fallback.width),
    height: normalizePositiveInteger(layout.height, fallback.height),
    align: normalizeLayoutAlign(layout.align, fallback.align),
    flex: layout.flex
      ? {
          direction: normalizeFlexDirection(layout.flex.direction, fallback.flex?.direction ?? "row"),
          gap: normalizeNonNegativeInteger(layout.flex.gap, fallback.flex?.gap ?? 0),
          wrap: normalizeFlexWrap(layout.flex.wrap, fallback.flex?.wrap ?? false)
        }
      : undefined
  };
}

function normalizeInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function normalizePositiveInteger(value: number, fallback: number): number {
  return Math.max(1, normalizeInteger(value, fallback));
}

function normalizeNonNegativeInteger(value: number, fallback: number): number {
  return Math.max(0, normalizeInteger(value, fallback));
}

function normalizeWidgetStyle(style: WidgetStyle, fallback: WidgetStyle, assets: ProjectDoc["assets"] = []): WidgetStyle {
  return {
    bgColor: normalizeStyleColor(style.bgColor, fallback.bgColor),
    textColor: normalizeStyleColor(style.textColor, fallback.textColor),
    borderColor: normalizeStyleColor(style.borderColor, fallback.borderColor),
    font: normalizeStyleFont(style.font, fallback.font, assets),
    align: normalizeStyleTextAlign(style.align, fallback.align),
    blendMode: normalizeBlendMode(style.blendMode, fallback.blendMode),
    opacity: style.opacity === undefined ? undefined : normalizeBoundedInteger(style.opacity, fallback.opacity ?? 100, 0, 100),
    radius: style.radius === undefined ? undefined : normalizeNonNegativeInteger(style.radius, fallback.radius ?? 0),
    lineSpace: style.lineSpace === undefined ? undefined : normalizeNonNegativeInteger(style.lineSpace, fallback.lineSpace ?? 0),
    letterSpace: style.letterSpace === undefined ? undefined : normalizeNonNegativeInteger(style.letterSpace, fallback.letterSpace ?? 0),
    padding: style.padding ? normalizePaddingBox(style.padding, fallback.padding) : undefined
  };
}

function normalizePaddingBox(
  padding: NonNullable<WidgetStyle["padding"]>,
  fallback: WidgetStyle["padding"]
): NonNullable<WidgetStyle["padding"]> {
  return {
    top: normalizeNonNegativeInteger(padding.top, fallback?.top ?? 0),
    right: normalizeNonNegativeInteger(padding.right, fallback?.right ?? 0),
    bottom: normalizeNonNegativeInteger(padding.bottom, fallback?.bottom ?? 0),
    left: normalizeNonNegativeInteger(padding.left, fallback?.left ?? 0)
  };
}

function normalizeBoundedInteger(value: number, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, normalizeInteger(value, fallback)));
}

function normalizeLayoutAlign(value: LayoutBox["align"], fallback: LayoutBox["align"]): LayoutBox["align"] {
  if (value === undefined) {
    return undefined;
  }
  return value === "top-left" || value === "top-right" || value === "center" || value === "bottom-left" || value === "bottom-right"
    ? value
    : fallback;
}

function normalizeFlexDirection(
  value: NonNullable<LayoutBox["flex"]>["direction"],
  fallback: NonNullable<LayoutBox["flex"]>["direction"]
): NonNullable<LayoutBox["flex"]>["direction"] {
  return value === "row" || value === "column" ? value : fallback;
}

function normalizeFlexWrap(value: NonNullable<LayoutBox["flex"]>["wrap"], fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeStyleColor(value: WidgetStyle["bgColor"], fallback: WidgetStyle["bgColor"]): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "string" && isValidStyleColor(value) ? value : fallback;
}

function normalizeStyleFont(value: WidgetStyle["font"], fallback: WidgetStyle["font"], assets: ProjectDoc["assets"]): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "string" && (value === "" || /^lv_font_montserrat_\d+$/.test(value) || assets.some((asset) => asset.id === value && asset.kind === "font"))
    ? value
    : fallback;
}

function normalizeStyleTextAlign(value: WidgetStyle["align"], fallback: WidgetStyle["align"]): WidgetStyle["align"] {
  if (value === undefined) {
    return undefined;
  }
  return value === "left" || value === "center" || value === "right" ? value : fallback;
}

function normalizeBlendMode(value: WidgetStyle["blendMode"], fallback: WidgetStyle["blendMode"]): WidgetStyle["blendMode"] {
  if (value === undefined) {
    return undefined;
  }
  return value === "normal" || value === "additive" || value === "subtractive" || value === "multiply" || value === "replace"
    ? value
    : fallback;
}

function isValidStyleColor(value: string): boolean {
  return value.trim() === "" || /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function normalizeWidgetProps(
  widgetType: WidgetNode["type"],
  props: Record<string, WidgetPropValue>,
  fallback: Record<string, WidgetPropValue>
): Record<string, WidgetPropValue> {
  const next = { ...props };

  if (widgetType === "label" || widgetType === "button" || widgetType === "checkbox" || widgetType === "dropdown") {
    normalizeStringProp(next, fallback, "text");
  }
  if (widgetType === "image") {
    normalizeStringProp(next, fallback, "assetId");
  }
  if (widgetType === "dropdown") {
    normalizeStringProp(next, fallback, "options");
    normalizeNonNegativeIntegerProp(next, fallback, "selected", 0);
    const options = dropdownOptionList(next.options);
    if (options.length > 0) {
      next.selected = Math.min(numberProp(next, "selected", 0), options.length - 1);
    }
  }
  if (widgetType === "checkbox" || widgetType === "switch") {
    normalizeBooleanProp(next, fallback, "checked");
  }
  if (widgetType === "spinner") {
    normalizePositiveIntegerProp(next, fallback, "spinTime", 1000);
    normalizePositiveIntegerProp(next, fallback, "arcLength", 60);
  }
  if (widgetType === "chart") {
    normalizeIntegerProp(next, fallback, "min", 0);
    normalizeIntegerProp(next, fallback, "max", 100);
    normalizeRangeBounds(next);
    normalizePositiveIntegerProp(next, fallback, "pointCount", 8);
    if (Array.isArray(next.values)) {
      next.values = next.values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).map((value) => Math.round(value));
    }
  }
  if (widgetType === "slider" || widgetType === "bar" || widgetType === "arc") {
    normalizeIntegerProp(next, fallback, "min", 0);
    normalizeIntegerProp(next, fallback, "max", 100);
    normalizeRangeBounds(next);
    normalizeNonNegativeIntegerProp(next, fallback, "value", 0);
    const min = numberProp(next, "min", 0);
    const max = numberProp(next, "max", 100);
    next.value = Math.min(max, Math.max(min, numberProp(next, "value", min)));
  }

  return next;
}

function normalizeStringProp(props: Record<string, WidgetPropValue>, fallback: Record<string, WidgetPropValue>, key: string): void {
  if (props[key] === undefined) {
    return;
  }
  if (typeof props[key] !== "string") {
    props[key] = typeof fallback[key] === "string" ? fallback[key] : "";
  }
}

function normalizeBooleanProp(props: Record<string, WidgetPropValue>, fallback: Record<string, WidgetPropValue>, key: string): void {
  if (props[key] === undefined) {
    return;
  }
  if (typeof props[key] !== "boolean") {
    props[key] = typeof fallback[key] === "boolean" ? fallback[key] : false;
  }
}

function normalizeIntegerProp(
  props: Record<string, WidgetPropValue>,
  fallback: Record<string, WidgetPropValue>,
  key: string,
  defaultValue: number
): void {
  if (props[key] === undefined) {
    return;
  }
  props[key] = normalizePropIntegerValue(props[key], fallback[key], defaultValue);
}

function normalizePositiveIntegerProp(
  props: Record<string, WidgetPropValue>,
  fallback: Record<string, WidgetPropValue>,
  key: string,
  defaultValue: number
): void {
  if (props[key] === undefined) {
    return;
  }
  props[key] = Math.max(1, normalizePropIntegerValue(props[key], fallback[key], defaultValue));
}

function normalizeNonNegativeIntegerProp(
  props: Record<string, WidgetPropValue>,
  fallback: Record<string, WidgetPropValue>,
  key: string,
  defaultValue: number
): void {
  if (props[key] === undefined) {
    return;
  }
  props[key] = Math.max(0, normalizePropIntegerValue(props[key], fallback[key], defaultValue));
}

function normalizePropIntegerValue(value: WidgetPropValue, fallback: WidgetPropValue, defaultValue: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof fallback === "number" && Number.isFinite(fallback)) {
    return Math.round(fallback);
  }
  return defaultValue;
}

function normalizeRangeBounds(props: Record<string, WidgetPropValue>): void {
  const min = numberProp(props, "min", 0);
  const max = numberProp(props, "max", 100);
  if (max <= min) {
    props.max = min + 1;
  }
}

function numberProp(props: Record<string, WidgetPropValue>, key: string, fallback: number): number {
  const value = props[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function dropdownOptionList(value: WidgetPropValue | undefined): string[] {
  return typeof value === "string"
    ? value.split(/\r?\n/).map((option) => option.trim()).filter(Boolean)
    : [];
}

function findWidget(doc: ProjectDoc, widgetId: string): WidgetNode | null {
  for (const screen of doc.screens) {
    const found = findWidgetInTree(screen.root, widgetId);
    if (found) {
      return found;
    }
  }
  return null;
}

function findWidgetInTree(widget: WidgetNode, widgetId: string): WidgetNode | null {
  if (widget.id === widgetId) {
    return widget;
  }
  for (const child of widget.children) {
    const found = findWidgetInTree(child, widgetId);
    if (found) {
      return found;
    }
  }
  return null;
}

function isWidgetDescendant(widget: WidgetNode, widgetId: string): boolean {
  return widget.children.some((child) => child.id === widgetId || isWidgetDescendant(child, widgetId));
}

function collectWidgetIds(widget: WidgetNode): Set<string> {
  const ids = new Set<string>([widget.id]);
  for (const child of widget.children) {
    for (const childId of collectWidgetIds(child)) {
      ids.add(childId);
    }
  }
  return ids;
}

function findWidgetLocation(doc: ProjectDoc, widgetId: string): WidgetLocation | null {
  for (const screen of doc.screens) {
    const location = findWidgetLocationInTree(screen.root, widgetId);
    if (location) {
      return location;
    }
  }
  return null;
}

function findWidgetLocationInTree(parent: WidgetNode, widgetId: string): WidgetLocation | null {
  const index = parent.children.findIndex((child) => child.id === widgetId);
  if (index >= 0) {
    return {
      parentId: parent.id,
      index,
      siblingCount: parent.children.length,
      widget: cloneWidget(parent.children[index])
    };
  }
  for (const child of parent.children) {
    const location = findWidgetLocationInTree(child, widgetId);
    if (location) {
      return location;
    }
  }
  return null;
}

function updateWidget(doc: ProjectDoc, widgetId: string, visitor: WidgetVisitor): ProjectDoc {
  return {
    ...doc,
    screens: doc.screens.map((screen) => ({
      ...screen,
      root: updateWidgetInTree(screen.root, widgetId, visitor)
    }))
  };
}

function updateWidgetInTree(widget: WidgetNode, widgetId: string, visitor: WidgetVisitor): WidgetNode {
  const nextWidget =
    widget.id === widgetId
      ? visitor(widget)
      : {
          ...widget
        };

  return {
    ...nextWidget,
    children: nextWidget.children.map((child) => updateWidgetInTree(child, widgetId, visitor))
  };
}

function removeWidget(doc: ProjectDoc, widgetId: string): ProjectDoc {
  return {
    ...doc,
    screens: doc.screens.map((screen) => ({
      ...screen,
      root: removeWidgetFromTree(screen.root, widgetId)
    }))
  };
}

function removeWidgetFromTree(widget: WidgetNode, widgetId: string): WidgetNode {
  return {
    ...widget,
    children: widget.children
      .filter((child) => child.id !== widgetId)
      .map((child) => removeWidgetFromTree(child, widgetId))
  };
}

function insertWidget(doc: ProjectDoc, parentId: string, index: number, widget: WidgetNode): ProjectDoc {
  return updateWidget(doc, parentId, (parent) => {
    const children = [...parent.children];
    children.splice(index, 0, cloneWidget(widget));
    return {
      ...parent,
      children
    };
  });
}

function moveWidgetWithinParent(doc: ProjectDoc, parentId: string, fromIndex: number, toIndex: number): ProjectDoc {
  return updateWidget(doc, parentId, (parent) => {
    const children = [...parent.children];
    const [widget] = children.splice(fromIndex, 1);
    if (!widget) {
      return parent;
    }
    children.splice(toIndex, 0, widget);
    return {
      ...parent,
      children
    };
  });
}
