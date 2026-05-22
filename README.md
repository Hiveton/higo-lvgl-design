# LVGL Online Editor

## 目标

本项目用于建设一个面向 LVGL 的在线可视化 IDE。用户可以在浏览器中创建云项目、拖拽控件、编辑属性、管理资源、运行 WASM 预览，并导出可集成到嵌入式工程中的 LVGL C 代码。

## 适用范围

本文档适用于产品、前端、后端、代码生成、模拟器和测试开发。当前仓库已进入第一版可运行 IDE 实现阶段，后续实现和验收应同时对齐 `docs/` 下的规范与现有测试。

## 非目标

第一版不做多人实时协作、不做真实硬件烧录、不做完整云端 SDK 固件编译，也不复制 SquareLine Studio 的品牌、图标、界面细节或专有实现。SquareLine Studio 只作为“嵌入式 GUI 编辑器”这一产品类型参考。

## 技术栈

- 前端：Vue 3、TypeScript、Vite、Pinia、Vue Router。
- 后端：Go、chi、PostgreSQL、Redis。
- 存储：账号云项目、PostgreSQL 文档记录、S3-compatible object storage 资源文件。
- 模拟：浏览器内 LVGL WASM runtime。
- 导出：后端生成 LVGL `v8.3.x` C 代码 zip。

## 建议目录结构

```txt
apps/
  web/                    # Vue 在线编辑器
  api/                    # Go API 服务
packages/
  schema/                 # ProjectDoc、OpenAPI、JSON Schema
  lvgl-wasm-runtime/      # 浏览器模拟器 runtime 包装层，支持 Canvas fallback 和 WASM bridge 注入
docs/                     # 产品、设计、架构和测试文档
examples/                 # 可导入和用于测试的示例 ProjectDoc
```

## 开发方向

第一阶段先做一个完整 IDE 的可运行骨架：深色编辑器布局、ProjectDoc 驱动的 watch UI、Canvas、Layers、Inspector、Assets、Log 和 Simulator。第二阶段接入 Go API、云保存、资源上传和 LVGL C 导出。第三阶段强化真实 LVGL WASM bridge、测试覆盖和示例项目。

## 常用命令约定

以下命令用于当前工程：

```bash
npm install
npm run dev:web
npm run dev:api
npm run worker:api
docker compose up -d
npm test
npm run test:api
npm run schema:emit
npm run test:ui-smoke
npm run test:visual
npm run verify
npm run verify:native
npm run typecheck
npm run build
npm run export:example
npm run wasm:check
npm run wasm:build
npm run wasm:smoke
```

`npm run export:example` 会读取 [examples/watch-project.json](examples/watch-project.json)，并生成 `.data/example-watch-export.zip`。该命令用于本地验证 `ProjectDoc -> LVGL C zip` 的最短闭环。

`npm run schema:emit` 会从 `@hiveton-lvgl/schema` 生成 `packages/schema/project-doc.schema.json`，用于后端、工具链和外部导入器复用同一份 ProjectDoc 协议。

`npm run test:visual` 会启动 Vite 本地服务，并用 Playwright Chromium 检查 `1280x800`、`1440x900`、`1920x1080` 三个视口下的 IDE 布局、Preview 和 Build log。

API 机器可读规格位于 [packages/schema/openapi.json](packages/schema/openapi.json)，其中 `ProjectDoc`、`Asset` 和 `TargetConfig` schema 引用同目录下的 `project-doc.schema.json`。

## API 本地运行

无数据库时 API 使用内存存储，适合快速联调：

```bash
cd apps/api
go run ./cmd/api
```

启动后可用健康检查确认 API 已就绪：

```bash
curl http://127.0.0.1:8080/api/health
```

如果本机 `8080` 已被其他服务占用，使用独立端口启动 API，并让 Vite 代理到该端口：

```bash
PORT=18080 npm run dev:api
VITE_API_PROXY_TARGET=http://127.0.0.1:18080 npm run dev:web
```

启用 PostgreSQL 与本地对象存储目录时：

```bash
docker compose up -d postgres redis minio
cd apps/api
DATABASE_URL='postgres://lvgl:lvgl@localhost:5432/lvgl_editor?sslmode=disable' \
REDIS_URL='redis://localhost:6379/0' \
OBJECT_STORAGE_BUCKET='.data/objects' \
AUTH_TOKEN_SECRET='dev-local-secret' \
go run ./cmd/api
```

启用 `REDIS_URL` 后，Build/export job 会写入 Redis 队列，需要另开一个终端启动 worker：

```bash
cd apps/api
DATABASE_URL='postgres://lvgl:lvgl@localhost:5432/lvgl_editor?sslmode=disable' \
REDIS_URL='redis://localhost:6379/0' \
OBJECT_STORAGE_BUCKET='.data/objects' \
go run ./cmd/worker
```

