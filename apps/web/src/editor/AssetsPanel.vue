<template>
  <div class="assets-panel panel">
    <div class="panel-title small asset-panel-title">
      <IconGlyph name="image" />
      <span>Resources</span>
    </div>
    <div class="asset-tabs" role="tablist" aria-label="Resource categories">
      <button ref="assetsTabRef" class="tab" :class="{ active: activeTab === 'assets' }" data-testid="asset-assets-tab" type="button" role="tab" aria-label="Show asset resources" title="Show asset resources" :aria-selected="activeTab === 'assets' ? 'true' : 'false'" :tabindex="activeTab === 'assets' ? 0 : -1" @click="activeTab = 'assets'" @keydown="handleAssetTabKeydown($event, 'assets')">Assets</button>
      <button ref="fontsTabRef" class="tab" :class="{ active: activeTab === 'fonts' }" data-testid="asset-fonts-tab" type="button" role="tab" aria-label="Show font resources" title="Show font resources" :aria-selected="activeTab === 'fonts' ? 'true' : 'false'" :tabindex="activeTab === 'fonts' ? 0 : -1" @click="activeTab = 'fonts'" @keydown="handleAssetTabKeydown($event, 'fonts')">Fonts</button>
    </div>
    <div class="asset-controls">
      <select v-model="assetKindFilter" class="select-like asset-filter" data-testid="asset-kind-filter" aria-label="Asset filter" title="Asset filter">
        <option value="all">All Assets</option>
        <option value="image">Images</option>
        <option value="font">Fonts</option>
      </select>
      <span class="asset-view-actions">
        <button class="mini-action" :class="{ active: viewMode === 'list' }" data-testid="asset-list-view-button" :aria-label="listViewLabel" :title="listViewLabel" type="button" :aria-pressed="viewMode === 'list' ? 'true' : 'false'" @click="viewMode = 'list'"><IconGlyph name="bar" /></button>
        <button class="mini-action" :class="{ active: viewMode === 'grid' }" data-testid="asset-grid-view-button" :aria-label="gridViewLabel" :title="gridViewLabel" type="button" :aria-pressed="viewMode === 'grid' ? 'true' : 'false'" @click="viewMode = 'grid'"><IconGlyph name="grid" /></button>
        <label
          class="mini-action import-label"
          aria-label="Import asset"
          title="Import asset"
          data-testid="asset-import-control"
          role="button"
          tabindex="0"
          :aria-describedby="error ? 'asset-error' : undefined"
          @keydown.enter.prevent="openAssetFileDialog"
          @keydown.space.prevent="openAssetFileDialog"
        >
          <IconGlyph name="add" />
          <input ref="assetFileInputRef" data-testid="asset-file-input" type="file" accept="image/png,image/jpeg,font/ttf,font/otf,font/woff,font/woff2,.ttf,.otf,.woff,.woff2" @change="emitUpload" />
        </label>
      </span>
    </div>
    <input
      ref="assetSearchInputRef"
      v-model="assetQuery"
      class="panel-search asset-search"
      data-testid="asset-search-input"
      aria-label="Filter resources"
      title="Filter resources"
      placeholder="Filter assets..."
    />
    <div class="asset-search-meta">
      <span data-testid="asset-result-count" role="status" aria-live="polite" aria-atomic="true">{{ resourceCountLabel }}</span>
      <button v-if="assetQuery" class="mini-action" type="button" data-testid="clear-asset-search-button" aria-label="Clear asset search" title="Clear asset search" @click="clearAssetSearch">
        <IconGlyph name="close" />
      </button>
    </div>
    <div v-if="showListHeader" class="asset-list-header" data-testid="asset-list-header">
      <span>Name</span>
      <span>Type</span>
      <span>Size</span>
      <span>Use</span>
    </div>
    <div v-if="assets.length === 0 && filteredSampleAssets.length > 0" class="asset-grid asset-grid-samples" :class="{ 'asset-list': viewMode === 'list' }" data-testid="assets-empty-state">
      <div
        v-for="sample in filteredSampleAssets"
        :key="sample.name"
        class="asset-card sample-asset"
        :class="{ selected: selectedSampleAsset?.name === sample.name }"
        :data-testid="`sample-asset-${sampleTestId(sample.name)}`"
        role="button"
        tabindex="0"
        :aria-pressed="selectedSampleAsset?.name === sample.name ? 'true' : 'false'"
        :aria-label="sampleAssetLabel(sample)"
        :title="sampleAssetLabel(sample)"
        @click="selectSampleAsset(sample)"
        @keydown.enter.prevent="selectSampleAsset(sample)"
        @keydown.space.prevent="selectSampleAsset(sample)"
      >
        <div class="asset-thumb sample-thumb" :class="sample.kind">
          <span>{{ sample.glyph }}</span>
        </div>
        <strong data-asset-cell="name">{{ sample.name }}</strong>
        <span class="asset-kind" data-asset-cell="type">{{ assetTypeLabel(sample.assetKind) }}</span>
        <span class="asset-size" data-asset-cell="size">{{ sampleSizeLabel(sample) }}</span>
        <span class="asset-usage" data-asset-cell="usage">Reference</span>
      </div>
    </div>
    <div v-else-if="assets.length === 0" class="asset-empty" data-testid="assets-empty-state" role="status" aria-live="polite" aria-atomic="true">
      No matching resources
    </div>
    <div v-else-if="filteredAssets.length === 0" class="asset-empty" data-testid="assets-empty-state" role="status" aria-live="polite" aria-atomic="true">
      No matching assets
    </div>
    <div v-else class="asset-grid" :class="{ 'asset-list': viewMode === 'list' }" data-testid="asset-results">
      <div
        v-for="asset in filteredAssets"
        :key="asset.id"
        class="asset-card"
        :class="{ selected: selectedAssetId === asset.id }"
        :data-testid="`asset-card-${asset.id}`"
        role="button"
        tabindex="0"
        :aria-pressed="selectedAssetId === asset.id ? 'true' : 'false'"
        :aria-label="assetCardLabel(asset)"
        :title="assetCardLabel(asset)"
        @click="selectAsset(asset)"
        @keydown.enter.prevent="selectAsset(asset)"
        @keydown.space.prevent="selectAsset(asset)"
      >
        <div class="asset-thumb">
          <img v-if="previewUrls[asset.id]" :src="previewUrls[asset.id]" :alt="asset.name" />
          <span v-else>{{ asset.kind }}</span>
        </div>
        <strong data-asset-cell="name">{{ asset.name }}</strong>
        <span class="asset-kind" data-asset-cell="type">{{ assetTypeLabel(asset.kind) }}</span>
        <span class="asset-size" data-asset-cell="size">{{ assetSummary(asset) }}</span>
        <span class="asset-usage" data-asset-cell="usage" :data-testid="`asset-usage-${asset.id}`">{{ usageLabel(asset.id) }}</span>
        <button class="mini-action" type="button" :data-testid="`delete-asset-${asset.id}`" :aria-label="deleteAssetLabel(asset)" :title="deleteAssetLabel(asset)" @click.stop="$emit('delete-asset', asset.id)">
          <IconGlyph name="trash" />
        </button>
      </div>
    </div>
    <div v-if="selectedAsset || visibleSelectedSampleAsset" class="asset-selection-bar" data-testid="asset-selection-bar" role="status" aria-live="polite" aria-atomic="true">
      <div>
        <span class="panel-kicker">{{ selectedAsset ? "Selected Resource" : "Reference Resource" }}</span>
        <strong>{{ selectedAsset?.name ?? visibleSelectedSampleAsset?.name }}</strong>
      </div>
      <span v-if="selectedAsset">{{ assetSummary(selectedAsset) }} · {{ usageLabel(selectedAsset.id) }}</span>
      <span v-else>{{ visibleSelectedSampleAsset?.meta }} · Import to bind</span>
      <span v-if="showBindHint" class="asset-bind-hint" data-testid="asset-bind-hint" role="status" aria-live="polite" aria-atomic="true">{{ bindHint }}</span>
      <button
        v-if="selectedAsset?.kind === 'image'"
        class="select-like"
        type="button"
        data-testid="bind-selected-asset-button"
        :disabled="!canBindSelectedImage"
        :aria-describedby="showBindHint ? 'asset-bind-hint' : undefined"
        :aria-label="bindButtonLabel"
        :title="bindButtonTitle"
        @click="$emit('bind-image-asset', selectedAsset.id)"
      >
        Bind to Image
      </button>
    </div>
    <p v-if="error" id="asset-error" class="asset-error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import type { AssetRef, WidgetNode } from "@hiveton-lvgl/schema";
