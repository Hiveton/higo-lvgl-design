import {
  createDefaultProjectDoc,
  getActiveScreen,
  validateProjectDoc,
  widgetCatalog,
  type EventBinding,
  type ProjectDoc,
  type AssetRef,
  type TargetConfig,
  type WidgetNode,
  type WidgetPropValue,
  type WidgetStyle,
  type WidgetType
} from "@hiveton-lvgl/schema";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  addWidget,
  addEventBindingCommand,
  deleteWidget,
  findWidgetById,
  moveWidget,
  moveWidgetToParent,
  removeEventBindingCommand,
  replaceProjectDocCommand,
  reorderWidget,
  resizeWidget,
  setWidgetLayoutSnapshot,
  updateWidgetLayout,
  updateWidgetMeta,
  updateWidgetProps,
  updateWidgetStyle,
  type EditorCommand
} from "../commands/editorCommands";
import {
  ApiError,
  createProject,
  getProject,
  listProjects,
  saveProjectDoc,
  type ProjectSummary
} from "../api/projects";
import { getAuthToken, getBrowserStorage } from "../api/auth";
import { localizedErrorForCode, localizeError } from "../i18n/errors";
import { useHistoryStore } from "./history";
import { useLocaleStore } from "./locale";
import { useSelectionStore } from "./selection";

type LvglEventName = EventBinding["event"];
const supportedLvglEvents: readonly LvglEventName[] = [
  "LV_EVENT_CLICKED",
  "LV_EVENT_VALUE_CHANGED",
  "LV_EVENT_READY",
  "LV_EVENT_CANCEL"
];
const lastProjectKey = "lvgl-editor-last-project-id";

