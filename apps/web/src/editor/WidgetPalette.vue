<template>
  <aside class="widgets-panel panel">
    <div class="panel-title">Widgets</div>
    <input
      ref="widgetSearchInputRef"
      v-model="widgetSearch"
      class="panel-search"
      data-testid="widget-search-input"
      aria-label="Search widgets"
      title="Search widgets"
      placeholder="Search widgets..."
    />
    <div class="widget-search-meta">
      <span data-testid="widget-result-count" role="status" aria-live="polite" aria-atomic="true">{{ widgetResultCountLabel }}</span>
      <button v-if="widgetSearch" class="mini-action" type="button" data-testid="clear-widget-search-button" aria-label="Clear widget search" title="Clear widget search" @click="clearWidgetSearch">
        <IconGlyph name="close" />
      </button>
    </div>
    <div v-if="widgetGroups.length === 0" class="widget-empty-state" data-testid="widget-empty-state" role="status" aria-live="polite" aria-atomic="true">
      No widgets match "{{ widgetSearch.trim() }}".
    </div>
    <section v-for="group in widgetGroups" :key="group.category" class="widget-category">
      <h2>{{ group.category }}</h2>
      <div class="widget-grid">
        <button
          v-for="widget in group.widgets"
          :key="widget.type"
          class="widget-card"
          type="button"
          draggable="true"
          :aria-label="`Add ${widget.label} widget`"
          :title="`Add ${widget.label} widget`"
          :data-testid="`widget-card-${widget.type}`"
          @dragstart="startWidgetDrag(widget.type, $event)"
          @click="$emit('add-widget', widget.type)"
        >
          <IconGlyph :name="widgetIcon(widget.type)" />
          <span>{{ widget.label }}</span>
        </button>
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import type { WidgetCatalogItem, WidgetType } from "@hiveton-lvgl/schema";
import { computed, ref } from "vue";
import IconGlyph from "./IconGlyph.vue";

const props = defineProps<{
  catalog: WidgetCatalogItem[];
}>();

defineEmits<{
  "add-widget": [type: Exclude<WidgetType, "screen">];
}>();

const widgetSearch = ref("");
const widgetSearchInputRef = ref<HTMLInputElement | null>(null);

const widgetGroups = computed(() =>
  ["Basic", "Containers", "Charts", "Indicators", "Inputs", "Advanced"].map((category) => {
    const search = widgetSearch.value.trim().toLowerCase();
    return {
      category,
      widgets: props.catalog.filter((widget) => {
        if (widget.category !== category) {
          return false;
        }
        if (!search) {
          return true;
        }
        return `${widget.label} ${widget.type} ${widget.category}`.toLowerCase().includes(search);
      })
    };
  }).filter((group) => group.widgets.length > 0)
);
const widgetResultCount = computed(() =>
  widgetGroups.value.reduce((count, group) => count + group.widgets.length, 0)
);
const widgetResultCountLabel = computed(() =>
  `${widgetResultCount.value} ${widgetResultCount.value === 1 ? "widget" : "widgets"}`
);

function startWidgetDrag(type: Exclude<WidgetType, "screen">, event: DragEvent): void {
  event.dataTransfer?.setData("application/x-lvgl-widget", type);
  event.dataTransfer?.setData("text/plain", type);
}

function clearWidgetSearch(): void {
  widgetSearch.value = "";
  widgetSearchInputRef.value?.focus();
}

function widgetIcon(type: Exclude<WidgetType, "screen">): InstanceType<typeof IconGlyph>["$props"]["name"] {
  const icons: Record<Exclude<WidgetType, "screen">, InstanceType<typeof IconGlyph>["$props"]["name"]> = {
    arc: "spinner",
    bar: "bar",
    button: "button",
    chart: "bar",
    checkbox: "checkbox",
    container: "container",
    dropdown: "dropdown",
    image: "image",
    label: "label",
    line: "line",
    slider: "slider",
    spinner: "spinner",
    switch: "slider"
  };
  return icons[type];
}
</script>
