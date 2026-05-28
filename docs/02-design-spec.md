# 设计规范

## 目标

定义 LVGL 在线编辑器的视觉、布局、交互、尺寸、颜色和文案规则，指导前端还原当前设计图对应的深色 IDE。

## 适用范围

适用于 `apps/web` 的编辑器主界面、组件状态、Inspector 表单、Canvas 编辑态、Simulator 和 Build/Preview 相关 UI。

## 非目标

本文档不定义商业官网、落地页、品牌视觉系统或营销插图。第一屏必须是可用编辑器，不是产品宣传页。

## 视觉基调

界面应是深色、专业、高密度的开发工具。整体风格接近工程 IDE：面板边界清晰、控件紧凑、状态反馈明确。避免大面积装饰图形、渐变背景、营销卡片和无功能意义的视觉元素。

## 总体布局

编辑器使用桌面优先布局，默认目标视口为 `1440x900`，最小可用宽度为 `1280px`。

```txt
TopToolbar
SidebarNav | LeftPanels | CanvasWorkspace | InspectorPanel
           | BottomAssetsAndLogs          | SimulatorPanel
StatusBar
```

### 顶部工具栏

必须包含：

- 菜单入口。
- 产品名：`LVGL Online Editor`。
- 项目选择器，例如 `My Watch UI`。
- Target 选择器，例如 `ESP32-S3 (480x480)`。
- Theme 选择器。
- undo、redo。
- 选择、网格、吸附、对齐相关工具按钮。
- Simulator 开关。
- 设备尺寸选择器，例如 `480x480`。
- `Preview` 按钮。
- `Build` 按钮。
- 云保存、帮助、用户头像等状态入口。

`Preview` 使用蓝色强调，`Build` 使用绿色强调。工具按钮优先使用图标，并通过 tooltip 说明含义。

### 左侧竖向导航

固定窄栏，包含：

- `Widgets`
- `Layers`
- `Screens`
- `Code`
- `Settings`

当前选中项使用蓝色边线或背景强调。导航图标必须清晰，不使用仅文本的圆角按钮替代常见图标。

### 左侧主面板

分为 Widgets、Layers 和 Screens 信息区。

Widgets palette：

- 搜索框：`Search widgets...`
- 分类：`Basic`、`Containers`、`Charts`、`Indicators`、`Inputs`、`Advanced`
- 基础控件卡片：Button、Label、Image、Arc、Bar、Line、Switch、Slider、Checkbox、Dropdown、Spinner、QR Code

Layers tree：

- 显示当前 screen 的 widget hierarchy。
- 每个节点显示类型图标、名称、锁定状态、隐藏状态。
- 当前选中节点使用蓝色背景。

Screens list：

- 显示 `Screen_1`、`Screen_2` 等。
- 支持新增 screen 和切换当前 screen。

### 中央 Canvas

Canvas 是主工作区，必须占据最大视觉面积。

- 背景使用浅色或中性画布区，与深色 IDE 面板形成对比。
- 显示横向和纵向标尺。
- 默认显示 `480 x 480` 设备画布。
- 选中 widget 显示蓝色边框、控制点、名称标签。
- 支持缩放下拉：`25% / 50% / 75% / 100% / 150% / 200%`。
- 支持画布大小下拉，例如 `480 x 480`。
- 支持全屏、适配视图、对齐工具入口。

### 右侧 Inspector

Inspector 固定在右侧，默认宽度 `320px`。

Tabs：

- `Style`
- `Events`
- `Layout`

Style tab 首屏字段：

- Selector
- State
- Text
- Font
- Color
- Align
- Line Space
- Letter Space
- Opacity
- Blend Mode
- Padding
- Radius

所有字段必须和当前选中 widget 类型相关。无选中对象时显示空态，而不是保留上一对象数据。

### 底部区域

底部高度建议 `220px`，可被用户收起或拖拽调整。

Assets：

- `Import` 按钮。
- `Filter assets...` 搜索框。
- 图片资源缩略图、文件名、尺寸。
- 字体文件夹或字体资源入口。

Log：

- 时间戳。
- 级别图标。
- 构建、保存、预览、错误日志。

Timeline：

- 第一版可作为占位 tab，仅显示 screen 或事件时间线基础信息。

Simulator：

- 右下角设备预览区域。
- 显示当前 screen 在设备外壳或纯 canvas 中的运行效果。
- 提供截图、刷新、亮度或背景、全屏按钮。

### 状态栏

状态栏固定底部，包含：

- Autosave 状态：`All changes saved`、`Saving...`、`Save failed`。
- 云项目状态：`Project saved to cloud`。
- LVGL 版本，例如 `LVGL v8.3.11`。
- DPI，例如 `DPI: 240`。
- 鼠标坐标，例如 `X: 186 Y: 72`。

## 颜色规范

首版使用以下语义颜色，具体 token 可在实现中微调：

```txt
background.app      #0f1419
background.panel    #151c22
background.panelAlt #1b242c
background.canvas   #f3f5f7
border.default      #26323c
text.primary        #f2f6f8
text.secondary      #a9b4bd
accent.primary      #2f9bff
accent.success      #2fbf71
accent.warning      #f2b84b
accent.danger       #ef5d5d
selection.bg        #173a55
selection.border    #39a7ff
```

颜色不得形成单一色相界面。深色基底之外，蓝色用于选中和 Preview，绿色用于 Build success，琥珀色用于警告，红色用于错误。

## 交互规范

- Canvas、Layers、Inspector 必须共享同一个 selection 状态。
- 所有编辑动作必须进入 undo/redo history。
- Inspector 修改必须即时反映到 Canvas。
- autosave 使用 debounce，不阻塞用户继续编辑。
- 锁定对象不可移动、不可 resize、不可修改 Inspector 字段。
- 隐藏对象不显示在 Canvas，但保留在 Layers，可取消隐藏。
- 删除 screen 时必须保证项目至少保留一个 screen。
- 拖拽创建控件后，新控件自动选中并滚动到 Layers 可见位置。
- Build 和 Preview 必须把结果写入 Log。

## 尺寸规范

```txt
Minimum editor width: 1280px
Default artboard: 480x480
Top toolbar height: 48px
Status bar height: 28px
Sidebar nav width: 56px
Widgets panel width: 280px
Layers panel width: 280px
Inspector width: 320px
Bottom panel height: 220px
Icon button size: 32px
Panel border radius: 0-6px
Card border radius: <= 8px
```

文本不得根据 viewport 宽度缩放。紧凑面板内使用中小字号，避免 hero 级别字体。

## 文案规范

- UI 面板标题使用英文：Widgets、Layers、Canvas、Style、Events、Layout、Assets、Log、Timeline、Simulator。
- 控件类型使用英文，保持和 LVGL/API/codegen 语义一致。
- 开发文档使用中文，代码符号、API path、类型名保持英文。
- 编辑器 chrome 支持 `en-US` 和 `zh-CN` 两种语言；顶部工具栏、操作按钮、空状态、校验错误和确认弹窗文案必须逐步接入前端 copy dictionary。
- LVGL 事件名、API path、ProjectDoc 字段、C 文件名、资源文件名、widget id/name 和内置字体符号保持英文原文，例如 `LV_EVENT_CLICKED`、`/api/projects/:projectId/export/c`、`ui.c`、`lv_font_montserrat_48`。
- 默认语言为 `en-US`，语言选择持久化到本地存储，切换语言不得改变 `ProjectDoc` 内容。
- 错误提示必须能指导下一步，例如 `Missing asset: icon_heart.png`，避免只显示 `Failed`。
