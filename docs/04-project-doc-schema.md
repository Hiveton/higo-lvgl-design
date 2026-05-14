# ProjectDoc 数据模型

## 目标

定义 LVGL 在线编辑器第一版的统一项目文档协议。前端 store、后端存储、WASM simulator 和 LVGL C codegen 都必须以 `ProjectDoc` 为输入或输出边界。

## 适用范围

适用于项目保存、版本快照、Canvas 渲染、Inspector 编辑、资源引用、事件绑定、模拟器预览和 C 代码导出。

当前 TypeScript 协议由 `packages/schema/src/index.ts` 维护；执行 `npm run schema:emit` 会生成 `packages/schema/project-doc.schema.json`，供后端、导入器和外部工具链做结构校验。

## 非目标

第一版不定义多人协作 CRDT、插件扩展 schema、完整 LVGL 全量属性映射或硬件 SDK 构建配置。

## 顶层结构

```ts
type ProjectDoc = {
  schemaVersion: 1
  id: string
  name: string
  target: TargetConfig
  theme: "dark" | "light"
  screens: ScreenNode[]
  assets: AssetRef[]
  styles: StyleDef[]
  events: EventBinding[]
  updatedAt: string
}
```

约束：

- `schemaVersion` 第一版固定为 `1`。
- `id` 使用稳定 UUID。
- `name` 用于 UI 展示和默认导出 zip 名称。
- `updatedAt` 使用 ISO 8601 UTC 字符串。
- `screens` 必须至少包含一个 screen。

## TargetConfig

```ts
type TargetConfig = {
  lvglVersion: "8.3"
  deviceName: string
  width: number
  height: number
  dpi: number
  colorDepth: 16 | 32
}
```

约束：

- 第一版 `lvglVersion` 固定为 `"8.3"`。
- `width`、`height` 必须为正整数，默认 `480`。
- `dpi` 必须为正整数，默认 `240`。
- `colorDepth` 只支持 `16` 或 `32`。

## ScreenNode

```ts
type ScreenNode = {
  id: string
  name: string
  root: WidgetNode
}
```

约束：

- `root.type` 必须为 `"screen"`。
- `name` 在同一项目内建议唯一。
- 删除 screen 时必须保留至少一个 screen。

## WidgetNode

```ts
type WidgetNode = {
  id: string
  type: WidgetType
  name: string
  parentId: string | null
  children: WidgetNode[]
  layout: LayoutBox
  props: Record<string, string | number | boolean>
  style: WidgetStyle
  locked: boolean
  hidden: boolean
}
```

约束：

- `id` 使用稳定 UUID，不能随重命名变化。
- `name` 在同一 screen 内建议唯一；codegen 处理冲突时追加数字后缀。
- `parentId` 必须指向父 widget，screen root 的 `parentId` 为 `null`。
- `children` 顺序就是图层和生成代码的顺序。
- `locked` 只影响编辑器行为，不影响导出。
- `hidden` 首版导出时仍生成对象，但设置隐藏状态。
- 所有尺寸和坐标以 LVGL 像素为单位。

## WidgetType

```ts
type WidgetType =
  | "screen"
  | "container"
  | "button"
  | "label"
  | "image"
  | "arc"
  | "bar"
  | "line"
  | "switch"
  | "slider"
  | "checkbox"
  | "dropdown"
  | "spinner"
  | "chart"
```

## LayoutBox

```ts
type LayoutBox = {
  x: number
  y: number
  width: number
  height: number
  align?: "top-left" | "top-right" | "center" | "bottom-left" | "bottom-right"
  flex?: {
    direction: "row" | "column"
    gap: number
    wrap: boolean
  }
}
```

约束：

- 第一版以绝对定位为主。
- `flex` 只在 `container` 和 `screen` 上生效。
- `width`、`height` 必须大于 `0`，screen root 使用 target 尺寸。

## WidgetStyle

```ts
type WidgetStyle = {
  opacity?: number
  bgColor?: string
  textColor?: string
  borderColor?: string
  radius?: number
  padding?: {
    top: number
    right: number
    bottom: number
    left: number
  }
  font?: string
  lineSpace?: number
  letterSpace?: number
  align?: "left" | "center" | "right"
}
```

约束：

- 颜色使用 `#RRGGBB`。
- `opacity` 范围为 `0` 到 `100`。
- `font` 首版支持内置 Montserrat 名称和上传字体资源 id。
- 当 `font` 不是 `lv_font_*` 内置符号时，必须能在 `ProjectDoc.assets` 中找到同 id 的 `kind:"font"` 资源。

## AssetRef

```ts
type AssetRef = {
  id: string
  projectId: string
  name: string
  kind: "image" | "font"
  mimeType: string
  width?: number
  height?: number
  sizeBytes: number
  objectKey: string
  createdAt: string
}
```

约束：

- image 首版支持 PNG/JPG。
- font 首版可登记元数据，完整字体转换在后续版本实现。
- 被 image widget `props.assetId` 或 widget `style.font` 引用的资源删除前必须先清理引用并保存。
- `objectKey` 只能由后端生成。

## StyleDef

```ts
type StyleDef = {
  id: string
  name: string
  style: WidgetStyle
}
```

第一版允许存在全局样式定义，但 UI 可先以内联 widget style 为主。Codegen 必须支持 style 复用，为后续主题系统保留路径。

## EventBinding

```ts
type EventBinding = {
  id: string
  widgetId: string
  event: "LV_EVENT_CLICKED" | "LV_EVENT_VALUE_CHANGED" | "LV_EVENT_READY" | "LV_EVENT_CANCEL"
  handlerName: string
}
```

约束：

- `widgetId` 必须指向存在的 widget。
- `handlerName` 必须生成合法 C 函数名。
- Codegen 生成 callback stub，不实现业务逻辑。

## 示例 ProjectDoc

```json
{
  "schemaVersion": 1,
  "id": "project-watch-demo",
  "name": "My Watch UI",
  "target": {
    "lvglVersion": "8.3",
    "deviceName": "ESP32-S3",
    "width": 480,
    "height": 480,
    "dpi": 240,
    "colorDepth": 16
  },
  "theme": "dark",
  "screens": [
    {
      "id": "screen-1",
      "name": "Screen_1",
      "root": {
        "id": "root-screen-1",
        "type": "screen",
        "name": "Screen_1",
        "parentId": null,
        "children": [
          {
            "id": "time-label",
            "type": "label",
            "name": "Time_Label",
            "parentId": "root-screen-1",
            "children": [],
            "layout": { "x": 150, "y": 40, "width": 180, "height": 56 },
            "props": { "text": "10:09" },
            "style": { "textColor": "#FFFFFF", "font": "lv_font_montserrat_48", "align": "center" },
            "locked": false,
            "hidden": false
          }
        ],
        "layout": { "x": 0, "y": 0, "width": 480, "height": 480 },
        "props": {},
        "style": { "bgColor": "#101010" },
        "locked": false,
        "hidden": false
      }
    }
  ],
  "assets": [],
  "styles": [],
  "events": [],
  "updatedAt": "2026-05-08T00:00:00Z"
}
```
