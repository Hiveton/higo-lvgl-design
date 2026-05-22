import type { AssetRef } from "@hiveton-lvgl/schema";
import { defineStore } from "pinia";
import { ref } from "vue";
import { deleteProjectAsset, getProjectAssetContent, listProjectAssets, uploadProjectAsset } from "../api/assets";

const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const SUPPORTED_ASSET_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
  "application/font-sfnt",
  "application/x-font-ttf",
  "application/x-font-otf",
  "application/font-woff",
  "application/font-woff2"
]);

export const useAssetsStore = defineStore("assets", () => {
  const assets = ref<AssetRef[]>([]);
  const previewUrls = ref<Record<string, string>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function loadAssets(projectId: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      assets.value = await listProjectAssets(projectId);
      await hydratePreviewUrls(projectId, assets.value);
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : "asset list failed";
    } finally {
      loading.value = false;
    }
  }

  async function hydratePreviewUrls(projectId: string, nextAssets: AssetRef[]): Promise<void> {
    const nextPreviewUrls: Record<string, string> = {};
    for (const asset of nextAssets) {
      if (asset.kind !== "image" || previewUrls.value[asset.id]) {
        if (previewUrls.value[asset.id]) {
          nextPreviewUrls[asset.id] = previewUrls.value[asset.id];
        }
        continue;
      }
      try {
        const content = await getProjectAssetContent(projectId, asset.id);
        if (typeof URL.createObjectURL === "function") {
          nextPreviewUrls[asset.id] = URL.createObjectURL(content);
        }
      } catch {
        // Metadata remains useful even when a preview object cannot be fetched.
      }
    }
    for (const [assetId, previewUrl] of Object.entries(previewUrls.value)) {
      if (!nextPreviewUrls[assetId] && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(previewUrl);
      }
    }
    previewUrls.value = nextPreviewUrls;
  }

  async function uploadAsset(projectId: string, file: File): Promise<AssetRef | null> {
    loading.value = true;
    error.value = null;
    if (file.size > MAX_ASSET_BYTES) {
      error.value = "asset file is too large";
      loading.value = false;
      return null;
    }
    if (!isSupportedAssetFile(file)) {
      error.value = "only PNG, JPG, TTF, OTF, WOFF and WOFF2 assets are supported";
      loading.value = false;
      return null;
    }
    try {
      const asset = await uploadProjectAsset(projectId, file);
      assets.value = [...assets.value, asset];
      if (asset.kind === "image" && typeof URL.createObjectURL === "function") {
        previewUrls.value = {
          ...previewUrls.value,
          [asset.id]: URL.createObjectURL(file)
        };
      }
      return asset;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : "asset upload failed";
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function deleteAsset(projectId: string, assetId: string): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      await deleteProjectAsset(projectId, assetId);
      assets.value = assets.value.filter((asset) => asset.id !== assetId);
      const previewUrl = previewUrls.value[assetId];
      if (previewUrl && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(previewUrl);
      }
      const { [assetId]: _removed, ...remainingPreviewUrls } = previewUrls.value;
      previewUrls.value = remainingPreviewUrls;
      return true;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : "asset delete failed";
      return false;
    } finally {
      loading.value = false;
    }
  }

  function clearError(): void {
    error.value = null;
  }

  return {
    assets,
    previewUrls,
    loading,
    error,
    clearError,
    loadAssets,
    uploadAsset,
    deleteAsset
  };
});

function isSupportedAssetFile(file: File): boolean {
  return SUPPORTED_ASSET_MIME_TYPES.has(file.type) || /\.(ttf|otf|woff2?)$/i.test(file.name);
}
