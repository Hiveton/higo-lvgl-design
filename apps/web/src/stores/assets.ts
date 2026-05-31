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
  const localFiles = ref<Record<string, File>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  let loadRequestId = 0;
  let mutationRequestId = 0;

  async function loadAssets(projectId: string): Promise<void> {
    const requestId = ++loadRequestId;
    loading.value = true;
    error.value = null;
    try {
      const nextAssets = await listProjectAssets(projectId);
      if (requestId !== loadRequestId) {
        return;
      }
      assets.value = nextAssets;
      await hydratePreviewUrls(projectId, nextAssets, requestId);
    } catch (caught) {
      if (requestId !== loadRequestId) {
        return;
      }
      clearAssetState();
      error.value = localizeError(caught, localeStore.locale, "ASSET_LIST_FAILED");
    } finally {
      if (requestId === loadRequestId) {
        loading.value = false;
      }
    }
  }

  async function hydratePreviewUrls(projectId: string, nextAssets: AssetRef[], requestId: number): Promise<void> {
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
        const previewUrl = createPreviewObjectUrl(content);
        if (previewUrl) {
          nextPreviewUrls[asset.id] = previewUrl;
        }
      } catch (error) {
        console.warn("Failed to load image preview:", error);
      }
    }
    if (requestId !== loadRequestId) {
      for (const previewUrl of Object.values(nextPreviewUrls)) {
        if (!Object.values(previewUrls.value).includes(previewUrl)) {
          revokePreviewObjectUrl(previewUrl);
        }
      }
      return;
    }
    for (const [assetId, previewUrl] of Object.entries(previewUrls.value)) {
      if (!nextPreviewUrls[assetId]) {
        revokePreviewObjectUrl(previewUrl);
      }
    }
    previewUrls.value = nextPreviewUrls;
  }

  async function uploadAsset(projectId: string, file: File): Promise<AssetRef | null> {
    const requestId = ++mutationRequestId;
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
      if (requestId !== mutationRequestId) {
        return null;
      }
      invalidateAssetLoads();
      assets.value = [...assets.value, asset];
      const previewUrl = asset.kind === "image" ? createPreviewObjectUrl(file) : null;
      if (previewUrl) {
        previewUrls.value = {
          ...previewUrls.value,
          [asset.id]: previewUrl
        };
      }
      return asset;
    } catch (caught) {
      if (requestId === mutationRequestId) {
        error.value = localizeError(caught, localeStore.locale, "ASSET_UPLOAD_FAILED");
      }
      return null;
    } finally {
      if (requestId === mutationRequestId) {
        loading.value = false;
      }
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
    invalidateAssetLoads();
    localFiles.value = {
      ...localFiles.value,
      [asset.id]: file
    };
    assets.value = [...assets.value, asset];
    const previewUrl = asset.kind === "image" ? createPreviewObjectUrl(file) : null;
    if (previewUrl) {
      previewUrls.value = {
        ...previewUrls.value,
        [asset.id]: previewUrl
      };
    }
    return asset;
  }

  async function uploadStoredLocalAsset(projectId: string, assetId: string): Promise<{ oldAssetId: string; asset: AssetRef } | null> {
    const localAsset = assets.value.find((asset) => asset.id === assetId && asset.objectKey.startsWith("local://"));
    const file = localFiles.value[assetId];
    if (!localAsset || !file) {
      error.value = localizedErrorForCode("ASSET_UPLOAD_FAILED", localeStore.locale);
      return null;
    }
    const uploaded = await uploadAsset(projectId, file);
    if (!uploaded) {
      return null;
    }
    removeAssetFromState(assetId);
    return {
      oldAssetId: assetId,
      asset: uploaded
    };
  }

  async function deleteAsset(projectId: string, assetId: string): Promise<boolean> {
    const requestId = ++mutationRequestId;
    loading.value = true;
    error.value = null;
    try {
      await deleteProjectAsset(projectId, assetId);
      invalidateAssetLoads();
      removeAssetFromState(assetId);
      return true;
    } catch (caught) {
      if (requestId === mutationRequestId) {
        error.value = localizeError(caught, localeStore.locale, "ASSET_DELETE_FAILED");
      }
      return false;
    } finally {
      if (requestId === mutationRequestId) {
        loading.value = false;
      }
    }
  }

  function deleteLocalAsset(assetId: string): boolean {
    error.value = null;
    if (!assets.value.some((asset) => asset.id === assetId)) {
      return false;
    }
    invalidateAssetLoads();
    removeAssetFromState(assetId);
    return true;
  }

  function invalidateAssetLoads(): void {
    loadRequestId += 1;
  }

  function removeAssetFromState(assetId: string): void {
    assets.value = assets.value.filter((asset) => asset.id !== assetId);
    const previewUrl = previewUrls.value[assetId];
    if (previewUrl) {
      revokePreviewObjectUrl(previewUrl);
    }
    const { [assetId]: _removed, ...remainingPreviewUrls } = previewUrls.value;
    previewUrls.value = remainingPreviewUrls;
    const { [assetId]: _removedFile, ...remainingLocalFiles } = localFiles.value;
    localFiles.value = remainingLocalFiles;
  }

  function clearAssetState(): void {
    for (const previewUrl of Object.values(previewUrls.value)) {
      revokePreviewObjectUrl(previewUrl);
    }
    assets.value = [];
    previewUrls.value = {};
    localFiles.value = {};
  }

  function clearError(): void {
    error.value = null;
  }

  return {
    assets,
    previewUrls,
    loading,
    error,
    localFiles,
    clearError,
    loadAssets,
    uploadAsset,
    importLocalAsset,
    uploadStoredLocalAsset,
    deleteLocalAsset,
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

function createPreviewObjectUrl(source: Blob): string | null {
  if (typeof URL.createObjectURL !== "function") {
    return null;
  }
  try {
    return URL.createObjectURL(source);
  } catch (error) {
    console.warn("Failed to create preview object URL:", error);
    return null;
  }
}

function revokePreviewObjectUrl(previewUrl: string): void {
  if (typeof URL.revokeObjectURL !== "function") {
    return;
  }
  try {
    URL.revokeObjectURL(previewUrl);
  } catch (error) {
    console.warn("Failed to revoke preview object URL:", error);
  }
}

function createLocalAssetId(fileName: string): string {
  const slug = fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "asset";
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `local-${slug}-${randomPart}`;
}
