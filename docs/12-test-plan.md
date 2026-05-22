# 测试计划

## 目标

定义 LVGL 在线编辑器第一版的测试范围、关键用例和验收标准，确保产品功能、架构边界和代码生成稳定。

## 适用范围

适用于前端单元测试、前端集成测试、Go API 测试、codegen 单元测试、WASM simulator 测试和视觉验收。

## 非目标

第一版不覆盖真实硬件烧录测试、不覆盖多人协作冲突测试、不覆盖完整云编译测试。

## Schema 测试

用例：

- seeded watch UI 可以通过校验。
- 缺失 `screens` 失败。
- `screens` 为空失败。
- 缺失 `screen.root` 失败。
- `screen.root.type` 不是 `screen` 失败。
- unsupported widget type 失败。
- `width` 或 `height` 小于等于 `0` 失败。
- event 绑定不存在 widget 失败。
- `npm run schema:emit` 生成的 `project-doc.schema.json` 与 TS schema 常量一致。
- `packages/schema/openapi.json` 覆盖 Go API 首版路由。

验收：

- schema 校验错误返回明确 path 和 message。
- 前端和后端使用同一份 schema 或同源生成产物。
- `packages/schema/project-doc.schema.json` 可以作为外部工具链输入。
- OpenAPI 中的 `ProjectDoc`、`Asset`、`TargetConfig` 引用同源 JSON Schema。

## Command 测试

用例：

- add widget 后，widget 出现在目标 parent children 中。
- undo add widget 后，widget 被移除。
- move widget 后，layout x/y 更新。
- undo move widget 后，layout x/y 恢复。
- resize widget 后，width/height 更新。
- update style 后，style 字段更新。
- delete widget 后，children 从 tree 中移除。
- undo delete widget 后，原 children 和顺序恢复。
- reorder widget 后，children 顺序变化。
- 新 command 执行后 redo stack 清空。
- history 超过 100 条后丢弃最旧 command。

验收：

- command 不 mutation 原始 `ProjectDoc`。
- apply/revert 后的文档保持 schema 合法。

## Codegen 测试

用例：

- label 生成 `lv_label_create`。
- label text 生成 `lv_label_set_text`。
- button 生成 `lv_btn_create`。
- image 生成 `lv_img_create` 和 `lv_img_set_src`。
- arc 生成 `lv_arc_create`。
- bar 生成 `lv_bar_create`。
- hidden widget 生成 `LV_OBJ_FLAG_HIDDEN`。
- event 生成 `lv_obj_add_event_cb` 和 callback stub。
- 重名 widget 生成稳定唯一 C 标识符。
- 同一个 ProjectDoc 连续生成两次输出一致。
- 本地导出 CLI 可以从示例 ProjectDoc 生成 zip。

验收：

- 生成 zip 包含 `ui.c`、`ui.h`、`assets.c`、`assets.h`、`README.md`。
- `npm run export:example` 成功生成 `.data/example-watch-export.zip`。
- unsupported widget type 返回 `CODEGEN_FAILED`。
- image 引用不存在 asset 返回明确错误。

## API 测试

Auth：

- 错误密码登录失败。
- 正确登录返回 JWT 和 user。
- 无 JWT 访问 `/api/auth/me` 返回 `UNAUTHENTICATED`。

Projects：

- 未登录不能访问 `/api/projects`。
- 创建项目后默认包含 `Screen_1`。
- 保存后读取，`ProjectDoc` JSON 一致。
- 访问他人项目失败。
- 创建版本快照后 `project_versions` 有记录。

Assets：

- 上传 PNG 成功。
- 上传 JPG 成功。
- 同一 project 连续上传同名资源时返回不同 `objectKey`，两个对象内容互不覆盖。
- 上传 TTF font asset 成功并返回 `kind:"font"`。
- font asset 不生成图片 preview URL，Inspector Font 下拉可选择该资源。
- `style.font` 引用 font asset 后 Assets 显示 Used，删除前弹确认。
- 删除被引用 font asset 时先清理 `style.font` 并保存，保存失败不得删除资源。
- `style.font` 引用不存在的自定义 font asset id 时，Schema、API、codegen 均返回校验错误。
- `style.font` 使用非 Montserrat 的 `lv_font_*` 符号时，API 和 codegen 必须按缺失资源返回错误。
- 上传 unsupported MIME type 失败。
- 删除未引用 asset 成功。
- 删除被引用 asset 返回 `ASSET_IN_USE`。

Export：

- `POST /export/c` 返回 job id。
- job 从 queued 到 succeeded。
- succeeded job 返回 download URL。
- codegen 失败时 job 状态为 failed。

## 前端集成测试

用例：

- 打开编辑器显示完整 IDE 布局。
- 从 Widgets 拖拽 Label 到 Canvas。
- 新 Label 自动选中。
- Layers 高亮新 Label。
- Inspector 显示 Label 属性。
- 修改 Text 字段，Canvas 文本即时更新。
- 修改 Color 字段，Canvas 样式即时更新。
- Undo 恢复上一状态。
- Redo 重新应用状态。
- 锁定 widget 后，Canvas 拖拽不改变位置。
- 隐藏 widget 后，Canvas 不显示但 Layers 仍显示。
- 点击 Build 后 Log 显示构建状态。

验收：

- 所有核心编辑路径不依赖后端时可用 seeded data 测试。
- 涉及 API 的测试使用 mock server 或测试 API 实例。
- `npm run test:ui-smoke` 覆盖组件级拖拽、选择、Inspector、Build log、Preview 和 Assets。

## WASM Simulator 测试

用例：

- runtime load 成功后写入 `Simulator loaded`。
- render current screen 成功后写入 `Preview updated`。
- 修改 ProjectDoc 后 debounce 触发 render。
- 缺失 asset 写入 `Missing asset`。
- render timeout 后释放 UI 状态。
- Preview 模式打开和关闭不修改 ProjectDoc。
- native WASM artifact 可被 Node 实例化并返回 `Screen_1`、可见 widget 列表、嵌套父子关系和非零 framebuffer alpha。

验收：

- Simulator 错误不会导致 Vue app 崩溃。
- Build 不依赖 Simulator 测试通过。
- 已安装 Emscripten 的环境执行 `npm run wasm:build && npm run wasm:smoke` 通过。

## 视觉验收

视口：

- `1440x900`
- `1280x800`
- `1920x1080`

检查项：

- TopToolbar 完整显示。
- 左侧 Widgets 和 Layers 不重叠。
- Canvas 选区和 resize handle 可见。
- Inspector 字段不溢出。
- 底部 Assets、Log、Simulator 可区分。
- 状态栏文本不遮挡。
- `1280px` 宽度下无按钮文字溢出。
- `npm run test:visual` 在 Chromium 中覆盖上述视口和检查项。

## 验收命令

工程脚手架落地后使用：

```bash
npm test
npm run verify
npm run test:ui-smoke
npm run test:visual
npm run typecheck
npm run build
cd apps/api && go test ./...
npm run schema:emit
npm run export:example
npm run verify:native
npm run wasm:check
npm run wasm:build
npm run wasm:smoke
```

`npm run verify` 是默认本地验收链路，不要求安装 Emscripten。真实 LVGL native WASM runtime 使用 `npm run verify:native` 单独验收，该命令会先检查工具链，再构建 artifact，最后执行 native smoke。

文档阶段验收使用：

```bash
find docs -type f -name '*.md' -print
```

必须看到 `01` 到 `12` 的完整文档。