export const useProjectStore = defineStore("project", () => {
  const selectionStore = useSelectionStore();
  const historyStore = useHistoryStore();
  const localeStore = useLocaleStore();
  const initialDoc = createWatchDemoProjectDoc();
  historyStore.initialize(initialDoc);
  const currentDoc = ref<ProjectDoc>(historyStore.doc ?? initialDoc);
  const activeScreenId = ref("screen-1");
  const selectedWidgetId = computed({
    get: () => selectionStore.selectedWidgetId,
    set: (widgetId: string | null) => {
      selectionStore.selectWidget(widgetId);
    }
  });
  const saveState = ref<"saving" | "saved" | "failed">("saved");
  const saveError = ref<string | null>(null);
  const dirty = ref(false);
  const editRevision = ref(0);
  const projects = ref<ProjectSummary[]>([]);
  const validationErrors = ref<ReturnType<typeof validateProjectDoc>["errors"]>([]);
  let loadProjectsRequestId = 0;
  let activeProjectRequestId = 0;

  const project = computed(() => currentDoc.value);
  const activeScreen = computed(() => getActiveScreen(project.value, activeScreenId.value));
  const selectedWidget = computed(() => findWidgetById(project.value, selectedWidgetId.value));
  const historyEntries = computed(() => historyStore.entries);
  const canUndo = computed(() => historyStore.entries.some((entry) => entry.status === "done"));
  const canRedo = computed(() => historyStore.entries.some((entry) => entry.status === "undone"));

  function invalidProjectDocError(validation: ReturnType<typeof validateProjectDoc>): ApiError {
    const summary = localizedErrorForCode("INVALID_PROJECT_DOC", localeStore.locale);
    const detail = validation.errors[0]?.message;
    const message = localeStore.locale === "en-US" && detail ? `${summary}: ${detail}` : summary;
    return new ApiError(message, 422, "INVALID_PROJECT_DOC", detail);
  }

  function applyInvalidProjectDocState(validation: ReturnType<typeof validateProjectDoc>): ApiError {
    const error = invalidProjectDocError(validation);
    validationErrors.value = validation.errors;
    saveState.value = "failed";
    saveError.value = error.message;
    return error;
  }

  function execute(command: EditorCommand): void {
    historyStore.execute(command);
    currentDoc.value = historyStore.doc ?? currentDoc.value;
    markDirty();
    normalizeActiveRefs();
  }

  function executeCommand(command: EditorCommand): void {
    execute(command);
  }

  function markDirty(): void {
    editRevision.value += 1;
    dirty.value = true;
  }

  function markSaveCompleted(saveRevision: number): void {
    saveState.value = "saved";
    saveError.value = null;
    dirty.value = editRevision.value !== saveRevision;
  }

  function selectWidget(widgetId: string | null): void {
    selectedWidgetId.value = widgetId;
  }

  function copySelectedWidget(): void {
    const widget = selectedWidget.value;
    if (!widget || widget.type === "screen" || widget.locked) {
      return;
    }
    const copiedWidgetIds = collectWidgetIds(widget);
    const copiedData = {
      widget: cloneWidgetTree(widget),
      events: project.value.events
        .filter((event) => copiedWidgetIds.has(event.widgetId))
        .map((event) => ({ ...event }))
    };
    // Store in clipboard store
    const { useClipboardStore } = require("./clipboard");
    const clipboardStore = useClipboardStore();
    clipboardStore.copy(copiedData.widget, copiedData.events);
  }

  function pasteCopiedWidget(): void {
    const { useClipboardStore } = require("./clipboard");
    const clipboardStore = useClipboardStore();
    const clipboard = clipboardStore.paste();
    const screen = activeScreen.value;
    if (!clipboard || !screen) {
      return;
    }
    const source = clipboard.widget;
    const selected = selectedWidget.value;
    const parentId = selected?.type === "container" && !selected.locked
      ? selected.id
      : source.parentId ?? screen.root.id;
    const parent = findWidgetById(project.value, parentId);
    const targetParentId = parent && !parent.locked ? parentId : screen.root.id;
    const names = collectExistingWidgetNames(project.value);
    const nextWidget = cloneWidgetForPaste(source, targetParentId, names, { count: 1 });
    const clonedEvents = clonedEventBindingsFor(source, nextWidget, clipboard.events);

    execute(addWidgetWithEventsCommand(targetParentId, nextWidget, clonedEvents));
    selectedWidgetId.value = nextWidget.id;
  }

  function canDuplicateWidget(source: WidgetNode | null | undefined): boolean {
    const screen = activeScreen.value;
    if (!source || source.type === "screen" || !screen || source.locked) {
      return false;
    }
    const parentId = source.parentId ?? screen.root.id;
    const parent = findWidgetById(project.value, parentId);
    return parent?.locked !== true;
  }

  function canCopyWidget(source: WidgetNode | null | undefined): boolean {
    return Boolean(source && source.type !== "screen" && !source.locked);
  }

  function canPasteWidget(): boolean {
    const { useClipboardStore } = require("./clipboard");
    const clipboardStore = useClipboardStore();
    const clipboard = clipboardStore.paste();
    const screen = activeScreen.value;
    if (!clipboard || !screen) {
      return false;
    }
    const selected = selectedWidget.value;
    const parentId = selected?.type === "container" && !selected.locked
      ? selected.id
      : clipboard.widget.parentId ?? screen.root.id;
    const parent = findWidgetById(project.value, parentId);
    return parent?.locked !== true;
  }

  function canDeleteWidget(source: WidgetNode | null | undefined): boolean {
    return Boolean(source && source.type !== "screen" && !source.locked);
  }

  function duplicateSelectedWidget(): void {
    const source = selectedWidget.value;
    const screen = activeScreen.value;
    if (!source || !screen || !canDuplicateWidget(source)) {
      return;
    }
    const parentId = source.parentId ?? screen.root.id;
    const names = collectExistingWidgetNames(project.value);
    const nextWidget = cloneWidgetForPaste(source, parentId, names, { count: 1 });
    const clonedEvents = clonedEventBindingsFor(source, nextWidget);

    execute(addWidgetWithEventsCommand(parentId, nextWidget, clonedEvents));
    selectedWidgetId.value = nextWidget.id;
  }

  function clonedEventBindingsFor(source: WidgetNode, clone: WidgetNode, events = project.value.events): EventBinding[] {
    const clonedWidgetIds = mapClonedWidgetIds(source, clone);
    return events
      .filter((event) => clonedWidgetIds.has(event.widgetId))
      .map((event) => ({
        ...event,
        id: createEditorUUID(),
        widgetId: clonedWidgetIds.get(event.widgetId) ?? event.widgetId
      }));
  }

  function addWidgetWithEventsCommand(parentId: string, widget: WidgetNode, events: EventBinding[]): EditorCommand {
    return replaceProjectDocCommand({
      id: `add-${widget.id}`,
      label: `Add ${widget.name}`,
      message: { key: "addWidget", widgetType: widget.type },
      update(doc) {
        return {
          ...doc,
          screens: doc.screens.map((screen) => ({
            ...screen,
            root: appendWidgetToParent(screen.root, parentId, widget)
          })),
          events: [...doc.events, ...events]
        };
      }
    });
  }

  function addWidgetFromCatalog(type: Exclude<WidgetType, "screen">, point: { x: number; y: number }, options: { parentId?: string } = {}): void {
    const { useWidgetStore } = require("./widget");
    const widgetStore = useWidgetStore();
    widgetStore.addWidgetFromCatalog(type, point, options);
  }

  function deleteSelectedWidget(): void {
    const widget = selectedWidget.value;
    if (!widget || widget.type === "screen" || widget.locked) {
      return;
    }
    const deletedWidgetId = widget.id;
    execute(deleteWidget({ widgetId: deletedWidgetId }));
    if (!findWidgetById(project.value, deletedWidgetId)) {
      selectedWidgetId.value = null;
    }
  }

  function moveSelectedWidget(point: { x: number; y: number }): void {
    const widget = selectedWidget.value;
    if (!widget || widget.locked) {
      return;
    }
    execute(moveWidget({ widgetId: widget.id, x: point.x, y: point.y }));
  }

  function resizeSelectedWidget(size: { width: number; height: number }): void {
    const widget = selectedWidget.value;
    if (!widget || widget.locked) {
      return;
    }
    execute(resizeWidget({ widgetId: widget.id, width: size.width, height: size.height }));
  }

  function addScreen(name?: string): void {
    const { useScreenStore } = require("./screen");
    const screenStore = useScreenStore();
    screenStore.addScreen(name);
  }

  function deleteScreen(screenId: string): void {
    const { useScreenStore } = require("./screen");
    const screenStore = useScreenStore();
    screenStore.deleteScreen(screenId);
  }

  function switchScreen(screenId: string): void {
    const { useScreenStore } = require("./screen");
    const screenStore = useScreenStore();
    screenStore.switchScreen(screenId);
  }

  function duplicateScreen(screenId: string): void {
    const { useScreenStore } = require("./screen");
    const screenStore = useScreenStore();
    screenStore.duplicateScreen(screenId);
  }

  function renameScreen(screenId: string, name: string): void {
    const { useScreenStore } = require("./screen");
    const screenStore = useScreenStore();
    screenStore.renameScreen(screenId, name);
  }

  function updateSelectedText(text: string): void {
    const widget = selectedWidget.value;
    if (!widget || widget.locked) {
      return;
    }
    execute(updateWidgetProps({ widgetId: widget.id, props: { text } }));
  }

  function updateSelectedProps(props: Record<string, WidgetPropValue>): void {
    const widget = selectedWidget.value;
    if (!widget || widget.locked) {
      return;
    }
    execute(updateWidgetProps({ widgetId: widget.id, props }));
  }

  function updateSelectedStyle(style: WidgetNode["style"]): void {
    const widget = selectedWidget.value;
    if (!widget || widget.locked) {
      return;
    }
    execute(updateWidgetStyle({ widgetId: widget.id, style }));
  }

  function registerAsset(asset: AssetRef): void {
    execute(replaceProjectDocCommand({
      id: `register-asset-${asset.id}`,
      label: "Register asset",
      message: { key: "registerAsset" },
      update(doc) {
        return {
          ...doc,
          assets: [...doc.assets.filter((item) => item.id !== asset.id), asset]
        };
      }
    }));
  }

  function unregisterAsset(assetId: string): void {
    execute(replaceProjectDocCommand({
      id: `unregister-asset-${assetId}`,
      label: "Unregister asset",
      message: { key: "unregisterAsset" },
      update(doc) {
        return {
          ...doc,
          assets: doc.assets.filter((asset) => asset.id !== assetId),
          styles: doc.styles.map((style) => ({
            ...style,
            style: clearStyleAssetReference(style.style, assetId)
          })),
          screens: doc.screens.map((screen) => ({
            ...screen,
            root: clearAssetReference(screen.root, assetId)
          }))
        };
      }
    }));
  }

  function replaceAssetReference(oldAssetId: string, asset: AssetRef): void {
    execute(replaceProjectDocCommand({
      id: `replace-asset-${oldAssetId}-${asset.id}`,
      label: "Replace asset",
      message: { key: "registerAsset" },
      update(doc) {
        return {
          ...doc,
          assets: doc.assets.map((item) => (item.id === oldAssetId ? asset : item)),
          styles: doc.styles.map((style) => ({
            ...style,
            style: replaceStyleAssetReference(style.style, oldAssetId, asset.id)
          })),
          screens: doc.screens.map((screen) => ({
            ...screen,
            root: replaceWidgetAssetReference(screen.root, oldAssetId, asset.id)
          }))
        };
      }
    }));
  }

  function bindSelectedImageAsset(assetId: string): void {
    const widget = selectedWidget.value;
    if (!widget || widget.type !== "image" || widget.locked) {
      return;
    }
    const asset = project.value.assets.find((item) => item.id === assetId);
    if (asset?.kind !== "image") {
      return;
    }
    execute(updateWidgetProps({ widgetId: widget.id, props: { assetId } }));
  }

  function toggleWidgetLocked(widgetId: string): void {
    const widget = findWidgetById(project.value, widgetId);
    if (!widget || widget.type === "screen") {
      return;
    }
    execute(updateWidgetMeta({ widgetId, locked: !widget.locked }));
  }

  function toggleWidgetHidden(widgetId: string): void {
    const widget = findWidgetById(project.value, widgetId);
    if (!widget || widget.type === "screen") {
      return;
    }
    execute(updateWidgetMeta({ widgetId, hidden: !widget.hidden }));
  }

  function renameWidget(widgetId: string, name: string): void {
    const nextName = name.trim();
    const widget = findWidgetById(project.value, widgetId);
    if (!widget || widget.type === "screen" || !nextName || widget.locked) {
      return;
    }
    execute(updateWidgetMeta({ widgetId, name: uniqueWidgetNameForRename(project.value, widgetId, nextName) }));
  }

  function reorderWidgetLayer(widgetId: string, direction: -1 | 1): void {
    const widget = findWidgetById(project.value, widgetId);
    if (!widget || widget.type === "screen" || widget.locked) {
      return;
    }
    const parent = widget.parentId ? findWidgetById(project.value, widget.parentId) : null;
    const siblingIndex = parent?.children.findIndex((child) => child.id === widgetId) ?? -1;
    if (!parent || siblingIndex < 0 || siblingIndex + direction < 0 || siblingIndex + direction >= parent.children.length) {
      return;
    }
    execute(reorderWidget({ widgetId, direction }));
  }

  function moveWidgetLayerDrop(widgetId: string, targetWidgetId: string): void {
    if (widgetId === targetWidgetId) {
      return;
    }
    const widget = findWidgetById(project.value, widgetId);
    const target = findWidgetById(project.value, targetWidgetId);
    if (!widget || !target || widget.type === "screen" || widget.locked) {
      return;
    }
    if (target.type === "container") {
      if (target.locked) {
        return;
      }
      execute(moveWidgetToParent({ widgetId, targetParentId: target.id }));
      return;
    }
    if (!target.parentId) {
      return;
    }
    const targetParent = findWidgetById(project.value, target.parentId);
    if (targetParent?.locked) {
      return;
    }
    const targetIndex = findChildIndex(project.value, target.parentId, target.id);
    execute(moveWidgetToParent({ widgetId, targetParentId: target.parentId, targetIndex }));
  }

  function updateSelectedLayout(layout: Partial<{ x: number; y: number; width: number; height: number }>): void {
    const widget = selectedWidget.value;
    if (!widget || widget.locked) {
      return;
    }
    if (layout.x !== undefined || layout.y !== undefined) {
      execute(
        moveWidget({
          widgetId: widget.id,
          x: layout.x ?? widget.layout.x,
          y: layout.y ?? widget.layout.y
        })
      );
    }
    const latestWidget = selectedWidget.value;
    if (!latestWidget) {
      return;
    }
    if (layout.width !== undefined || layout.height !== undefined) {
      execute(
        resizeWidget({
          widgetId: latestWidget.id,
          width: layout.width ?? latestWidget.layout.width,
          height: layout.height ?? latestWidget.layout.height
        })
      );
    }
  }

  function updateSelectedLayoutDraft(layout: Partial<WidgetNode["layout"]>): void {
    const widget = selectedWidget.value;
    if (!widget || widget.locked) {
      return;
    }
    currentDoc.value = updateWidgetLayout({ widgetId: widget.id, layout }).apply(currentDoc.value);
    markDirty();
    normalizeActiveRefs();
  }

  function commitSelectedLayoutSnapshot(before: WidgetNode["layout"], after: WidgetNode["layout"], label?: string): void {
    const widget = selectedWidget.value;
    if (!widget || widget.locked || sameLayout(before, after)) {
      return;
    }
    execute(setWidgetLayoutSnapshot({ widgetId: widget.id, before, after, label }));
  }

  function updateSelectedLayoutMeta(layout: Pick<WidgetNode["layout"], "align" | "flex">): void {
    const widget = selectedWidget.value;
    if (!widget || widget.locked) {
      return;
    }
    execute(updateWidgetLayout({ widgetId: widget.id, layout }));
  }

  function updateTarget(targetPatch: Partial<TargetConfig>): void {
    if (!targetPatchIsValid(targetPatch)) {
      return;
    }
    execute(replaceProjectDocCommand({
      id: "update-target",
      label: "Update target",
      message: { key: "updateTarget" },
      update(doc) {
        const nextTarget = {
          ...doc.target,
          ...targetPatch
        };
        return {
          ...doc,
          target: nextTarget,
          screens: doc.screens.map((screen) => ({
            ...screen,
            root: {
              ...screen.root,
              layout: {
                ...screen.root.layout,
                width: nextTarget.width,
                height: nextTarget.height
              }
            }
          }))
        };
      }
    }));
  }

  function renameProject(name: string): void {
    const nextName = name.trim();
    if (!nextName) {
      return;
    }
    execute(replaceProjectDocCommand({
      id: "rename-project",
      label: "Rename project",
      message: { key: "renameProject" },
      update(doc) {
        return {
          ...doc,
          name: nextName
        };
      }
    }));
  }

  function updateTheme(theme: ProjectDoc["theme"]): void {
    if (theme !== "dark" && theme !== "light") {
      return;
    }
    execute(replaceProjectDocCommand({
      id: "update-theme",
      label: "Update theme",
      message: { key: "updateTheme" },
      update(doc) {
        return {
          ...doc,
          theme
        };
      }
    }));
  }

  function addProjectStyle(): void {
    const styleId = createEditorUUID();
    const styleName = uniqueProjectStyleName(project.value, `Style_${project.value.styles.length + 1}`);
    execute(replaceProjectDocCommand({
      id: `add-project-style-${styleId}`,
      label: "Update project styles",
      message: { key: "updateProjectStyles" },
      update(doc) {
        return {
          ...doc,
          styles: [
            ...doc.styles,
            {
              id: styleId,
              name: styleName,
              style: defaultProjectStyle()
            }
          ]
        };
      }
    }));
  }

  function renameProjectStyle(styleId: string | undefined, name: string): void {
    const nextName = name.trim();
    if (!styleId || !nextName || !project.value.styles.some((style) => style.id === styleId)) {
      return;
    }
    execute(replaceProjectDocCommand({
      id: `rename-project-style-${styleId}`,
      label: "Update project styles",
      message: { key: "updateProjectStyles" },
      update(doc) {
        return {
          ...doc,
          styles: doc.styles.map((style) =>
            style.id === styleId
              ? { ...style, name: uniqueProjectStyleName(doc, nextName, styleId) }
              : style
          )
        };
      }
    }));
  }

  function updateProjectStyleText(styleId: string | undefined, field: "bgColor" | "textColor" | "borderColor" | "font" | "align" | "blendMode", value: string): void {
    if (!projectStyleTextFieldIsSupported(field) || typeof value !== "string") {
      return;
    }
    const nextValue = value.trim();
    if (!projectStyleTextValueIsValid(field, nextValue, project.value.assets)) {
      return;
    }
    updateProjectStyle(styleId, { [field]: nextValue });
  }

  function updateProjectStyleNumber(styleId: string | undefined, field: "opacity" | "radius" | "letterSpace" | "lineSpace", value: string): void {
    if (!projectStyleNumberFieldIsSupported(field)) {
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const rounded = Math.round(parsed);
    if ((field === "opacity" && (rounded < 0 || rounded > 100)) || (field !== "opacity" && rounded < 0)) {
      return;
    }
    updateProjectStyle(styleId, { [field]: rounded });
  }

  function updateProjectStylePaddingSide(styleId: string | undefined, side: "top" | "right" | "bottom" | "left", value: string): void {
    if (!projectStylePaddingSideIsSupported(side)) {
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const rounded = Math.round(parsed);
    if (rounded < 0) {
      return;
    }
    const currentStyle = project.value.styles.find((style) => style.id === styleId)?.style;
    const currentPadding = currentStyle?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
    updateProjectStyle(styleId, {
      padding: {
        ...currentPadding,
        [side]: rounded
      }
    });
  }

  function deleteProjectStyle(styleId: string | undefined): void {
    if (!styleId || !project.value.styles.some((style) => style.id === styleId)) {
      return;
    }
    execute(replaceProjectDocCommand({
      id: `delete-project-style-${styleId}`,
      label: "Update project styles",
      message: { key: "updateProjectStyles" },
      update(doc) {
        return {
          ...doc,
          styles: doc.styles.filter((style) => style.id !== styleId)
        };
      }
    }));
  }

  function applyProjectStyleToSelectedWidget(styleId: string | undefined): void {
    const widget = selectedWidget.value;
    const style = project.value.styles.find((item) => item.id === styleId);
    if (!widget || widget.locked || !style) {
      return;
    }
    execute(updateWidgetStyle({ widgetId: widget.id, style: cloneWidgetStyle(style.style) }));
  }

  function updateProjectStyle(styleId: string | undefined, patch: WidgetStyle): void {
    if (!styleId || !project.value.styles.some((style) => style.id === styleId)) {
      return;
    }
    execute(replaceProjectDocCommand({
      id: `update-project-style-${styleId}`,
      label: "Update project styles",
      message: { key: "updateProjectStyles" },
      update(doc) {
        return {
          ...doc,
          styles: doc.styles.map((style) =>
            style.id === styleId
              ? {
                  ...style,
                  style: {
                    ...style.style,
                    ...patch
                  }
                }
              : style
          )
        };
      }
    }));
  }

  function addEventBinding(event: LvglEventName, handlerName: string, targetWidgetId?: string): void {
    const widget = targetWidgetId ? findWidgetById(project.value, targetWidgetId) : selectedWidget.value;
    if (!widget || widget.locked || !isSupportedLvglEvent(event)) {
      return;
    }
    const normalizedHandlerName = normalizeUniqueHandlerName(handlerName, project.value, widget.id, event);
    if (!normalizedHandlerName) {
      return;
    }
    const binding: EventBinding = {
      id: createEditorUUID(),
      widgetId: widget.id,
      event,
      handlerName: normalizedHandlerName
    };
    execute(addEventBindingCommand({ binding }));
  }

  function removeEventBinding(eventId: string): void {
    const binding = project.value.events.find((event) => event.id === eventId);
    const widget = binding ? findWidgetById(project.value, binding.widgetId) : null;
    if (widget?.locked) {
      return;
    }
    execute(removeEventBindingCommand({ eventId }));
  }

  function undo(): void {
    const previousDoc = currentDoc.value;
    historyStore.undo();
    currentDoc.value = historyStore.doc ?? currentDoc.value;
    if (currentDoc.value !== previousDoc) {
      markDirty();
    }
    normalizeActiveRefs();
  }

  function redo(): void {
    const previousDoc = currentDoc.value;
    historyStore.redo();
    currentDoc.value = historyStore.doc ?? currentDoc.value;
    if (currentDoc.value !== previousDoc) {
      markDirty();
    }
    normalizeActiveRefs();
  }

  async function saveProject(): Promise<boolean> {
    const saveRevision = editRevision.value;
    const savedProjectId = project.value.id;
    const activeRequestIdAtSave = activeProjectRequestId;
    const validation = validateProjectDoc(project.value);
    validationErrors.value = validation.errors;
    if (!validation.valid) {
      applyInvalidProjectDocState(validation);
      return false;
    }
    if (shouldKeepProjectLocal()) {
      markSaveCompleted(saveRevision);
      return true;
    }
    if (shouldCreateCloudProjectBeforeSave()) {
      saveState.value = "saving";
      saveError.value = null;
      return createAndSaveCurrentProject();
    }
    saveState.value = "saving";
    saveError.value = null;
    try {
      const saved = await saveProjectDoc(project.value.id, project.value);
      if (project.value.id !== savedProjectId || activeRequestIdAtSave !== activeProjectRequestId) {
        return false;
      }
      syncProjectUpdatedAt(saved.updatedAt);
      markSaveCompleted(saveRevision);
      return true;
    } catch (caught) {
      if (project.value.id !== savedProjectId || activeRequestIdAtSave !== activeProjectRequestId) {
        return false;
      }
      if (caught instanceof ApiError && caught.status === 404) {
        return createAndSaveCurrentProject();
      }
      saveState.value = "failed";
      saveError.value = localizeError(caught, localeStore.locale, "PROJECT_SAVE_FAILED");
      return false;
    }
  }

  async function createAndSaveCurrentProject(): Promise<boolean> {
    const requestId = ++activeProjectRequestId;
    try {
      const previousActiveScreenId = activeScreenId.value;
      const previousSelectedWidgetId = selectedWidgetId.value;
      const created = await createProject(project.value.name, project.value.target);
      if (requestId !== activeProjectRequestId) {
        return false;
      }
      const now = created.updatedAt ?? new Date().toISOString();
      const savedRevision = editRevision.value;
      const nextDoc = retargetProjectDoc(cloneDoc(project.value), created.id, now);
      const saved = await saveProjectDoc(created.id, nextDoc);
      if (requestId !== activeProjectRequestId) {
        return false;
      }
      const hasUnsavedEdits = editRevision.value !== savedRevision;
      const latestDoc = retargetProjectDoc(hasUnsavedEdits ? cloneDoc(project.value) : nextDoc, created.id, saved.updatedAt);
      loadProjectDoc(latestDoc);
      if (previousActiveScreenId && latestDoc.screens.some((screen) => screen.id === previousActiveScreenId)) {
        activeScreenId.value = previousActiveScreenId;
      }
      if (previousSelectedWidgetId && findWidgetById(latestDoc, previousSelectedWidgetId)) {
        selectedWidgetId.value = previousSelectedWidgetId;
      }
      normalizeActiveRefs();
      rememberLastProject(created.id);
      if (hasUnsavedEdits) {
        markDirty();
        saveState.value = "saved";
        saveError.value = null;
      } else {
        markSaveCompleted(editRevision.value);
      }
      return true;
    } catch (caught) {
      saveState.value = "failed";
      saveError.value = localizeError(caught, localeStore.locale, "PROJECT_SAVE_FAILED");
      return false;
    }
  }

  async function loadProjects(): Promise<void> {
    const requestId = ++loadProjectsRequestId;
    try {
      const loadedProjects = await listProjects();
      if (requestId !== loadProjectsRequestId) {
        return;
      }
      projects.value = loadedProjects;
    } catch (caught) {
      if (requestId === loadProjectsRequestId) {
        projects.value = [];
      }
      throw caught;
    }
  }

  async function createCloudProject(name: string): Promise<void> {
    const requestId = ++activeProjectRequestId;
    const created = await createProject(name);
    if (requestId !== activeProjectRequestId) {
      return;
    }
    loadProjectDoc(created.doc as ProjectDoc);
    rememberLastProject(created.id);
  }

  async function openProject(projectId: string): Promise<boolean> {
    const requestId = ++activeProjectRequestId;
    const loaded = await getProject(projectId);
    if (requestId !== activeProjectRequestId) {
      return false;
    }
    loadProjectDoc(loaded.doc as ProjectDoc);
    rememberLastProject(projectId);
    return true;
  }

  async function restoreLastProject(): Promise<void> {
    const projectId = readLastProjectId();
    if (!projectId) {
      return;
    }
    try {
      await openProject(projectId);
    } catch {
      forgetLastProject();
    }
  }

  function loadProjectDoc(doc: ProjectDoc): void {
    const validation = validateProjectDoc(doc);
    if (!validation.valid) {
      throw applyInvalidProjectDocState(validation);
    }
    currentDoc.value = cloneDoc(doc);
    historyStore.initialize(cloneDoc(doc));
    activeScreenId.value = doc.screens[0]?.id ?? null;
    selectedWidgetId.value = doc.screens[0]?.root.children[0]?.id ?? null;
    saveState.value = "saved";
    saveError.value = null;
    validationErrors.value = [];
    dirty.value = false;
    editRevision.value = 0;
  }

  function syncProjectUpdatedAt(updatedAt: string): void {
    if (!updatedAt || project.value.updatedAt === updatedAt) {
      return;
    }
    const nextDoc = {
      ...cloneDoc(project.value),
      updatedAt
    };
    currentDoc.value = nextDoc;
    historyStore.replaceDoc(nextDoc);
  }

  function shouldCreateCloudProjectBeforeSave(): boolean {
    return project.value.id === "project-watch-demo" && Boolean(getAuthToken());
  }

  function shouldKeepProjectLocal(): boolean {
    return project.value.id === "project-watch-demo" && !getAuthToken();
  }

  function normalizeActiveRefs(): void {
    if (!project.value.screens.some((screen) => screen.id === activeScreenId.value)) {
      activeScreenId.value = project.value.screens[0]?.id ?? null;
    }
    selectionStore.reconcileSelection(project.value);
  }

  return {
    project,
    projects,
    activeScreen,
    activeScreenId,
    selectedWidget,
    canRedo,
    canUndo,
    selectedWidgetId,
    saveState,
    saveError,
    dirty,
    validationErrors,
    historyEntries,
    selectWidget,
    copySelectedWidget,
    pasteCopiedWidget,
    duplicateSelectedWidget,
    addWidgetFromCatalog,
    deleteSelectedWidget,
    moveSelectedWidget,
    resizeSelectedWidget,
    updateSelectedText,
    updateSelectedProps,
    updateSelectedStyle,
    updateSelectedLayout,
    updateSelectedLayoutDraft,
    commitSelectedLayoutSnapshot,
    updateSelectedLayoutMeta,
    registerAsset,
    unregisterAsset,
    replaceAssetReference,
    bindSelectedImageAsset,
    toggleWidgetLocked,
    toggleWidgetHidden,
    renameWidget,
    reorderWidgetLayer,
    moveWidgetLayerDrop,
    updateTarget,
    renameProject,
    renameScreen,
    updateTheme,
    addProjectStyle,
    renameProjectStyle,
    updateProjectStyleText,
    updateProjectStyleNumber,
    updateProjectStylePaddingSide,
    deleteProjectStyle,
    applyProjectStyleToSelectedWidget,
    addScreen,
    deleteScreen,
    switchScreen,
    duplicateScreen,
    addEventBinding,
    removeEventBinding,
    saveProject,
    loadProjects,
    createCloudProject,
    openProject,
    restoreLastProject,
    undo,
    redo,
    executeCommand
  };
});

function createWatchDemoProjectDoc(): ProjectDoc {
  const doc = createDefaultProjectDoc({
    id: "project-watch-demo",
    name: "My Watch UI",
    updatedAt: "2026-05-08T00:00:00Z"
  });

  doc.screens[0].root.children = [
    {
      id: "time-label",
      type: "label",
      name: "Time_Label",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 150, y: 40, width: 180, height: 56 },
      props: { text: "10:09" },
      style: { textColor: "#FFFFFF", font: "lv_font_montserrat_48", align: "center" },
      locked: false,
      hidden: false
    },
    {
      id: "date-label",
      type: "label",
      name: "Date_Label",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 168, y: 105, width: 150, height: 24 },
      props: { text: "Wed, May 15" },
      style: { textColor: "#C7CDD2" },
      locked: false,
      hidden: false
    },
    {
      id: "start-button",
      type: "button",
      name: "Start_Button",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 58, y: 410, width: 128, height: 44 },
      props: { text: "Start" },
      style: { radius: 22 },
      locked: false,
      hidden: false
    },
    {
      id: "steps-metric",
      type: "button",
      name: "Steps_Metric",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 70, y: 160, width: 100, height: 100 },
      props: { text: "7,842\nSteps" },
      style: { radius: 50, bgColor: "", borderColor: "#2fbf9b", textColor: "#FFFFFF" },
      locked: false,
      hidden: false
    },
    {
      id: "bpm-metric",
      type: "button",
      name: "BPM_Metric",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 310, y: 160, width: 100, height: 100 },
      props: { text: "102\nBPM" },
      style: { radius: 50, bgColor: "", borderColor: "#ef5d5d", textColor: "#FFFFFF" },
      locked: false,
      hidden: false
    },
    {
      id: "battery-metric",
      type: "button",
      name: "Battery_Metric",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 190, y: 255, width: 100, height: 100 },
      props: { text: "86%\nBattery" },
      style: { radius: 50, bgColor: "", borderColor: "#f2b84b", textColor: "#FFFFFF" },
      locked: false,
      hidden: false
    },
    {
      id: "settings-button",
      type: "button",
      name: "Settings_Button",
      parentId: "root-screen-1",
      children: [],
      layout: { x: 294, y: 410, width: 128, height: 44 },
      props: { text: "Settings" },
      style: { radius: 22 },
      locked: false,
      hidden: false
    }
  ];

  return doc;
}

