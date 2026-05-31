import { ref, computed, type Ref } from "vue";
import type { ProjectDoc, WidgetNode } from "@hiveton-lvgl/schema";
import { useAssetsStore } from "../stores/assets";

export function useAssetManagement(
  project: Ref<ProjectDoc>,
  selectedWidget: Ref<WidgetNode | undefined>
) {
  const assetsStore = useAssetsStore();
  const imagePreviewUrl = ref<string | null>(null);
  const pendingAssetDelete = ref<null | { assetId: string; name: string; usageCount: number }>(null);

  const fontAssets = computed(() =>
    project.value.assets.filter((asset) => asset.kind === "font")
  );

  const imageAssets = computed(() =>
    project.value.assets.filter((asset) => asset.kind === "image")
  );

  const assetUsageCounts = computed(() => {
    const usage: Record<string, number> = {};
    for (const style of project.value.styles) {
      countStyleAssetUsage(style.style, usage);
    }
    for (const screen of project.value.screens) {
      countAssetUsage(screen.root, usage);
    }
    return usage;
  });

  function countAssetUsage(widget: WidgetNode, usage: Record<string, number> = {}): Record<string, number> {
    const assetId = widget.props.assetId;
    if (widget.type === "image" && typeof assetId === "string" && assetId) {
      usage[assetId] = (usage[assetId] ?? 0) + 1;
    }
    countStyleAssetUsage(widget.style, usage);
    for (const child of widget.children) {
      countAssetUsage(child, usage);
    }
    return usage;
  }

  function countStyleAssetUsage(style: WidgetNode["style"], usage: Record<string, number>): void {
    if (typeof style.font === "string" && style.font) {
      usage[style.font] = (usage[style.font] ?? 0) + 1;
    }
  }

  function previewImage(assetId: string): void {
    const asset = project.value.assets.find((a) => a.id === assetId);
    if (asset) {
      imagePreviewUrl.value = assetsStore.previewUrls[assetId] ?? `/api/assets/${asset.objectKey}`;
    }
  }

  function clearPreview(): void {
    imagePreviewUrl.value = null;
  }

  function imagePreviewUrlForWidget(widget: WidgetNode): string | null {
    if (widget.type !== "image") {
      return null;
    }
    const assetId = String(widget.props.assetId ?? "");
    return assetsStore.previewUrls[assetId] ?? null;
  }

  function isAssetReferenced(assetId: string): boolean {
    if (project.value.styles.some((style) => style.style.font === assetId)) {
      return true;
    }
    return project.value.screens.some((screen) => widgetTreeUsesAsset(screen.root, assetId));
  }

  function widgetTreeUsesAsset(widget: WidgetNode, assetId: string): boolean {
    if (widget.type === "image" && widget.props.assetId === assetId) {
      return true;
    }
    if (widget.style.font === assetId) {
      return true;
    }
    return widget.children.some((child) => widgetTreeUsesAsset(child, assetId));
  }

  function isLocalAsset(assetId: string): boolean {
    const asset = project.value.assets.find((item) => item.id === assetId) ?? assetsStore.assets.find((item) => item.id === assetId);
    return asset?.objectKey.startsWith("local://") === true;
  }

  return {
    imagePreviewUrl,
    pendingAssetDelete,
    fontAssets,
    imageAssets,
    assetUsageCounts,
    countAssetUsage,
    countStyleAssetUsage,
    previewImage,
    clearPreview,
    imagePreviewUrlForWidget,
    isAssetReferenced,
    widgetTreeUsesAsset,
    isLocalAsset
  };
}
