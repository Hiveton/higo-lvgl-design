import type { AssetRef } from "@hiveton-lvgl/schema";
import { authHeaders } from "./auth";
import { apiError, apiErrorFromPayload, parseJsonPayload, type ErrorPayload } from "./errors";
import { isRecord, isNonEmptyString } from "./utils";

export async function uploadProjectAsset(projectId: string, file: File): Promise<AssetRef> {
  const body = new FormData();
  body.append("file", file);
  body.append("kind", assetKindForFile(file));

  const response = await fetch(`/api/projects/${projectId}/assets`, {
    method: "POST",
    headers: authHeaders(),
    body
  });
  const payload = await parseJsonPayload<{ asset?: AssetRef } & ErrorPayload>(response);
  if (!response.ok || !isProjectAssetRef(payload?.asset, projectId)) {
    throw apiErrorFromPayload(response, payload, "ASSET_UPLOAD_FAILED", `asset upload failed with status ${response.status}`);
  }
  return payload.asset;
}

function assetKindForFile(file: File): AssetRef["kind"] {
  if (file.type.startsWith("font/") || /\.(ttf|otf|woff2?)$/i.test(file.name)) {
    return "font";
  }
  return "image";
}

export async function listProjectAssets(projectId: string): Promise<AssetRef[]> {
  const response = await fetch(`/api/projects/${projectId}/assets`, {
    headers: authHeaders()
  });
  const payload = await parseJsonPayload<AssetRef[] | ({ assets?: AssetRef[] } & ErrorPayload)>(response);
  const assets = Array.isArray(payload) ? payload : payload?.assets;
  if (!response.ok || !Array.isArray(assets) || !assets.every((asset) => isProjectAssetRef(asset, projectId))) {
    throw apiErrorFromPayload(
      response,
      payload && !Array.isArray(payload) ? payload : undefined,
      "ASSET_LIST_FAILED",
      `asset list failed with status ${response.status}`
    );
  }
  return assets;
}

export async function getProjectAssetContent(projectId: string, assetId: string): Promise<Blob> {
  const response = await fetch(`/api/projects/${projectId}/assets/${assetId}/content`, {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw await apiError(response, "ASSET_CONTENT_FAILED", `asset content failed with status ${response.status}`);
  }
  return response.blob();
}

export async function deleteProjectAsset(projectId: string, assetId: string): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/assets/${assetId}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const payload = await parseJsonPayload<{ deleted?: boolean } & ErrorPayload>(response);
  if (!response.ok || payload?.deleted !== true) {
    throw apiErrorFromPayload(response, payload, "ASSET_DELETE_FAILED", `asset delete failed with status ${response.status}`);
  }
}

function isAssetRef(value: unknown): value is AssetRef {
  if (!isRecord(value)) {
    return false;
  }
  const kind = value.kind;
	  return isNonEmptyString(value.id)
	    && isNonEmptyString(value.projectId)
	    && isNonEmptyString(value.name)
	    && (kind === "image" || kind === "font")
	    && isSupportedAssetMimeType(kind, value.mimeType)
	    && isNonNegativeInteger(value.sizeBytes)
	    && isNonEmptyString(value.objectKey)
	    && isDateTime(value.createdAt)
    && (value.width === undefined || isNonNegativeInteger(value.width))
    && (value.height === undefined || isNonNegativeInteger(value.height));
}

function isProjectAssetRef(value: unknown, projectId: string): value is AssetRef {
  return isAssetRef(value) && value.projectId === projectId && isProjectAssetObjectKey(value.objectKey, projectId);
}

function isProjectAssetObjectKey(objectKey: string, projectId: string): boolean {
  return objectKey.startsWith(`projects/${projectId}/assets/`);
}

function isSupportedAssetMimeType(kind: unknown, mimeType: unknown): boolean {
  if (kind === "image") {
    return mimeType === "image/png" || mimeType === "image/jpeg";
  }
  if (kind === "font") {
    return mimeType === "font/ttf" || mimeType === "font/otf" || mimeType === "font/woff" || mimeType === "font/woff2";
  }
  return false;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isDateTime(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}
