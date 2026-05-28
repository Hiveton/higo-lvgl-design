import type { AssetRef } from "@hiveton-lvgl/schema";
import { defineStore } from "pinia";
import { ref } from "vue";
import { deleteProjectAsset, getProjectAssetContent, listProjectAssets, uploadProjectAsset } from "../api/assets";
import { localizedErrorForCode, localizeError } from "../i18n/errors";
import { useLocaleStore } from "./locale";

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
  const localeStore = useLocaleStore();
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
      error.value = localizeError(caught, localeStore.locale, "ASSET_LIST_FAILED");
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
      error.value = localizedErrorForCode("ASSET_TOO_LARGE", localeStore.locale);
      loading.value = false;
      return null;
    }
    if (!isSupportedAssetFile(file)) {
      error.value = localizedErrorForCode("UNSUPPORTED_ASSET_TYPE", localeStore.locale);
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
      error.value = localizeError(caught, localeStore.locale, "ASSET_UPLOAD_FAILED");
      return null;
    } finally {
      loading.value = false;
    }
  }

  function importLocalAsset(projectId: string, file: File): AssetRef | null {
    error.value = null;
    if (file.size > MAX_ASSET_BYTES) {
      error.value = localizedErrorForCode("ASSET_TOO_LARGE", localeStore.locale);
      return null;
    }
    if (!isSupportedAssetFile(file)) {
      error.value = localizedErrorForCode("UNSUPPORTED_ASSET_TYPE", localeStore.locale);
      return null;
    }

    const asset: AssetRef = {
      id: createLocalAssetId(file.name),
      projectId,
      name: file.name,
      kind: assetKindForFile(file),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      objectKey: `local://${file.name}`,
      createdAt: new Date().toISOString()
    };
    assets.value = [...assets.value, asset];
    if (asset.kind === "image" && typeof URL.createObjectURL === "function") {
      previewUrls.value = {
        ...previewUrls.value,
        [asset.id]: URL.createObjectURL(file)
      };
    }
    return asset;
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
      error.value = localizeError(caught, localeStore.locale, "ASSET_DELETE_FAILED");
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
    importLocalAsset,
    deleteAsset
  };
});

function isSupportedAssetFile(file: File): boolean {
  return SUPPORTED_ASSET_MIME_TYPES.has(file.type) || /\.(ttf|otf|woff2?)$/i.test(file.name);
}

function assetKindForFile(file: File): AssetRef["kind"] {
  if (file.type.startsWith("font/") || /\.(ttf|otf|woff2?)$/i.test(file.name)) {
    return "font";
  }
  return "image";
}

function createLocalAssetId(fileName: string): string {
  const slug = fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "asset";
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `local-${slug}-${randomPart}`;
}
