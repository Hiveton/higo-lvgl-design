<template>
  <div class="assets-panel panel">
    <div class="panel-title">Assets</div>
    <label class="select-like import-label">
      + Import
      <input data-testid="asset-file-input" type="file" accept="image/png,image/jpeg,font/ttf,font/otf,font/woff,font/woff2,.ttf,.otf,.woff,.woff2" @change="emitUpload" />
    </label>
    <input
      v-model="assetQuery"
      class="panel-search"
      data-testid="asset-search-input"
      placeholder="Filter assets..."
    />
    <div v-if="assets.length === 0" class="asset-empty" data-testid="assets-empty-state">
      No assets imported
    </div>
    <div v-else-if="filteredAssets.length === 0" class="asset-empty" data-testid="assets-empty-state">
      No matching assets
    </div>
    <div v-else class="asset-grid">
      <div v-for="asset in filteredAssets" :key="asset.id" class="asset-card">
        <div class="asset-thumb">
          <img v-if="previewUrls[asset.id]" :src="previewUrls[asset.id]" :alt="asset.name" />
          <span v-else>{{ asset.kind }}</span>
        </div>
        <strong>{{ asset.name }}</strong>
        <span>{{ assetSummary(asset) }}</span>
        <span class="asset-usage" :data-testid="`asset-usage-${asset.id}`">{{ usageLabel(asset.id) }}</span>
        <button class="mini-action" :data-testid="`delete-asset-${asset.id}`" @click="$emit('delete-asset', asset.id)">
          ×
        </button>
      </div>
    </div>
    <p v-if="error" class="asset-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import type { AssetRef } from "@hiveton-lvgl/schema";
import { computed, ref } from "vue";

const props = defineProps<{
  assets: AssetRef[];
  usageCounts: Record<string, number>;
  previewUrls: Record<string, string>;
  error: string | null;
}>();

const emit = defineEmits<{
  upload: [file: File];
  "delete-asset": [assetId: string];
}>();

const assetQuery = ref("");
const filteredAssets = computed(() => {
  const query = assetQuery.value.trim().toLowerCase();
  if (!query) {
    return props.assets;
  }
  return props.assets.filter((asset) =>
    [asset.name, asset.kind, asset.mimeType]
      .some((value) => value.toLowerCase().includes(query))
  );
});

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

function usageLabel(assetId: string): string {
  const count = props.usageCounts[assetId] ?? 0;
  return count === 0 ? "Unused" : `Used ${count}`;
}
</script>
