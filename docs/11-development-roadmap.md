# 开发路线图

## 目标

把完整 IDE 第一版拆分为可独立验收的开发阶段，保证每个阶段都能产出可运行或可测试的结果。

## 适用范围

适用于项目排期、任务拆分、开发验收和里程碑评审。

## 非目标

本文档不按个人分工，不估算具体人天，不定义商业发布计划。

## Phase 1：工程脚手架与设计壳

交付：

- Monorepo 目录：`apps/web`、`apps/api`、`packages/schema`、`packages/lvgl-wasm-runtime`。
- Vue 编辑器 shell。
- 深色 IDE 布局。
- 当前设计图对应的假数据 watch UI。

验收：

- `1440x900` 下能看到 TopToolbar、Widgets、Layers、Canvas、Inspector、Assets、Log、Simulator、StatusBar。
- 无真实 API 也能通过假数据展示完整界面。

## Phase 2：ProjectDoc、状态管理、假数据

交付：

- `ProjectDoc` TypeScript 类型。
- Pinia stores。
- seeded watch UI document。
- 基础 selection 状态。

验收：

- 当前 screen 可以从 `ProjectDoc` 渲染。
- Canvas、Layers、Inspector 选择状态同步。
- seeded document 通过 schema 校验。

## Phase 3：Canvas 编辑能力

交付：

- widget 渲染。
- drag/drop 创建控件。
- move、resize、zoom、pan。
- selection outline 和 resize handles。
- grid、ruler、snap。

验收：

- 从 Widgets 拖入 Label 后 Canvas 显示新控件。
- 移动和 resize 后 `ProjectDoc.layout` 更新。
- locked widget 不可编辑。

## Phase 4：Inspector 与属性系统

交付：

- Style、Events、Layout tabs。
- 字段校验。
- command-based update。
- undo/redo。

验收：

- 修改 label text 后 Canvas 即时更新。
- 修改 color/radius/padding 后可 undo。
- 添加 event 后 `ProjectDoc.events` 更新。

## Phase 5：Assets 与云保存

交付：

- Go API 基础 auth/project/assets。
- PostgreSQL migration。
- 对象存储上传。
- autosave。

验收：

- 登录后可创建项目。
- 刷新页面后恢复项目。
- 上传 PNG 后 Assets 显示缩略图，image widget 可引用。

## Phase 6：Go API 与数据库完善

交付：

- 项目列表、读取、保存、版本快照。
- owner 权限校验。
- 统一错误格式。
- API 测试。

验收：

- 未登录不能访问项目。
- 不能访问他人项目。
- ProjectDoc save/load round-trip 一致。

## Phase 7：LVGL C codegen

交付：

- `internal/codegen`。
- widget 创建映射。
- style、layout、props、events 生成。
- zip 打包。

验收：

- Build sample watch UI 后生成 `ui.c`、`ui.h`、`assets.c`、`assets.h`、`README.md`。
- label/button/image/event 的生成结果有单元测试。
- 同输入多次生成输出一致。

## Phase 8：WASM simulator

交付：

- `packages/lvgl-wasm-runtime` wrapper。
- SimulatorPanel。
- Preview 模式。
- simulator log。

验收：

- 当前 screen 能在 SimulatorPanel 渲染。
- 修改 ProjectDoc 后 debounce 刷新。
- runtime error 写入 Log，不崩溃编辑器。

## Phase 9：Build/Preview/Log UX

交付：

- `Build` 按钮触发 export job。
- job polling。
- LogPanel 展示 job 进度。
- 成功下载 zip。
- Preview 完整模式。

验收：

- Build started、Generating code、Build completed successfully 出现在 Log。
- 成功后出现下载链接。
- Preview 进入和退出不改变文档。

## Phase 10：测试、文档、示例项目

交付：

- Vitest 单元测试。
- Go API/codegen tests。
- 浏览器 UI 烟测或 Playwright UI 测试。
- 示例 watch 项目。
- README 启动说明更新。

验收：

- `npm test` 通过。
- `go test ./...` 通过。
- `npm run export:example` 可从示例 watch 项目生成 LVGL C zip。
- 浏览器 UI 验收覆盖拖拽、选择、Inspector、Build log。
- `npm run test:ui-smoke` 覆盖核心编辑器 UI 烟测：拖拽、选择、Inspector、Build log、Preview 和 Assets。
- `npm run test:visual` 覆盖 `1280x800`、`1440x900`、`1920x1080` 的浏览器布局验收。
- 文档和实际命令一致。

## 开发原则

- 每个 phase 都要能独立验收。
- 不等待最后阶段才集成。
- ProjectDoc schema 变更必须同步前端、后端、codegen 和测试。
- 优先做可运行闭环，再扩展控件覆盖。