import { computed, ref } from "vue";
import IconGlyph from "./IconGlyph.vue";

const props = defineProps<{
  assets: AssetRef[];
  usageCounts: Record<string, number>;
  previewUrls: Record<string, string>;
  selectedWidget: WidgetNode | null;
  error: string | null;
}>();

const emit = defineEmits<{
  upload: [file: File];
  "delete-asset": [assetId: string];
  "bind-image-asset": [assetId: string];
}>();

const assetQuery = ref("");
const assetSearchInputRef = ref<HTMLInputElement | null>(null);
const assetTabs = ["assets", "fonts"] as const;
type AssetTab = typeof assetTabs[number];
const activeTab = ref<"assets" | "fonts">("assets");
const assetsTabRef = ref<HTMLButtonElement | null>(null);
const fontsTabRef = ref<HTMLButtonElement | null>(null);
const assetTabRefs = [assetsTabRef, fontsTabRef];
const assetFileInputRef = ref<HTMLInputElement | null>(null);
const assetKindFilter = ref<"all" | AssetRef["kind"]>("all");
const viewMode = ref<"grid" | "list">("list");
const selectedAssetId = ref<string | null>(null);
const selectedSampleAsset = ref<SampleAsset | null>(null);
const listViewLabel = computed(() =>
  viewMode.value === "list" ? "Resources are shown as a list" : "Show resources as a list"
);
const gridViewLabel = computed(() =>
  viewMode.value === "grid" ? "Resources are shown as a grid" : "Show resources as a grid"
);

