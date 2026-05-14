import type { AssetRef } from "@hiveton-lvgl/schema";
import { authHeaders } from "./auth";

type ErrorPayload = {
  error?: {
    code: string;
    message: string;
  };
};

export async function uploadProjectAsset(projectId: string, file: File): Promise<AssetRef> {
  const body = new FormData();
  body.append("file", file);
  body.append("kind", assetKindForFile(file));

  const response = await fetch(`/api/projects/${projectId}/assets`, {
    method: "POST",
    headers: authHeaders(),
    body
  });
  const payload = (await response.json()) as { asset?: AssetRef } & ErrorPayload;
  if (!response.ok || !payload.asset) {
    throw new Error(payload.error?.message ?? `asset upload failed with status ${response.status}`);
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
  const payload = (await response.json()) as AssetRef[] | ({ assets?: AssetRef[] } & ErrorPayload);
  const assets = Array.isArray(payload) ? payload : payload.assets;
  if (!response.ok || assets === undefined) {
    const error = Array.isArray(payload) ? undefined : payload.error;
    throw new Error(error?.message ?? `asset list failed with status ${response.status}`);
  }
  return assets ?? [];
}

export async function getProjectAssetContent(projectId: string, assetId: string): Promise<Blob> {
  const response = await fetch(`/api/projects/${projectId}/assets/${assetId}/content`, {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw new Error(`asset content failed with status ${response.status}`);
  }
  return response.blob();
}

export async function deleteProjectAsset(projectId: string, assetId: string): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/assets/${assetId}`, {
    method: "DELETE",
    headers: authHeaders()
  });
  const payload = (await response.json()) as { deleted?: boolean } & ErrorPayload;
  if (!response.ok || !payload.deleted) {
    throw new Error(payload.error?.message ?? `asset delete failed with status ${response.status}`);
  }
}
