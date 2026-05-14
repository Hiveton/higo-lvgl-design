# 功能规格

## 目标

定义 LVGL 在线编辑器第一版的完整功能行为，让每个模块都能映射到开发任务和测试用例。

## 适用范围

适用于前端编辑器、Go API、资源管理、WASM 预览、LVGL C 导出和测试验收。

## 非目标

第一版不包含多人实时协作、评论、权限组、硬件烧录、完整云编译、模板市场和插件系统。

## 项目管理

用户可以创建、打开、修改和保存云项目。

行为：

- 创建项目时填写项目名，默认 target 为 `ESP32-S3 480x480 DPI 240 LVGL 8.3 colorDepth 16`。
- 打开项目时加载最新 `ProjectDoc`。
- 修改项目名后进入 autosave。
- 修改 target 的 width、height、dpi、colorDepth 后更新 Canvas 和 Simulator 尺寸。
- Autosave debounce 为 `800ms`。
- 保存状态显示 `Saving...`、`All changes saved`、`Save failed`。
- 保存失败时保留本地 dirty 状态，用户继续编辑不会丢失改动。

验收：

- 新建项目后必须存在一个 `Screen_1`。
- 刷新页面后能从后端恢复最新文档。
- autosave 失败不会清空本地修改。

## Widgets

Widgets palette 用于创建 LVGL 控件。

分类：

- Basic：Button、Label、Image。
- Containers：Container。
- Charts：Chart。
- Indicators：Arc、Bar、Spinner。
- Inputs：Switch、Slider、Checkbox、Dropdown。
- Advanced：Line。

行为：

- 支持通过搜索过滤控件。
- 支持拖拽控件到 Canvas。
- 控件拖入后根据落点创建节点。
- 新节点自动命名，例如 `Button_1`、`Label_1`。
- 新节点自动选中。
- 新节点插入当前 screen root 或命中的 container。

默认尺寸：

```txt
button    120x44
label     120x32
image      96x96
arc       120x120
bar       160x20
line      120x2
switch     64x32
slider    160x24
checkbox  120x32
dropdown  160x40
spinner    64x64
chart     200x120
container 200x160
```

## Layers

Layers tree 展示当前 screen 的 widget hierarchy。

行为：

- 点击 layer 选中对应 widget。
- Canvas 选中 widget 时，Layers 同步高亮。
- 支持重命名。
- 支持锁定、解锁。
- 支持隐藏、显示。
- 支持删除。
- 支持拖拽调整 sibling 顺序。
- 支持将 widget 拖入 container。
- 删除 container 时默认删除其 children。

约束：

- screen root 不可删除。
- locked widget 不可移动、不可 resize、不可编辑属性，但可以在 Layers 中解锁。
- hidden widget 不渲染在 Canvas，但可在 Layers 中选中。

## Screens

Screens 管理项目内的多个画面。

行为：

- 支持新增 screen。
- 支持重命名 screen。
- 支持删除 screen。
- 支持切换当前编辑 screen。
- 新增 screen 默认包含空 root。

约束：

- 项目至少保留一个 screen。
- 删除当前 screen 后，自动切换到列表中的相邻 screen。
- screen name 建议唯一，重名时 UI 提示但不阻断保存。

## Canvas

Canvas 是可视化编辑核心。

行为：

- 显示设备画布、标尺、网格和当前 zoom。
- 支持单选 widget。
- 支持拖拽移动。
- 支持 resize handle 调整尺寸。
- 支持 pan 和 zoom。
- 支持吸附到网格。
- 支持对象对齐参考线。
- 支持 Delete 删除当前选中 widget。
- 支持复制粘贴当前 widget，复制后名称追加数字后缀。

约束：

- screen root 不显示 resize handle。
- locked widget 不响应拖拽和 resize。
- hidden widget 不在 Canvas 上命中。
- widget 可移动到画布外，但 Inspector 应显示真实坐标。

## Inspector

Inspector 编辑当前选中 widget 的属性。

### Style tab

字段：

- Text：适用于 label、button、checkbox、dropdown。
- Font：内置 Montserrat 字体和上传字体。
- Color：文本颜色。
- Background：背景色。
- Opacity：`0-100`。
- Align：left、center、right。
- Line Space。
- Letter Space。
- Padding：top、right、bottom、left。
- Radius。

行为：

- 字段变更立即派发 command。
- 不适用于当前 widget 的字段隐藏或 disabled。
- 校验失败时显示 inline error，不写入 `ProjectDoc`。

### Events tab

字段：

- Event type。
- Handler name。
- Target widget。

支持事件：

- `LV_EVENT_CLICKED`
- `LV_EVENT_VALUE_CHANGED`
- `LV_EVENT_READY`
- `LV_EVENT_CANCEL`

行为：

- 添加事件绑定写入 `ProjectDoc.events`。
- 删除事件绑定从 `ProjectDoc.events` 删除。
- Handler name 自动规范为 C 函数名。

### Layout tab

字段：

- x、y、width、height。
- align。
- flex direction。
- gap。
- wrap。

行为：

- x、y、width、height 修改后更新 Canvas。
- flex 字段只在 screen 和 container 上启用。

## Assets

Assets 管理项目资源。

行为：

- 支持上传 PNG/JPG 图片和 TTF/OTF/WOFF/WOFF2 字体资源。
- 图片资源展示缩略图、文件名、尺寸、大小。
- 字体资源展示文件名、字体类型和大小，不生成图片缩略图。
- 支持删除未被引用的资源。
- image widget 可选择 image asset。
- 文本类 widget 的 Font 可选择内置 Montserrat 字体或已上传 font asset。
- 资源上传成功后写入 `ProjectDoc.assets`。

约束：

- 删除被引用资源前必须提示。
- 不支持的 MIME type 返回明确错误。
- font asset 第一版只登记元数据；LVGL 字体二进制转换不在第一版在线编辑器内执行。
- 单文件大小限制第一版建议 `5MB`。

## Simulator

Simulator 提供运行预览。

行为：

- 右下角显示小预览。
- 点击 Preview 进入完整设备预览模式。
- ProjectDoc 修改后 debounce `500ms` 刷新模拟器。
- 模拟器加载、渲染、错误写入 Log。

约束：

- Preview 失败不阻止继续编辑。
- Build 不依赖 Simulator 成功。
- 缺失资源时显示占位并写入 Log。

## Build

Build 触发 LVGL C 代码导出。

行为：

- 点击 `Build` 调用 `POST /api/projects/:projectId/export/c`。
- 后端创建项目版本快照。
- 后端生成 zip。
- 前端轮询 `GET /api/jobs/:jobId`。
- Log 显示 queued、running、succeeded、failed。
- 成功后提供 zip 下载链接。

验收：

- zip 包含 `ui.c`、`ui.h`、`assets.c`、`assets.h`、`README.md`。
- Log 至少显示 Build started、Generating code、Build completed successfully。

## Undo/Redo

所有编辑动作进入 history。

支持 command：

- add widget。
- delete widget。
- move widget。
- resize widget。
- update props。
- update style。
- reorder layer。
- rename widget。
- lock/hide widget。
- add/delete screen。

约束：

- history 上限 100 条。
- 新 command 执行后清空 redo stack。
- 保存项目不进入 undo history。