function cloneDoc(doc: ProjectDoc): ProjectDoc {
  return JSON.parse(JSON.stringify(doc)) as ProjectDoc;
}

function retargetProjectDoc(doc: ProjectDoc, projectId: string, updatedAt: string): ProjectDoc {
  return {
    ...doc,
    id: projectId,
    updatedAt,
    assets: doc.assets.map((asset) => ({
      ...asset,
      projectId
    }))
  };
}

function targetPatchIsValid(targetPatch: Partial<TargetConfig>): boolean {
  if (targetPatch.lvglVersion !== undefined && targetPatch.lvglVersion !== "8.3") {
    return false;
  }
  if (targetPatch.deviceName !== undefined && (typeof targetPatch.deviceName !== "string" || targetPatch.deviceName.trim() === "")) {
    return false;
  }
  if (targetPatch.width !== undefined && !isPositiveInteger(targetPatch.width)) {
    return false;
  }
  if (targetPatch.height !== undefined && !isPositiveInteger(targetPatch.height)) {
    return false;
  }
  if (targetPatch.dpi !== undefined && !isPositiveInteger(targetPatch.dpi)) {
    return false;
  }
  if (targetPatch.colorDepth !== undefined && targetPatch.colorDepth !== 16 && targetPatch.colorDepth !== 32) {
    return false;
  }
  return true;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function rememberLastProject(projectId: string): void {
  const storage = getBrowserStorage();
  if (typeof storage?.setItem === "function") {
    try {
      storage.setItem(lastProjectKey, projectId);
    } catch {
      // The active project can still be used when last-project persistence fails.
    }
  }
}

function readLastProjectId(): string | null {
  const storage = getBrowserStorage();
  if (typeof storage?.getItem !== "function") {
    return null;
  }
  try {
    return storage.getItem(lastProjectKey);
  } catch {
    return null;
  }
}

function forgetLastProject(): void {
  const storage = getBrowserStorage();
  if (typeof storage?.removeItem === "function") {
    try {
      storage.removeItem(lastProjectKey);
    } catch {
      // Nothing else is required when browser storage cannot be updated.
    }
  }
}

function defaultProjectStyle(): WidgetStyle {
  return {
    bgColor: "#2fbf9b",
    textColor: "#FFFFFF",
    radius: 8,
    opacity: 100
  };
}

function projectStyleTextValueIsValid(
  field: "bgColor" | "textColor" | "borderColor" | "font" | "align" | "blendMode",
  value: string,
  assets: AssetRef[]
): boolean {
  if (field === "bgColor" || field === "textColor" || field === "borderColor") {
    return value === "" || /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
  }
  if (field === "font") {
    return value === "" || /^lv_font_montserrat_\d+$/.test(value) || assets.some((asset) => asset.id === value && asset.kind === "font");
  }
  if (field === "align") {
    return value === "left" || value === "center" || value === "right";
  }
  return value === "normal" || value === "additive" || value === "subtractive" || value === "multiply" || value === "replace";
}

function projectStyleTextFieldIsSupported(field: string): field is "bgColor" | "textColor" | "borderColor" | "font" | "align" | "blendMode" {
  return field === "bgColor"
    || field === "textColor"
    || field === "borderColor"
    || field === "font"
    || field === "align"
    || field === "blendMode";
}

function projectStyleNumberFieldIsSupported(field: string): field is "opacity" | "radius" | "letterSpace" | "lineSpace" {
  return field === "opacity" || field === "radius" || field === "letterSpace" || field === "lineSpace";
}

function projectStylePaddingSideIsSupported(side: string): side is "top" | "right" | "bottom" | "left" {
  return side === "top" || side === "right" || side === "bottom" || side === "left";
}

function uniqueProjectStyleName(doc: ProjectDoc, preferredName: string, currentStyleId?: string): string {
  const names = new Set(
    doc.styles
      .filter((style) => style.id !== currentStyleId)
      .map((style) => style.name)
  );
  if (!names.has(preferredName)) {
    return preferredName;
  }
  let index = 1;
  let candidate = `${preferredName}_${index}`;
  while (names.has(candidate)) {
    index += 1;
    candidate = `${preferredName}_${index}`;
  }
  return candidate;
}

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

function uniqueWidgetNameForRename(doc: ProjectDoc, widgetId: string, name: string): string {
  const existing = collectExistingWidgetNames(doc);
  const current = findWidgetById(doc, widgetId);
  if (current) {
    existing.delete(current.name);
  }
  if (!existing.has(name)) {
    return name;
  }
  let index = 1;
  let candidate = `${name}_${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${name}_${index}`;
  }
  return candidate;
}

