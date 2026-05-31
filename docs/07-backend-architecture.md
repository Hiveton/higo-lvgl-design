# 后端架构

## 目标

定义 Go API 服务的模块、数据库表、权限规则、保存策略、任务模型和错误格式。

## 适用范围

适用于 `apps/api`，包括 auth、projects、assets、jobs、codegen 和对象存储集成。

## 非目标

第一版不实现团队空间、OAuth 第三方登录、多人协作、完整云端 SDK 编译和硬件下载。

## 技术选择

- Go。
- HTTP router：chi。
- PostgreSQL。
- Redis。
- S3-compatible object storage。
- JWT auth。
- SQL migration 工具由实现阶段确定，但 migration 必须纳入版本控制。

## 服务目录建议

```txt
apps/api/
  cmd/api/main.go
  internal/auth/
  internal/projects/
  internal/assets/
  internal/jobs/
  internal/codegen/
  internal/httpx/
  internal/storage/
  internal/db/
```

## 模块职责

### auth

- 登录。
- JWT 签发和校验。
- 从请求中提取当前用户。

第一版账号可采用 email/password。密码必须使用安全 hash，不能明文存储。

### projects

- 创建项目。
- 查询项目列表。
- 读取项目详情和最新 `ProjectDoc`。
- 保存最新 `ProjectDoc`。
- 创建版本快照。

保存规则：

- autosave 只更新 `projects.doc`。
- 手动 Build 前创建 `project_versions` 快照。
- 后端保存前校验基础 schema。

### assets

- 上传 PNG/JPG 图片和 TTF/OTF/WOFF/WOFF2 字体资源。
- 记录资源 metadata。
- 生成下载 URL 或代理下载。
- 删除未被引用资源。

约束：

- asset 必须属于 project。
- project 必须属于当前用户。
- `objectKey` 由后端生成，客户端不能指定。
- `objectKey` 必须包含服务端生成的唯一 id，同一 project 内上传同名文件不能覆盖已有对象。

### jobs

- 创建异步 job。
- 查询 job 状态。
- 记录 progress、log、result URL、error。

第一版 job 可先用于 C export；后续扩展 simulator bundle、云编译。

### codegen

- 输入 `ProjectDoc`。
- 输出内存中的文件集合。
- 调用 zip 打包。
- 不访问 HTTP request、数据库或前端状态。

## 数据库表

### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

### projects

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  doc JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

### project_versions

```sql
CREATE TABLE project_versions (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  doc JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
```

### assets

```sql
CREATE TABLE assets (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  owner_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INT,
  height INT,
  size_bytes BIGINT NOT NULL,
  object_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
```

### jobs

```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id),
  project_id UUID REFERENCES projects(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  logs JSONB NOT NULL DEFAULT '[]',
  result_object_key TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

## API 权限

- 所有 `/api/projects/:projectId` 请求必须校验 project owner。
- asset 必须属于 project，且 project owner 必须是当前用户。
- job 必须属于当前用户。
- 导出时后端使用当前保存的 `ProjectDoc`，不能信任客户端传入的任意 project id。

## 错误格式

所有错误响应使用统一格式：

```json
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "project not found"
  }
}
```

常见错误码：

```txt
ASSET_CONTENT_NOT_FOUND
ASSET_CREATE_FAILED
ASSET_FILE_REQUIRED
ASSET_IN_USE
ASSET_LIST_FAILED
ASSET_LOAD_FAILED
ASSET_NOT_FOUND
ASSET_READ_FAILED
ASSET_STORE_FAILED
ASSET_TOO_LARGE
CODEGEN_FAILED
INVALID_CREDENTIALS
INVALID_JSON
INVALID_MULTIPART
INVALID_PROJECT_DOC
INVALID_PROJECT_NAME
JOB_CREATE_FAILED
JOB_NOT_FOUND
JOB_QUEUE_FAILED
JOB_RESULT_NOT_FOUND
OBJECT_STORE_FAILED
PROJECT_CREATE_FAILED
PROJECT_LIST_FAILED
PROJECT_NOT_FOUND
PROJECT_SAVE_FAILED
PROJECT_VERSION_CREATE_FAILED
TOKEN_ISSUE_FAILED
UNAUTHENTICATED
UNSUPPORTED_ASSET_TYPE
```

## Job 状态

```ts
type JobStatus = "queued" | "running" | "succeeded" | "failed"
```

状态流：

```txt
queued -> running -> succeeded
queued -> running -> failed
```

job log entry：

```json
{
  "time": "2026-05-08T00:00:00Z",
  "level": "info",
  "message": "Generating code"
}
```

## 验收标准

- 未登录请求返回 `UNAUTHENTICATED`。
- 访问他人项目返回 `PROJECT_NOT_FOUND`，不能泄露项目存在性。
- 保存后读取项目，`ProjectDoc` JSON 保持一致。
- 导出 job 成功后返回可下载 zip。
