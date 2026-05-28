import type { AssetRef } from "@hiveton-lvgl/schema";
import { authHeaders } from "./auth";
import { apiError, apiErrorFromPayload, parseJsonPayload, type ErrorPayload } from "./errors";

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
  if (!response.ok || !payload?.asset) {
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
  if (!response.ok || assets === undefined) {
    throw apiErrorFromPayload(
      response,
      payload && !Array.isArray(payload) ? payload : undefined,
      "ASSET_LIST_FAILED",
      `asset list failed with status ${response.status}`
    );
  }
  return assets ?? [];
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
  if (!response.ok || !payload?.deleted) {
    throw apiErrorFromPayload(response, payload, "ASSET_DELETE_FAILED", `asset delete failed with status ${response.status}`);
  }
}
