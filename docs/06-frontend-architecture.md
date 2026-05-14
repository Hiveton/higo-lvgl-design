# 前端架构

## 目标

定义 Vue + TypeScript 在线编辑器的模块拆分、状态管理、command 模型、Canvas 渲染和 API 接入原则。

## 适用范围

适用于 `apps/web` 前端工程，包括编辑器 UI、Canvas、Inspector、Assets、Log、Simulator 和 Preview。

## 非目标

第一版不实现多人协作、不实现插件系统、不实现完整 LVGL 运行时，只通过 `packages/lvgl-wasm-runtime` 进行预览包装。

## 技术选择

- Vue 3 Composition API。
- TypeScript strict mode。
- Vite。
- Pinia。
- Vue Router。
- Vitest。
- Playwright 用于关键 UI 和视觉验收。

## 组件结构

```txt
src/
  app/
    App.vue
    router.ts
  editor/
    EditorShell.vue
    TopToolbar.vue
    SidebarNav.vue
    WidgetPalette.vue
    LayersPanel.vue
    ScreensPanel.vue
    CanvasWorkspace.vue
    WidgetRenderer.vue
    InspectorPanel.vue
    AssetsPanel.vue
    LogPanel.vue
    SimulatorPanel.vue
    StatusBar.vue
  stores/
    project.ts
    selection.ts
    history.ts
    assets.ts
    simulator.ts
    jobs.ts
  commands/
    types.ts
    widgetCommands.ts
    screenCommands.ts
    styleCommands.ts
  api/
    client.ts
    projects.ts
    assets.ts
    jobs.ts
  schema/
    projectDoc.ts
```

## 核心组件职责

- `EditorShell`：组合 IDE 布局，管理面板可见性和全局快捷键。
- `TopToolbar`：项目选择、target、theme、undo/redo、Preview、Build。
- `SidebarNav`：切换左侧功能区域。
- `WidgetPalette`：展示和搜索控件，发起 drag。
- `LayersPanel`：展示 tree、选择、重命名、锁定、隐藏、删除和 reorder。
- `ScreensPanel`：新增、切换、重命名、删除 screen。
- `CanvasWorkspace`：设备画布、标尺、网格、缩放、pan、拖拽和 resize。
- `WidgetRenderer`：将 `WidgetNode` 渲染为编辑态视觉元素。
- `InspectorPanel`：按 widget 类型显示 Style、Events、Layout 字段。
- `AssetsPanel`：上传、展示、过滤和选择资源。
- `LogPanel`：保存、预览、构建和错误日志。
- `SimulatorPanel`：挂载 WASM runtime 预览。
- `StatusBar`：保存状态、LVGL 版本、DPI、鼠标坐标。

## Pinia stores

### useProjectStore

职责：

- 保存当前 `ProjectDoc`。
- 加载项目。
- autosave。
- 应用 command 后更新 dirty 状态。

核心状态：

```ts
type ProjectState = {
  doc: ProjectDoc | null
  activeScreenId: string | null
  saveState: "idle" | "saving" | "saved" | "failed"
  dirty: boolean
}
```

### useSelectionStore

职责：

- 保存当前选中 widget。
- 同步 Canvas、Layers、Inspector。

```ts
type SelectionState = {
  selectedWidgetId: string | null
  hoveredWidgetId: string | null
}
```

### useHistoryStore

职责：

- 管理 undo/redo stack。
- 执行 command。

```ts
type HistoryState = {
  undoStack: EditorCommand[]
  redoStack: EditorCommand[]
  limit: 100
}
```

### useAssetsStore

职责：

- 上传资源。
- 获取资源 URL。
- 删除资源。
- 维护 asset loading 状态。

### useSimulatorStore

职责：

- 加载 runtime。
- 管理预览状态。
- 记录 simulator 错误。

### useJobsStore

职责：

- 创建 Build job 后轮询状态。
- 将 job 状态写入 Log。

## Command 模型

所有编辑动作都通过 command 修改 `ProjectDoc`。

```ts
type EditorCommand = {
  id: string
  label: string
  apply(doc: ProjectDoc): ProjectDoc
  revert(doc: ProjectDoc): ProjectDoc
}
```

原则：

- command 必须是纯函数式更新，不直接 mutation 原对象。
- command 必须包含 revert 逻辑。
- 保存、加载、Preview、Build 不进入 history。
- 连续文本输入可以按 debounce 或 blur 合并为一个 command。

典型 command：

- `AddWidgetCommand`
- `DeleteWidgetCommand`
- `MoveWidgetCommand`
- `ResizeWidgetCommand`
- `UpdateWidgetPropsCommand`
- `UpdateWidgetStyleCommand`
- `ReorderWidgetCommand`
- `RenameWidgetCommand`
- `SetWidgetVisibilityCommand`
- `SetWidgetLockedCommand`

## Canvas 实现方向

Canvas 编辑态使用 HTML/SVG overlay，而不是第一版直接操作真实 LVGL canvas。原因：

- 选区、resize handle、标尺、参考线更容易实现。
- Inspector 变更可直接映射到 DOM 预览。
- WASM simulator 专注运行预览，不承担编辑态交互。

Canvas 坐标规则：

- `ProjectDoc.layout` 使用 LVGL 像素。
- Canvas zoom 只影响显示比例，不改变文档坐标。
- 拖拽结束时把屏幕坐标换算回 LVGL 像素。

## API 接入原则

- API client 统一处理 JWT、错误格式和 JSON 解析。
- 组件不直接调用 fetch；通过 store 或 api module。
- 所有 API DTO 从 schema 包共享或生成。
- 失败错误必须写入 Log，并在相关 UI 上显示可操作状态。

## 快捷键

第一版支持：

- `Cmd/Ctrl+Z` undo。
- `Cmd/Ctrl+Shift+Z` redo。
- `Delete` 删除选中 widget。
- `Cmd/Ctrl+D` 复制选中 widget。
- `Space + drag` pan canvas。

## 验收标准

- 拖拽控件到 Canvas 后，Canvas、Layers、Inspector 同步更新。
- 修改 Inspector 字段后，Canvas 即时更新，undo 能恢复。
- 关闭网络后 autosave 显示失败，本地状态仍保留。
- 点击 Build 能看到 job log 和最终下载状态。
