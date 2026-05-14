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
import { useHistoryStore } from "./history";
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

type WidgetClipboard = {
  widget: WidgetNode;
  events: EventBinding[];
};

type LvglEventName = EventBinding["event"];
const lastProjectKey = "lvgl-editor-last-project-id";

export const useProjectStore = defineStore("project", () => {
  const selectionStore = useSelectionStore();
  const historyStore = useHistoryStore();
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
  const copiedWidget = ref<WidgetClipboard | null>(null);
  const saveState = ref<"saving" | "saved" | "failed">("saved");
  const saveError = ref<string | null>(null);
  const dirty = ref(false);
  const projects = ref<ProjectSummary[]>([]);
  const validationErrors = ref<ReturnType<typeof validateProjectDoc>["errors"]>([]);

  const project = computed(() => currentDoc.value);
  const activeScreen = computed(() => getActiveScreen(project.value, activeScreenId.value));
  const selectedWidget = computed(() => findWidgetById(project.value, selectedWidgetId.value));
  const canDuplicateSelectedWidget = computed(() => canDuplicateWidget(selectedWidget.value));
  const historyEntries = computed(() => historyStore.entries);

  function execute(command: EditorCommand): void {
    historyStore.execute(command);
    currentDoc.value = historyStore.doc ?? currentDoc.value;
    dirty.value = true;
    normalizeActiveRefs();
  }

  function addWidgetFromCatalog(type: Exclude<WidgetType, "screen">, point: DropPoint, options: AddWidgetOptions = {}): void {
    const catalogItem = widgetCatalog.find((item) => item.type === type);
    if (!catalogItem || !activeScreen.value) {
      return;
    }

    const selected = selectedWidget.value;
    const explicitParent = options.parentId ? findWidgetById(project.value, options.parentId) : null;
    const parentId = explicitParent?.type === "container" && !explicitParent.locked
      ? explicitParent.id
      : selected?.type === "container" && !selected.locked
        ? selected.id
        : activeScreen.value.root.id;
    const name = nextWidgetName(project.value, catalogItem.label);
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

    execute(addWidget({ parentId, widget }));
    selectedWidgetId.value = widget.id;
  }

  function selectWidget(widgetId: string | null): void {
    selectedWidgetId.value = widgetId;
  }

  function copySelectedWidget(): void {
    const widget = selectedWidget.value;
    if (!widget || widget.type === "screen") {
      return;
    }
    const copiedWidgetIds = collectWidgetIds(widget);
    copiedWidget.value = {
      widget: cloneWidgetTree(widget),
      events: project.value.events
        .filter((event) => copiedWidgetIds.has(event.widgetId))
        .map((event) => ({ ...event }))
    };
  }

  function pasteCopiedWidget(): void {
    const clipboard = copiedWidget.value;
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
      update(doc) {
        return {
          ...doc,
          assets: doc.assets.filter((asset) => asset.id !== assetId),
          screens: doc.screens.map((screen) => ({
            ...screen,
            root: clearAssetReference(screen.root, assetId)
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
    execute(updateWidgetProps({ widgetId: widget.id, props: { assetId } }));
  }

  function moveSelectedWidget(point: DropPoint): void {
    const widget = selectedWidget.value;
    if (!widget || widget.locked) {
      return;
    }
    execute(moveWidget({ widgetId: widget.id, x: point.x, y: point.y }));
  }

  function resizeSelectedWidget(size: SizeInput): void {
    const widget = selectedWidget.value;
    if (!widget || widget.locked) {
      return;
    }
    execute(resizeWidget({ widgetId: widget.id, width: size.width, height: size.height }));
  }

  function updateSelectedLayout(layout: Partial<DropPoint & SizeInput>): void {
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

  function updateSelectedLayoutMeta(layout: Pick<WidgetNode["layout"], "align" | "flex">): void {
    const widget = selectedWidget.value;
    if (!widget || widget.locked) {
      return;
    }
    execute(updateWidgetLayout({ widgetId: widget.id, layout }));
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

  function updateTarget(targetPatch: Partial<TargetConfig>): void {
    execute(replaceProjectDocCommand({
      id: "update-target",
      label: "Update target",
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
      update(doc) {
        return {
          ...doc,
          name: nextName
        };
      }
    }));
  }

  function renameScreen(screenId: string, name: string): void {
    const nextName = name.trim();
    if (!nextName) {
      return;
    }
    execute(replaceProjectDocCommand({
      id: `rename-screen-${screenId}`,
      label: "Rename screen",
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

  function updateTheme(theme: ProjectDoc["theme"]): void {
    execute(replaceProjectDocCommand({
      id: "update-theme",
      label: "Update theme",
      update(doc) {
        return {
          ...doc,
          theme
        };
      }
    }));
  }

  function addScreen(): void {
    const index = nextScreenIndex(project.value);
    const id = createEditorUUID();
    const rootId = createEditorUUID();
    execute(replaceProjectDocCommand({
      id: `add-screen-${id}`,
      label: "Add screen",
      update(doc) {
        return {
          ...doc,
          screens: [
            ...doc.screens,
            {
              id,
              name: `Screen_${index}`,
              root: {
                id: rootId,
                type: "screen",
                name: `Screen_${index}`,
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
    selectedWidgetId.value = null;
  }

  function duplicateScreen(screenId: string): void {
    const source = project.value.screens.find((screen) => screen.id === screenId);
    if (!source) {
      return;
    }
    const nextIndex = project.value.screens.length + 1;
    const nextScreenId = createEditorUUID();
    const names = collectExistingWidgetNames(project.value);
    const sequence = { count: 1 };
    const root = cloneWidgetForPaste(source.root, null, names, sequence);
    const nextName = nextCopyName(new Set(project.value.screens.map((screen) => screen.name)), source.name);
    const nextRoot = {
      ...root,
      id: createEditorUUID(),
      type: "screen" as const,
      name: nextName,
      parentId: null,
      layout: {
        ...source.root.layout,
        width: project.value.target.width,
        height: project.value.target.height
      }
    };
    normalizeChildParentIds(nextRoot);
    const clonedWidgetIds = mapClonedWidgetIds(source.root, nextRoot);
    const clonedEvents = project.value.events
      .filter((event) => clonedWidgetIds.has(event.widgetId))
      .map((event) => ({
        ...event,
        id: createEditorUUID(),
        widgetId: clonedWidgetIds.get(event.widgetId) ?? event.widgetId
      }));
    execute(replaceProjectDocCommand({
      id: `duplicate-screen-${screenId}`,
      label: "Duplicate screen",
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
    selectedWidgetId.value = nextRoot.children[0]?.id ?? null;
  }

  function switchScreen(screenId: string): void {
    if (!project.value.screens.some((screen) => screen.id === screenId)) {
      return;
    }
    activeScreenId.value = screenId;
    selectedWidgetId.value = project.value.screens.find((screen) => screen.id === screenId)?.root.children[0]?.id ?? null;
  }

  function deleteScreen(screenId: string): void {
    if (project.value.screens.length <= 1) {
      return;
    }
    const deletingActiveScreen = activeScreenId.value === screenId;
    const deletedScreenIndex = project.value.screens.findIndex((screen) => screen.id === screenId);
    const deletedScreen = project.value.screens.find((screen) => screen.id === screenId);
    const nextScreens = project.value.screens.filter((screen) => screen.id !== screenId);
    if (nextScreens.length === project.value.screens.length) {
      return;
    }
    const deletedWidgetIds = deletedScreen ? collectWidgetIds(deletedScreen.root) : new Set<string>();
    execute(replaceProjectDocCommand({
      id: `delete-screen-${screenId}`,
      label: "Delete screen",
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
      selectedWidgetId.value = adjacentScreen.root.children[0]?.id ?? null;
    }
  }

  function addEventBinding(event: LvglEventName, handlerName: string, targetWidgetId?: string): void {
    const widget = targetWidgetId ? findWidgetById(project.value, targetWidgetId) : selectedWidget.value;
    if (!widget || widget.locked) {
      return;
    }
    const normalizedHandlerName = normalizeHandlerName(handlerName);
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
      dirty.value = true;
    }
    normalizeActiveRefs();
  }

  function redo(): void {
    const previousDoc = currentDoc.value;
    historyStore.redo();
    currentDoc.value = historyStore.doc ?? currentDoc.value;
    if (currentDoc.value !== previousDoc) {
      dirty.value = true;
    }
    normalizeActiveRefs();
  }

  async function saveProject(): Promise<boolean> {
    const validation = validateProjectDoc(project.value);
    validationErrors.value = validation.errors;
    if (!validation.valid) {
      saveState.value = "failed";
      saveError.value = validation.errors[0]?.message ?? "Project validation failed";
      return false;
    }
    if (shouldKeepProjectLocal()) {
      saveState.value = "saved";
      saveError.value = null;
      dirty.value = false;
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
      syncProjectUpdatedAt(saved.updatedAt);
      saveState.value = "saved";
      saveError.value = null;
      dirty.value = false;
      return true;
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        return createAndSaveCurrentProject();
      }
      saveState.value = "failed";
      saveError.value = caught instanceof Error ? caught.message : "Project save failed";
      return false;
    }
  }

  async function createAndSaveCurrentProject(): Promise<boolean> {
    try {
      const previousActiveScreenId = activeScreenId.value;
      const previousSelectedWidgetId = selectedWidgetId.value;
      const created = await createProject(project.value.name, project.value.target);
      const now = created.updatedAt ?? new Date().toISOString();
      const nextDoc: ProjectDoc = {
        ...cloneDoc(project.value),
        id: created.id,
        updatedAt: now
      };
      const saved = await saveProjectDoc(created.id, nextDoc);
      nextDoc.updatedAt = saved.updatedAt;
      loadProjectDoc(nextDoc);
      if (previousActiveScreenId && nextDoc.screens.some((screen) => screen.id === previousActiveScreenId)) {
        activeScreenId.value = previousActiveScreenId;
      }
      if (previousSelectedWidgetId && findWidgetById(nextDoc, previousSelectedWidgetId)) {
        selectedWidgetId.value = previousSelectedWidgetId;
      }
      normalizeActiveRefs();
      rememberLastProject(created.id);
      saveState.value = "saved";
      saveError.value = null;
      dirty.value = false;
      return true;
    } catch (caught) {
      saveState.value = "failed";
      saveError.value = caught instanceof Error ? caught.message : "Project save failed";
      return false;
    }
  }

  async function loadProjects(): Promise<void> {
    projects.value = await listProjects();
  }

  async function createCloudProject(name: string): Promise<void> {
    const created = await createProject(name);
    loadProjectDoc(created.doc as ProjectDoc);
    rememberLastProject(created.id);
  }

  async function openProject(projectId: string): Promise<void> {
    const loaded = await getProject(projectId);
    loadProjectDoc(loaded.doc as ProjectDoc);
    rememberLastProject(projectId);
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
    currentDoc.value = cloneDoc(doc);
    historyStore.initialize(cloneDoc(doc));
    activeScreenId.value = doc.screens[0]?.id ?? null;
    selectedWidgetId.value = doc.screens[0]?.root.children[0]?.id ?? null;
    saveState.value = "saved";
    saveError.value = null;
    dirty.value = false;
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
    selectedWidget,
    canDuplicateSelectedWidget,
    selectedWidgetId,
    saveState,
    saveError,
    dirty,
    validationErrors,
    historyEntries,
    addWidgetFromCatalog,
    selectWidget,
    copySelectedWidget,
    pasteCopiedWidget,
    duplicateSelectedWidget,
    updateSelectedText,
    updateSelectedProps,
    updateSelectedStyle,
    registerAsset,
    unregisterAsset,
    bindSelectedImageAsset,
    moveSelectedWidget,
    resizeSelectedWidget,
    updateSelectedLayout,
    updateSelectedLayoutMeta,
    deleteSelectedWidget,
    toggleWidgetLocked,
    toggleWidgetHidden,
    renameWidget,
    reorderWidgetLayer,
    moveWidgetLayerDrop,
    updateTarget,
    renameProject,
    renameScreen,
    updateTheme,
    addScreen,
    duplicateScreen,
    switchScreen,
    deleteScreen,
    addEventBinding,
    removeEventBinding,
    saveProject,
    loadProjects,
    createCloudProject,
    openProject,
    restoreLastProject,
    undo,
    redo
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
      style: { radius: 50, bgColor: "transparent", borderColor: "#2fbf9b", textColor: "#FFFFFF" },
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
      style: { radius: 50, bgColor: "transparent", borderColor: "#ef5d5d", textColor: "#FFFFFF" },
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
      style: { radius: 50, bgColor: "transparent", borderColor: "#f2b84b", textColor: "#FFFFFF" },
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

function rememberLastProject(projectId: string): void {
  const storage = getBrowserStorage();
  if (typeof storage?.setItem === "function") {
    storage.setItem(lastProjectKey, projectId);
  }
}

function readLastProjectId(): string | null {
  const storage = getBrowserStorage();
  if (typeof storage?.getItem !== "function") {
    return null;
  }
  return storage.getItem(lastProjectKey);
}

function forgetLastProject(): void {
  const storage = getBrowserStorage();
  if (typeof storage?.removeItem === "function") {
    storage.removeItem(lastProjectKey);
  }
}

function cloneWidgetTree(widget: WidgetNode): WidgetNode {
  return JSON.parse(JSON.stringify(widget)) as WidgetNode;
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

function collectExistingWidgetNames(doc: ProjectDoc): Set<string> {
  const names = new Set<string>();
  for (const screen of doc.screens) {
    collectNames(screen.root, names);
  }
  return names;
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

function nextWidgetName(doc: ProjectDoc, label: string): string {
  const existing = collectExistingWidgetNames(doc);
  let index = 1;
  let candidate = `${label}_${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${label}_${index}`;
  }
  return candidate;
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

function collectNames(widget: WidgetNode, names: Set<string>): void {
  names.add(widget.name);
  for (const child of widget.children) {
    collectNames(child, names);
  }
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

function findChildIndex(doc: ProjectDoc, parentId: string, childId: string): number | undefined {
  const parent = findWidgetById(doc, parentId);
  const index = parent?.children.findIndex((child) => child.id === childId) ?? -1;
  return index >= 0 ? index : undefined;
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

function clearAssetReference(widget: WidgetNode, assetId: string): WidgetNode {
  const nextProps = { ...widget.props };
  if (nextProps.assetId === assetId) {
    delete nextProps.assetId;
  }
  const nextStyle = { ...widget.style };
  if (nextStyle.font === assetId) {
    delete nextStyle.font;
  }
  return {
    ...widget,
    props: nextProps,
    style: nextStyle,
    children: widget.children.map((child) => clearAssetReference(child, assetId))
  };
}
