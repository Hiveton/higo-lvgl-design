<template>
  <aside class="widgets-panel panel">
    <div class="panel-title">Widgets</div>
    <input
      v-model="widgetSearch"
      class="panel-search"
      data-testid="widget-search-input"
      placeholder="Search widgets..."
    />
    <section v-for="group in widgetGroups" :key="group.category" class="widget-category">
      <h2>{{ group.category }}</h2>
      <div class="widget-grid">
        <button
          v-for="widget in group.widgets"
          :key="widget.type"
          class="widget-card"
          draggable="true"
          :data-testid="`widget-card-${widget.type}`"
          @dragstart="startWidgetDrag(widget.type, $event)"
          @click="$emit('add-widget', widget.type)"
        >
          <span>{{ widget.label }}</span>
        </button>
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import type { WidgetCatalogItem, WidgetType } from "@hiveton-lvgl/schema";
import { computed, ref } from "vue";

const props = defineProps<{
  catalog: WidgetCatalogItem[];
}>();

defineEmits<{
  "add-widget": [type: Exclude<WidgetType, "screen">];
}>();

const widgetSearch = ref("");

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

function startWidgetDrag(type: Exclude<WidgetType, "screen">, event: DragEvent): void {
  event.dataTransfer?.setData("application/x-lvgl-widget", type);
  event.dataTransfer?.setData("text/plain", type);
}
</script>
