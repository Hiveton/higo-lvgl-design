import { ApiError } from "../api/errors";
import type { Locale } from "./types";

const localizedErrorMessages: Record<Locale, Record<string, string>> = {
  "en-US": {
    API_ERROR: "Request failed",
    ASSET_CONTENT_FAILED: "Asset preview could not be loaded",
    ASSET_CONTENT_NOT_FOUND: "Asset content was not found",
    ASSET_DELETE_FAILED: "Asset delete failed",
    ASSET_FILE_REQUIRED: "Asset file is required",
    ASSET_IN_USE: "Asset is used by a widget",
    ASSET_LIST_FAILED: "Asset list failed",
    ASSET_NOT_FOUND: "Asset was not found",
    ASSET_READ_FAILED: "Asset file could not be read",
    ASSET_TOO_LARGE: "Asset file is too large",
    ASSET_UPLOAD_FAILED: "Asset upload failed",
    BUILD_FAILED: "Build failed",
    CODEGEN_FAILED: "Code generation failed",
    CURRENT_USER_LOOKUP_FAILED: "Session restore failed",
    EXPORT_FAILED: "Export failed",
    INVALID_CREDENTIALS: "Invalid email or password",
    INVALID_JSON: "Invalid request body",
    INVALID_MULTIPART: "Invalid upload form",
    INVALID_PROJECT_DOC: "Project document is invalid",
    INVALID_PROJECT_NAME: "Project name is required",
    JOB_DOWNLOAD_FAILED: "Job download failed",
    JOB_NOT_FOUND: "Job was not found",
    JOB_RESULT_NOT_FOUND: "Export result was not found",
    LOGIN_FAILED: "Login failed",
    PROJECT_CREATE_FAILED: "Project create failed",
    PROJECT_LIST_FAILED: "Project list failed",
    PROJECT_LOOKUP_FAILED: "Project lookup failed",
    PROJECT_NOT_FOUND: "Project was not found",
    PROJECT_SAVE_FAILED: "Project save failed",
    PROJECT_VERSION_CREATE_FAILED: "Project version create failed",
    RENDER_TIMEOUT: "Render timed out",
    RUNTIME_LOAD_FAILED: "Runtime load failed",
    SAVE_FAILED: "Project save failed",
    ASSET_LOAD_FAILED: "Build asset load failed",
    INTERNAL_RENDER_ERROR: "Preview render failed",
    JOB_QUEUE_FAILED: "Build queue failed",
    MISSING_ASSET: "Missing asset",
    OBJECT_STORE_FAILED: "Export package storage failed",
    TOKEN_ISSUE_FAILED: "Token issue failed",
    UNAUTHENTICATED: "Sign in required",
    UNSUPPORTED_WIDGET_TYPE: "Unsupported widget type",
    UNSUPPORTED_ASSET_TYPE: "Only PNG, JPG, TTF, OTF, WOFF and WOFF2 assets are supported"
  },
  "zh-CN": {
    API_ERROR: "请求失败",
    ASSET_CONTENT_FAILED: "资源预览加载失败",
    ASSET_CONTENT_NOT_FOUND: "资源内容不存在",
    ASSET_DELETE_FAILED: "资源删除失败",
    ASSET_FILE_REQUIRED: "请选择资源文件",
    ASSET_IN_USE: "资源正在被控件使用",
    ASSET_LIST_FAILED: "资源列表加载失败",
    ASSET_NOT_FOUND: "资源不存在",
    ASSET_READ_FAILED: "资源文件读取失败",
    ASSET_TOO_LARGE: "资源文件过大",
    ASSET_UPLOAD_FAILED: "资源上传失败",
    BUILD_FAILED: "构建失败",
    CODEGEN_FAILED: "代码生成失败",
    CURRENT_USER_LOOKUP_FAILED: "会话恢复失败",
    EXPORT_FAILED: "导出失败",
    INVALID_CREDENTIALS: "邮箱或密码无效",
    INVALID_JSON: "请求内容格式错误",
    INVALID_MULTIPART: "上传表单无效",
    INVALID_PROJECT_DOC: "项目文档无效",
    INVALID_PROJECT_NAME: "项目名称不能为空",
    JOB_DOWNLOAD_FAILED: "构建结果下载失败",
    JOB_NOT_FOUND: "任务不存在",
    JOB_RESULT_NOT_FOUND: "导出结果不存在",
    LOGIN_FAILED: "登录失败",
    PROJECT_CREATE_FAILED: "项目创建失败",
    PROJECT_LIST_FAILED: "项目列表加载失败",
    PROJECT_LOOKUP_FAILED: "项目读取失败",
    PROJECT_NOT_FOUND: "项目不存在",
    PROJECT_SAVE_FAILED: "项目保存失败",
    PROJECT_VERSION_CREATE_FAILED: "项目版本创建失败",
    RENDER_TIMEOUT: "渲染超时",
    RUNTIME_LOAD_FAILED: "Runtime 加载失败",
    SAVE_FAILED: "项目保存失败",
    ASSET_LOAD_FAILED: "构建资源加载失败",
    INTERNAL_RENDER_ERROR: "预览渲染失败",
    JOB_QUEUE_FAILED: "构建队列提交失败",
    MISSING_ASSET: "资源缺失",
    OBJECT_STORE_FAILED: "导出包存储失败",
    TOKEN_ISSUE_FAILED: "登录令牌生成失败",
    UNAUTHENTICATED: "请先登录",
    UNSUPPORTED_WIDGET_TYPE: "不支持的控件类型",
    UNSUPPORTED_ASSET_TYPE: "仅支持 PNG、JPG、TTF、OTF、WOFF 和 WOFF2 资源"
  }
};

export function localizeError(error: unknown, locale: Locale, fallbackCode = "API_ERROR"): string {
  if (error instanceof ApiError) {
    return localizedErrorMessages[locale][error.code] ?? localizedErrorMessages[locale][fallbackCode] ?? localizedErrorMessages[locale].API_ERROR;
  }
  if (error instanceof Error) {
    if (locale === "en-US" && error.message) {
      return error.message;
    }
    return localizedErrorMessages[locale][fallbackCode] ?? localizedErrorMessages[locale].API_ERROR;
  }
  return localizedErrorMessages[locale][fallbackCode] ?? localizedErrorMessages[locale].API_ERROR;
}

export function localizedErrorForCode(code: string, locale: Locale, fallbackCode = "API_ERROR"): string {
  return localizedErrorMessages[locale][code] ?? localizedErrorMessages[locale][fallbackCode] ?? localizedErrorMessages[locale].API_ERROR;
}
