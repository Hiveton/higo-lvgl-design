<template>
  <nav class="sidebar-nav" :aria-label="copy.navigation.editorSections">
    <button
      v-for="item in navItems"
      :key="item.id"
      class="nav-item"
      :class="{ active: activeItem === item.id }"
      :data-testid="`${item.id}-nav-button`"
      type="button"
      :aria-label="navItemLabel(item)"
      :title="navItemLabel(item)"
      :aria-current="activeItem === item.id ? 'page' : undefined"
      @click="$emit('activate', item.id)"
    >
      <IconGlyph :name="item.icon" />
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCopy } from "../i18n/useCopy";
import IconGlyph from "./IconGlyph.vue";

export type SidebarNavItem = "widgets" | "layers" | "screens" | "resources" | "inspector" | "code" | "settings";
type SidebarIcon = "widgets" | "layers" | "screens" | "image" | "code" | "settings";

const props = defineProps<{
  activeItem: SidebarNavItem;
}>();

defineEmits<{
  activate: [item: SidebarNavItem];
}>();

const copy = useCopy();

const navItems = computed<Array<{ id: SidebarNavItem; icon: SidebarIcon; label: string }>>(() => [
  { id: "widgets", icon: "widgets", label: copy.value.navigation.widgets },
  { id: "layers", icon: "layers", label: copy.value.navigation.layers },
  { id: "screens", icon: "screens", label: copy.value.navigation.screens },
  { id: "resources", icon: "image", label: copy.value.navigation.resources },
  { id: "inspector", icon: "settings", label: copy.value.navigation.inspector },
  { id: "code", icon: "code", label: copy.value.navigation.code },
  { id: "settings", icon: "settings", label: copy.value.navigation.settings }
]);

function navItemLabel(item: { id: SidebarNavItem; label: string }): string {
  return item.id === props.activeItem
    ? copy.value.navigation.selectedSection(item.label)
    : copy.value.navigation.openSection(item.label);
}
</script>