function handleAssetTabKeydown(event: KeyboardEvent, tab: AssetTab): void {
  const currentIndex = assetTabs.indexOf(tab);
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? assetTabs.length - 1
      : event.key === "ArrowRight"
        ? (currentIndex + 1) % assetTabs.length
        : event.key === "ArrowLeft"
          ? (currentIndex - 1 + assetTabs.length) % assetTabs.length
          : -1;
  if (nextIndex < 0) {
    return;
  }
  event.preventDefault();
  activeTab.value = assetTabs[nextIndex];
  assetTabRefs[nextIndex].value?.focus();
}

function clearAssetSearch(): void {
  assetQuery.value = "";
  assetSearchInputRef.value?.focus();
}

function openAssetFileDialog(): void {
  assetFileInputRef.value?.click();
}

const filteredAssets = computed(() => {
  const query = assetQuery.value.trim().toLowerCase();
  return props.assets.filter((asset) =>
    matchesActiveTab(asset) &&
    matchesKindFilter(asset) &&
    (!query ||
    [asset.name, asset.kind, asset.mimeType]
      .some((value) => value.toLowerCase().includes(query))
    )
  );
});
const selectedAsset = computed(() =>
  props.assets.find((asset) => asset.id === selectedAssetId.value) ?? null
);
const displayedResourceCount = computed(() =>
  props.assets.length === 0 ? filteredSampleAssets.value.length : filteredAssets.value.length
);
const resourceCountLabel = computed(() =>
  `${displayedResourceCount.value} ${displayedResourceCount.value === 1 ? "resource" : "resources"}`
);
const showListHeader = computed(() =>
  viewMode.value === "list" &&
  ((props.assets.length === 0 && filteredSampleAssets.value.length > 0) ||
    (props.assets.length > 0 && filteredAssets.value.length > 0))
);
const visibleSelectedSampleAsset = computed(() =>
  filteredSampleAssets.value.find((sample) => sample.name === selectedSampleAsset.value?.name) ?? null
);
const canBindSelectedImage = computed(() =>
  Boolean(selectedAsset.value?.kind === "image" && props.selectedWidget?.type === "image" && !props.selectedWidget.locked)
);
const showBindHint = computed(() =>
  Boolean(selectedAsset.value?.kind === "image" && !canBindSelectedImage.value)
);
const bindHint = "Select an unlocked image widget to bind this resource.";
const bindButtonLabel = computed(() =>
  selectedAsset.value ? `Bind ${selectedAsset.value.name} to selected image widget` : "Bind selected resource to selected image widget"
);
const bindButtonTitle = computed(() =>
  canBindSelectedImage.value ? bindButtonLabel.value : bindHint
);