使用 MinIO/S3-compatible object storage 时，先在 MinIO Console `http://localhost:9001` 创建 bucket `lvgl-assets`，再用以下环境变量启动 API：

```bash
cd apps/api
DATABASE_URL='postgres://lvgl:lvgl@localhost:5432/lvgl_editor?sslmode=disable' \
REDIS_URL='redis://localhost:6379/0' \
OBJECT_STORAGE_ENDPOINT='localhost:9000' \
OBJECT_STORAGE_ACCESS_KEY='lvgl' \
OBJECT_STORAGE_SECRET_KEY='lvgl-secret' \
OBJECT_STORAGE_USE_SSL='false' \
OBJECT_STORAGE_BUCKET='lvgl-assets' \
AUTH_TOKEN_SECRET='dev-local-secret' \
go run ./cmd/api
```

worker 必须使用同一组数据库、Redis 和对象存储配置：

```bash
cd apps/api
DATABASE_URL='postgres://lvgl:lvgl@localhost:5432/lvgl_editor?sslmode=disable' \
REDIS_URL='redis://localhost:6379/0' \
OBJECT_STORAGE_ENDPOINT='localhost:9000' \
OBJECT_STORAGE_ACCESS_KEY='lvgl' \
OBJECT_STORAGE_SECRET_KEY='lvgl-secret' \
OBJECT_STORAGE_USE_SSL='false' \
OBJECT_STORAGE_BUCKET='lvgl-assets' \
go run ./cmd/worker
```

当前后端已抽象 object storage 接口：没有 `OBJECT_STORAGE_ENDPOINT` 时，`OBJECT_STORAGE_BUCKET` 被解释为本地目录；存在 `OBJECT_STORAGE_ENDPOINT` 时，`OBJECT_STORAGE_BUCKET` 被解释为远端 bucket 名称。

开发环境会自动 seed 两个账号：`demo@hiveton.dev` 和 `other@hiveton.dev`，密码均为 `password`。`AUTH_TOKEN_SECRET` 用于签发 bearer token；生产环境必须设置为稳定且不可公开的随机值。

## WASM Runtime 接入

前端默认使用 Canvas fallback 预览。接入真实 LVGL WASM 模块时，用环境变量指定模块 URL：

```bash
VITE_LVGL_WASM_MODULE_URL=/src/runtime/lvgl-editor-runtime.js npm run dev:web
```

该模块可以导出 `createLvglRuntime()`、`loadRuntime()`、`createLvglWasmBridge()`，也可以是 Emscripten 生成的默认 `createModule()` factory。低级 bridge 至少实现 `mount(canvas)` 或 `init(canvas)`，以及 `renderProject(doc)` 或 `renderProjectJson(json)`。

真实 LVGL WASM native 构建入口位于 [packages/lvgl-wasm-runtime/native](packages/lvgl-wasm-runtime/native)。`npm run verify` 默认验证 Canvas fallback、代码生成、API 和浏览器 UI，不强制要求本机安装 Emscripten。安装 Emscripten 后执行 `npm run verify:native`，该命令会依次运行 `wasm:check`、`wasm:build` 和 `wasm:smoke`。`wasm:build` 会拉取 LVGL `v8.3.11`，输出 `packages/lvgl-wasm-runtime/dist/wasm/lvgl-editor-runtime.js` 与 `.wasm`，并同步复制到 `apps/web/src/runtime/` 和 `apps/web/public/runtime/`。Vite dev 使用 `/src/runtime/lvgl-editor-runtime.js`，生产静态部署使用 `/runtime/lvgl-editor-runtime.js`。`wasm:smoke` 会在 Node 中实例化同一份 WASM artifact，验证 `lvgl_editor_init`、`lvgl_editor_render_project_json`、screen/widget 结果回传、嵌套控件父子关系，以及 native RGBA framebuffer 指针、尺寸和像素 alpha。native runtime 第一版会从 `ProjectDoc` 按 widget tree 创建基础 LVGL 控件，包括 label、button、container、arc、bar、line、switch、slider、checkbox、dropdown、spinner、chart，并映射 screen/widget 的 `bgColor`、`textColor`、`borderColor`、`radius`、`opacity` 和 `hidden`。

## 文档索引

- [产品方向](docs/01-product-direction.md)
- [设计规范](docs/02-design-spec.md)
- [系统架构](docs/03-system-architecture.md)
- [ProjectDoc 数据模型](docs/04-project-doc-schema.md)
- [功能规格](docs/05-feature-spec.md)
- [前端架构](docs/06-frontend-architecture.md)
- [后端架构](docs/07-backend-architecture.md)
- [API 设计](docs/08-api-design.md)
- [LVGL C 代码生成](docs/09-lvgl-codegen.md)
- [WASM 模拟器](docs/10-wasm-simulator.md)
- [开发路线图](docs/11-development-roadmap.md)
- [测试计划](docs/12-test-plan.md)
- [示例 Watch ProjectDoc](examples/watch-project.json)
