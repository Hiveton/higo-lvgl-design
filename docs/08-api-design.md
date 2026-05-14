# API 设计

## 目标

定义 LVGL 在线编辑器第一版 HTTP API，保证前端、后端和测试对接口语义一致。

## 适用范围

适用于账号、项目、资源、导出和 job 查询。所有 API 默认前缀为 `/api`。

机器可读 OpenAPI 规格位于 `packages/schema/openapi.json`。该文件必须覆盖 Go API 实际路由，并通过 `packages/schema` 测试校验路径、鉴权和核心 schema 引用。

## 非目标

第一版不提供公开第三方 API、不提供团队管理 API、不提供多人协作 WebSocket API。

## 通用约定

- 请求和响应使用 JSON，文件上传除外。
- 鉴权使用 `Authorization: Bearer <token>`。
- 时间使用 ISO 8601 UTC 字符串。
- ID 使用 UUID 字符串。
- 错误格式统一：

```json
{
  "error": {
    "code": "INVALID_PROJECT_DOC",
    "message": "screen root is required"
  }
}
```

## Auth

### POST /api/auth/login

请求：

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

响应：

```json
{
  "token": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "displayName": "Hiveton"
  }
}
```

### GET /api/auth/me

响应：

```json
{
  "id": "user-id",
  "email": "user@example.com",
  "displayName": "Hiveton"
}
```

## Projects

### GET /api/projects

响应：

```json
{
  "projects": [
    {
      "id": "project-id",
      "name": "My Watch UI",
      "target": {
        "lvglVersion": "8.3",
        "deviceName": "ESP32-S3",
        "width": 480,
        "height": 480,
        "dpi": 240,
        "colorDepth": 16
      },
      "updatedAt": "2026-05-08T00:00:00Z"
    }
  ]
}
```

### POST /api/projects

请求：

```json
{
  "name": "My Watch UI",
  "target": {
    "lvglVersion": "8.3",
    "deviceName": "ESP32-S3",
    "width": 480,
    "height": 480,
    "dpi": 240,
    "colorDepth": 16
  }
}
```

响应：

```json
{
  "project": {
    "id": "project-id",
    "name": "My Watch UI",
    "doc": {}
  }
}
```

后端必须创建包含 `Screen_1` 的默认 `ProjectDoc`，不能返回空文档。

### GET /api/projects/:projectId

响应：

```json
{
  "project": {
    "id": "project-id",
    "name": "My Watch UI",
    "doc": {},
    "createdAt": "2026-05-08T00:00:00Z",
    "updatedAt": "2026-05-08T00:00:00Z"
  }
}
```

### PUT /api/projects/:projectId/doc

请求：

```json
{
  "doc": {}
}
```

响应：

```json
{
  "projectId": "project-id",
  "updatedAt": "2026-05-08T00:00:00Z"
}
```

行为：

- 校验用户权限。
- 校验基础 `ProjectDoc`。
- 更新 latest doc。
- 不创建版本快照。

### POST /api/projects/:projectId/versions

请求：

```json
{
  "name": "Before Build 2026-05-08 13:45"
}
```

兼容旧调用可继续发送 `label`；当 `name` 和 `label` 同时存在时，以 `name` 为准。

响应：

```json
{
  "version": {
    "id": "version-id",
    "projectId": "project-id",
    "name": "Before Build 2026-05-08 13:45",
    "createdAt": "2026-05-08T00:00:00Z"
  }
}
```

## Assets

### POST /api/projects/:projectId/assets

使用 multipart form：

```txt
file=<binary>
kind=image | font
```

响应：

```json
{
  "asset": {
    "id": "asset-id",
    "projectId": "project-id",
    "name": "icon_heart.png",
    "kind": "image",
    "mimeType": "image/png",
    "width": 64,
    "height": 64,
    "sizeBytes": 2048,
    "objectKey": "projects/project-id/assets/asset-id/icon_heart.png",
    "createdAt": "2026-05-08T00:00:00Z"
  }
}
```

约束：

- 第一版接受 `image/png`、`image/jpeg`、`.ttf`、`.otf`、`.woff`、`.woff2`。
- font asset 返回 `kind:"font"`，不返回 width/height。
- 单文件建议限制 `5MB`。
- `objectKey` 必须由服务端生成且全局唯一；同一 project 内多次上传同名文件必须返回不同 `objectKey`，并保留各自对象内容。

### GET /api/projects/:projectId/assets

响应：

```json
{
  "assets": []
}
```

### GET /api/projects/:projectId/assets/:assetId/content

用于前端恢复已上传资源的缩略图，以及导出链路调试时读取资源内容。

响应：

```http
HTTP/1.1 200 OK
Content-Type: image/png
Content-Disposition: inline; filename="icon_heart.png"

<binary>
```

权限：

- 必须登录。
- `assetId` 必须属于当前用户拥有的 `projectId`。
- 内容从 object storage 读取；缺失时返回 `ASSET_CONTENT_NOT_FOUND`。

### DELETE /api/projects/:projectId/assets/:assetId

响应：

```json
{
  "deleted": true
}
```

若资源仍被 `ProjectDoc` 引用，返回：

```json
{
  "error": {
    "code": "ASSET_IN_USE",
    "message": "asset is used by image widget"
  }
}
```

## Export

### POST /api/projects/:projectId/export/c

请求：

```json
{
  "createVersion": true
}
```

响应：

```json
{
  "jobId": "job-id"
}
```

行为：

- 校验 project owner。
- 读取最新 `ProjectDoc`。
- 如果 `createVersion` 为 true，创建版本快照。
- 创建 C export job。

## Jobs

### GET /api/jobs/:jobId

响应：

```json
{
  "job": {
    "id": "job-id",
    "kind": "export_c",
    "status": "succeeded",
    "progress": 100,
    "logs": [
      {
        "time": "2026-05-08T00:00:00Z",
        "level": "info",
        "message": "Build completed successfully"
      }
    ],
    "result": {
      "downloadUrl": "https://storage.example.com/export.zip",
      "expiresAt": "2026-05-08T01:00:00Z"
    }
  }
}
```

失败响应中的 job：

```json
{
  "job": {
    "id": "job-id",
    "kind": "export_c",
    "status": "failed",
    "progress": 60,
    "logs": [],
    "error": {
      "code": "CODEGEN_FAILED",
      "message": "unsupported widget type"
    }
  }
}
```