type SampleAsset = {
  name: string;
  assetKind: AssetRef["kind"];
  kind: string;
  glyph: string;
  meta: string;
};

const sampleAssets = [
  { name: "bg.png", assetKind: "image", kind: "bg", glyph: "", meta: "image 120x120" },
  { name: "heart.png", assetKind: "image", kind: "heart", glyph: "♥", meta: "image 64x64" },
  { name: "icon_battery.png", assetKind: "image", kind: "battery", glyph: "▰", meta: "image 64x32" },
  { name: "icon_bt.png", assetKind: "image", kind: "bt", glyph: "⌁", meta: "image 64x64" },
  { name: "icon_location.png", assetKind: "image", kind: "location", glyph: "●", meta: "image 64x64" },
  { name: "icon_shoe.png", assetKind: "image", kind: "shoe", glyph: "◒", meta: "image 64x64" },
  { name: "icon_flame.png", assetKind: "image", kind: "flame", glyph: "▲", meta: "image 64x64" },
  { name: "logo.png", assetKind: "image", kind: "logo", glyph: "", meta: "image 128x128" }
] satisfies SampleAsset[];

const sampleFonts = [
  { name: "lv_font_montserrat_14", assetKind: "font", kind: "font", glyph: "Aa", meta: "font 14px" },
  { name: "lv_font_montserrat_20", assetKind: "font", kind: "font", glyph: "Aa", meta: "font 20px" },
  { name: "lv_font_montserrat_32", assetKind: "font", kind: "font", glyph: "Aa", meta: "font 32px" },
  { name: "lv_font_montserrat_48", assetKind: "font", kind: "font", glyph: "Aa", meta: "font 48px" }
 ] satisfies SampleAsset[];

const visibleSampleAssets = computed(() => {
  const candidates = activeTab.value === "fonts" ? sampleFonts : sampleAssets;
  if (assetKindFilter.value === "all") {
    return candidates;
  }
  return candidates.filter((sample) => sample.assetKind === assetKindFilter.value);
});
const filteredSampleAssets = computed(() => {
  const query = assetQuery.value.trim().toLowerCase();
  return visibleSampleAssets.value.filter((sample) =>
    !query ||
    [sample.name, sample.kind, sample.meta]
      .some((value) => value.toLowerCase().includes(query))
  );
});

function matchesActiveTab(asset: AssetRef): boolean {
  return activeTab.value === "fonts" ? asset.kind === "font" : true;
}

function matchesKindFilter(asset: AssetRef): boolean {
  return assetKindFilter.value === "all" ? true : asset.kind === assetKindFilter.value;
}

function emitUpload(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    emit("upload", file);
  }
  input.value = "";
}

function assetSummary(asset: AssetRef): string {
  const size = `${Math.max(1, Math.round(asset.sizeBytes / 1024))} KB`;
  if (asset.width && asset.height) {
    return `${asset.width}x${asset.height} · ${size}`;
  }
  return size;
}

function assetTypeLabel(kind: AssetRef["kind"]): string {
  return kind === "font" ? "Font" : "Image";
}

function sampleSizeLabel(asset: SampleAsset): string {
  return asset.meta.replace(`${asset.assetKind} `, "");
}

function sampleAssetLabel(asset: SampleAsset): string {
  return `Select reference resource ${asset.name}, ${assetTypeLabel(asset.assetKind)}, ${asset.meta}`;
}

function assetCardLabel(asset: AssetRef): string {
  return `Select resource ${asset.name}, ${assetTypeLabel(asset.kind)}, ${assetSummary(asset).replace(" · ", ", ")}, ${usageLabel(asset.id)}`;
}

function deleteAssetLabel(asset: AssetRef): string {
  return `Delete ${asset.name} resource`;
}

function selectAsset(asset: AssetRef): void {
  selectedSampleAsset.value = null;
  selectedAssetId.value = asset.id;
}

function selectSampleAsset(asset: SampleAsset): void {
  selectedAssetId.value = null;
  selectedSampleAsset.value = asset;
}

function sampleTestId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function usageLabel(assetId: string): string {
  const count = props.usageCounts[assetId] ?? 0;
  return count === 0 ? "Unused" : `Used ${count}`;
}
</script>
