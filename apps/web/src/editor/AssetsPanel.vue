<template>
  <div class="assets-panel panel">
    <div class="panel-title small asset-panel-title">
      <IconGlyph name="image" />
      <span>{{ copy.assets.title }}</span>
    </div>
    <div class="asset-tabs" role="tablist" :aria-label="copy.assets.resourceCategories">
      <button ref="assetsTabRef" class="tab" :class="{ active: activeTab === 'assets' }" data-testid="asset-assets-tab" type="button" role="tab" :aria-label="copy.assets.showAssets" :title="copy.assets.showAssets" :aria-selected="activeTab === 'assets' ? 'true' : 'false'" :tabindex="activeTab === 'assets' ? 0 : -1" @click="activeTab = 'assets'" @keydown="handleAssetTabKeydown($event, 'assets')">{{ copy.assets.assetsTab }}</button>
      <button ref="fontsTabRef" class="tab" :class="{ active: activeTab === 'fonts' }" data-testid="asset-fonts-tab" type="button" role="tab" :aria-label="copy.assets.showFonts" :title="copy.assets.showFonts" :aria-selected="activeTab === 'fonts' ? 'true' : 'false'" :tabindex="activeTab === 'fonts' ? 0 : -1" @click="activeTab = 'fonts'" @keydown="handleAssetTabKeydown($event, 'fonts')">{{ copy.assets.fontsTab }}</button>
    </div>
    <div class="asset-controls">
      <select v-model="assetKindFilter" class="select-like asset-filter" data-testid="asset-kind-filter" :aria-label="copy.assets.assetFilter" :title="copy.assets.assetFilter">
        <option value="all">{{ copy.assets.allAssets }}</option>
        <option value="image">{{ copy.assets.images }}</option>
        <option value="font">{{ copy.assets.fonts }}</option>
      </select>
      <span class="asset-view-actions">
        <button class="mini-action" :class="{ active: viewMode === 'list' }" data-testid="asset-list-view-button" :aria-label="listViewLabel" :title="listViewLabel" type="button" :aria-pressed="viewMode === 'list' ? 'true' : 'false'" @click="viewMode = 'list'"><IconGlyph name="bar" /></button>
        <button class="mini-action" :class="{ active: viewMode === 'grid' }" data-testid="asset-grid-view-button" :aria-label="gridViewLabel" :title="gridViewLabel" type="button" :aria-pressed="viewMode === 'grid' ? 'true' : 'false'" @click="viewMode = 'grid'"><IconGlyph name="grid" /></button>
        <label
          class="mini-action import-label"
          :aria-label="copy.assets.importAsset"
          :title="copy.assets.importAsset"
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
      :aria-label="copy.assets.filterResources"
      :title="copy.assets.filterResources"
      :placeholder="copy.assets.filterPlaceholder"
    />
    <div class="asset-search-meta">
      <span data-testid="asset-result-count" role="status" aria-live="polite" aria-atomic="true">{{ resourceCountLabel }}</span>
      <button v-if="assetQuery" class="mini-action" type="button" data-testid="clear-asset-search-button" :aria-label="copy.assets.clearSearch" :title="copy.assets.clearSearch" @click="clearAssetSearch">
        <IconGlyph name="close" />
      </button>
    </div>
    <div v-if="showListHeader" class="asset-list-header" data-testid="asset-list-header">
      <span>{{ copy.assets.columns.name }}</span>
      <span>{{ copy.assets.columns.type }}</span>
      <span>{{ copy.assets.columns.size }}</span>
      <span>{{ copy.assets.columns.use }}</span>
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
        <span class="asset-usage" data-asset-cell="usage">{{ copy.assets.reference }}</span>
      </div>
    </div>
    <div v-else-if="assets.length === 0" class="asset-empty" data-testid="assets-empty-state" role="status" aria-live="polite" aria-atomic="true">
      {{ copy.assets.emptyResources }}
    </div>
    <div v-else-if="filteredAssets.length === 0" class="asset-empty" data-testid="assets-empty-state" role="status" aria-live="polite" aria-atomic="true">
      {{ copy.assets.emptyAssets }}
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
        <span class="panel-kicker">{{ selectedAsset ? copy.assets.selectedResource : copy.assets.referenceResource }}</span>
        <strong>{{ selectedAsset?.name ?? visibleSelectedSampleAsset?.name }}</strong>
      </div>
      <span v-if="selectedAsset">{{ assetSummary(selectedAsset) }} · {{ usageLabel(selectedAsset.id) }}</span>
      <span v-else>{{ visibleSelectedSampleAsset ? sampleMetaLabel(visibleSelectedSampleAsset) : "" }} · {{ copy.assets.importToBind }}</span>
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
        {{ copy.assets.bindButton }}
      </button>
      <button
        v-else-if="visibleSelectedSampleAsset?.assetKind === 'image'"
        class="select-like"
        type="button"
        data-testid="import-selected-reference-button"
        :aria-label="copy.assets.importReference(visibleSelectedSampleAsset.name)"
        :title="copy.assets.importReference(visibleSelectedSampleAsset.name)"
        @click="importSampleAsset(visibleSelectedSampleAsset)"
      >
        {{ copy.assets.importReferenceButton }}
      </button>
    </div>
    <p v-if="error" id="asset-error" class="asset-error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import type { AssetRef, WidgetNode } from "@hiveton-lvgl/schema";
