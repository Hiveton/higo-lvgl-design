# 系统架构

## 目标

定义 LVGL 在线编辑器的整体架构、模块边界、数据流和关键技术决策，保证前端、后端、模拟器和代码生成可以并行开发。

## 适用范围

适用于完整 IDE 第一版：Vue + TypeScript 前端、Go API、账号云项目、PostgreSQL、Redis、对象存储、WASM 模拟器和 LVGL C 代码导出。

## 非目标

本文档不设计多人实时协作、硬件下载、完整云端 SDK 编译、插件市场和团队权限体系。

## 总体架构

```txt
Vue Editor
  -> ProjectDoc Store
  -> Canvas Renderer
  -> Inspector
  -> WASM Simulator
  -> Go API
      -> PostgreSQL
      -> Redis Jobs
      -> Object Storage
      -> LVGL C Codegen
```

## 前端职责

- 管理 IDE 主界面和用户交互。
- 维护 `ProjectDoc` 作为唯一编辑源数据。
- 处理 drag/drop、selection、resize、move、zoom、pan、undo、redo。
- 通过 command 模型修改文档，避免组件直接深改对象。
- 调用 Go API 保存项目、上传资源、触发导出、查询 job。
- 加载 WASM runtime，展示 Simulator 和 Preview。
- 显示 autosave、build、simulator、错误日志。

## 后端职责

- 用户认证和 JWT 用户上下文。
- 项目 CRUD、项目文档保存、版本快照。
- 资源上传、资源元数据、对象存储 URL 签名。
- 导出任务创建、状态记录和结果文件管理。
- 基于 `ProjectDoc` 生成 LVGL C 代码。
- 对所有项目、资源、job 做 owner 权限校验。

## 数据存储

- PostgreSQL：用户、项目、项目版本、资源元数据、job 元数据。
- Redis：导出 job 和后续异步任务状态。
- Object storage：上传图片、字体、导出 zip。
- `ProjectDoc`：以 JSONB 保存最新文档和版本快照。

## 核心数据流

### 编辑保存

```txt
User action
  -> EditorCommand
  -> ProjectDoc Store
  -> Canvas rerender
  -> Autosave debounce
  -> PUT /api/projects/:projectId/doc
  -> StatusBar save state
```

### 预览

```txt
Click Preview or simulator debounce
  -> current ProjectDoc
  -> lvgl-wasm-runtime.renderProject()
  -> SimulatorPanel or Preview mode
  -> LogPanel result
```

### 导出

```txt
Click Build
  -> POST /api/projects/:projectId/export/c
  -> create project version snapshot
  -> codegen reads ProjectDoc
  -> generate ui.c/ui.h/assets.c/assets.h
  -> zip stored in object storage
  -> GET /api/jobs/:jobId polling
  -> LogPanel succeeded/failed
```

## 模块边界

- Canvas 不直接请求 API，只消费 store 状态并派发 command。
- Inspector 不直接修改 `ProjectDoc` 字段，必须派发 command。
- LayersPanel、CanvasWorkspace 和 InspectorPanel 共享 selection store。
- Codegen 只依赖 `ProjectDoc`，不依赖前端 UI 状态、selection 或 history。
- WASM simulator 只负责渲染预览，不负责保存项目或生成 C 代码。
- Backend API 不理解前端交互历史，只保存当前 `ProjectDoc` 和版本快照。

## 运行形态

开发环境：

```txt
Vite dev server -> Go API -> PostgreSQL/Redis/Object storage in Docker Compose
```

生产环境：

```txt
Static web app served by CDN
Go API behind HTTPS
PostgreSQL managed database
Redis managed cache/queue
S3-compatible object storage
```

## 关键约束

- `ProjectDoc` 是跨模块协议，任何破坏性变更必须升级 schema version。
- 导出的 C 代码必须稳定排序，便于代码评审和版本 diff。
- Autosave 失败不能丢失本地编辑状态。
- Preview 失败不能阻塞 Build；Build 失败不能破坏项目文档。