function collectExistingWidgetNames(doc: ProjectDoc): Set<string> {
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

function findChildIndex(doc: ProjectDoc, parentId: string, childId: string): number | undefined {
  const parent = findWidgetById(doc, parentId);
  const index = parent?.children.findIndex((child) => child.id === childId) ?? -1;
  return index >= 0 ? index : undefined;
}

function cloneWidgetTree(widget: WidgetNode): WidgetNode {
  return JSON.parse(JSON.stringify(widget)) as WidgetNode;
}

function cloneWidgetStyle(style: WidgetStyle): WidgetStyle {
  return JSON.parse(JSON.stringify(style)) as WidgetStyle;
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

function appendWidgetToParent(widget: WidgetNode, parentId: string, child: WidgetNode): WidgetNode {
  if (widget.id === parentId) {
    return {
      ...widget,
      children: [...widget.children, child]
    };
  }
  return {
    ...widget,
    children: widget.children.map((item) => appendWidgetToParent(item, parentId, child))
  };
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

function normalizeHandlerName(handlerName: string): string {
  const normalized = handlerName
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) {
    return "";
  }
  if (/^[0-9]/.test(normalized)) {
    return `handler_${normalized}`;
  }
  return normalized;
}

function normalizeUniqueHandlerName(handlerName: string, doc: ProjectDoc, widgetId: string, event: LvglEventName): string {
  const normalized = normalizeHandlerName(handlerName);
  if (!normalized) {
    return "";
  }
  const candidates = [normalized, `handler_${normalized}`, `${normalized}_handler`];
  for (let index = 2; index <= 99; index += 1) {
    candidates.push(`${normalized}_handler_${index}`);
  }
  return candidates.find((candidate) => eventBindingCandidateIsValid(doc, widgetId, event, candidate)) ?? normalized;
}

function eventBindingCandidateIsValid(doc: ProjectDoc, widgetId: string, event: LvglEventName, handlerName: string): boolean {
  const candidateDoc: ProjectDoc = {
    ...doc,
    events: [
      ...doc.events.filter((binding) => !(binding.widgetId === widgetId && binding.event === event)),
      {
        id: uniqueCandidateEventId(doc),
        widgetId,
        event,
        handlerName
      }
    ]
  };
  return validateProjectDoc(candidateDoc).valid;
}

function isSupportedLvglEvent(event: string): event is LvglEventName {
  return supportedLvglEvents.includes(event as LvglEventName);
}

function uniqueCandidateEventId(doc: ProjectDoc): string {
  const eventIds = new Set(doc.events.map((event) => event.id));
  let candidateId = "candidate-event";
  let index = 1;
  while (eventIds.has(candidateId)) {
    index += 1;
    candidateId = `candidate-event-${index}`;
  }
  return candidateId;
}

function clearAssetReference(widget: WidgetNode, assetId: string): WidgetNode {
  const nextProps = { ...widget.props };
  if (nextProps.assetId === assetId) {
    delete nextProps.assetId;
  }
  return {
    ...widget,
    props: nextProps,
    style: clearStyleAssetReference(widget.style, assetId),
    children: widget.children.map((child) => clearAssetReference(child, assetId))
  };
}

function clearStyleAssetReference(style: WidgetStyle, assetId: string): WidgetStyle {
  const nextStyle = { ...style };
  if (nextStyle.font === assetId) {
    delete nextStyle.font;
  }
  return nextStyle;
}

function replaceWidgetAssetReference(widget: WidgetNode, oldAssetId: string, nextAssetId: string): WidgetNode {
  const nextProps = { ...widget.props };
  if (nextProps.assetId === oldAssetId) {
    nextProps.assetId = nextAssetId;
  }
  return {
    ...widget,
    props: nextProps,
    style: replaceStyleAssetReference(widget.style, oldAssetId, nextAssetId),
    children: widget.children.map((child) => replaceWidgetAssetReference(child, oldAssetId, nextAssetId))
  };
}

function replaceStyleAssetReference(style: WidgetStyle, oldAssetId: string, nextAssetId: string): WidgetStyle {
  if (style.font !== oldAssetId) {
    return style;
  }
  return {
    ...style,
    font: nextAssetId
  };
}

function sameLayout(left: WidgetNode["layout"], right: WidgetNode["layout"]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