import { computed, ref } from "vue";
import { useCopy } from "../i18n/useCopy";
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
  "import-reference-asset": [file: File];
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
const copy = useCopy();
const listViewLabel = computed(() =>
  viewMode.value === "list" ? copy.value.assets.listActive : copy.value.assets.listView
);
const gridViewLabel = computed(() =>
  viewMode.value === "grid" ? copy.value.assets.gridActive : copy.value.assets.gridView
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
  copy.value.assets.resourceCount(displayedResourceCount.value)
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
const bindHint = computed(() => copy.value.assets.bindHint);
const bindButtonLabel = computed(() =>
  selectedAsset.value ? copy.value.assets.bindImage(selectedAsset.value.name) : copy.value.assets.bindSelectedImage
);
const bindButtonTitle = computed(() =>
  canBindSelectedImage.value ? bindButtonLabel.value : bindHint.value
);

type SampleAsset = {
  name: string;
  assetKind: AssetRef["kind"];
  kind: string;
  glyph: string;
  detail: string;
};

const sampleAssets = [
  { name: "bg.png", assetKind: "image", kind: "bg", glyph: "", detail: "120x120" },
  { name: "heart.png", assetKind: "image", kind: "heart", glyph: "♥", detail: "64x64" },
  { name: "icon_battery.png", assetKind: "image", kind: "battery", glyph: "▰", detail: "64x32" },
  { name: "icon_bt.png", assetKind: "image", kind: "bt", glyph: "⌁", detail: "64x64" },
  { name: "icon_location.png", assetKind: "image", kind: "location", glyph: "●", detail: "64x64" },
  { name: "icon_shoe.png", assetKind: "image", kind: "shoe", glyph: "◒", detail: "64x64" },
  { name: "icon_flame.png", assetKind: "image", kind: "flame", glyph: "▲", detail: "64x64" },
  { name: "logo.png", assetKind: "image", kind: "logo", glyph: "", detail: "128x128" }
] satisfies SampleAsset[];

const sampleFonts = [
  { name: "lv_font_montserrat_14", assetKind: "font", kind: "font", glyph: "Aa", detail: "14px" },
  { name: "lv_font_montserrat_20", assetKind: "font", kind: "font", glyph: "Aa", detail: "20px" },
  { name: "lv_font_montserrat_32", assetKind: "font", kind: "font", glyph: "Aa", detail: "32px" },
  { name: "lv_font_montserrat_48", assetKind: "font", kind: "font", glyph: "Aa", detail: "48px" }
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
    [sample.name, sample.kind, sampleMetaLabel(sample)]
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
  return kind === "font" ? copy.value.assets.typeFont : copy.value.assets.typeImage;
}

function sampleSizeLabel(asset: SampleAsset): string {
  return asset.detail;
}

function sampleAssetLabel(asset: SampleAsset): string {
  return copy.value.assets.selectReference(asset.name, assetTypeLabel(asset.assetKind), sampleMetaLabel(asset));
}

function sampleMetaLabel(asset: SampleAsset): string {
  return copy.value.assets.sampleMeta(assetTypeLabel(asset.assetKind), asset.detail);
}

function assetCardLabel(asset: AssetRef): string {
  return copy.value.assets.selectResource(asset.name, assetTypeLabel(asset.kind), assetSummary(asset).replace(" · ", ", "), usageLabel(asset.id));
}

function deleteAssetLabel(asset: AssetRef): string {
  return copy.value.assets.deleteAsset(asset.name);
}

function selectAsset(asset: AssetRef): void {
  selectedSampleAsset.value = null;
  selectedAssetId.value = asset.id;
}

function selectSampleAsset(asset: SampleAsset): void {
  selectedAssetId.value = null;
  selectedSampleAsset.value = asset;
}

function importSampleAsset(asset: SampleAsset): void {
  if (asset.assetKind !== "image") {
    return;
  }
  const bytes = samplePngBytes();
  const content = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(content).set(bytes);
  emit("import-reference-asset", new File([content], asset.name, { type: "image/png" }));
}

function sampleTestId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function usageLabel(assetId: string): string {
  const count = props.usageCounts[assetId] ?? 0;
  return count === 0 ? copy.value.assets.unused : copy.value.assets.used(count);
}

function samplePngBytes(): Uint8Array {
  const binary = atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lm2YpAAAAABJRU5ErkJggg==");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
</script>
