<template>
  <nav class="sidebar-nav" aria-label="Editor sections">
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
import IconGlyph from "./IconGlyph.vue";

export type SidebarNavItem = "widgets" | "layers" | "screens" | "resources" | "inspector" | "code" | "settings";
type SidebarIcon = "widgets" | "layers" | "screens" | "image" | "code" | "settings";

const props = defineProps<{
  activeItem: SidebarNavItem;
}>();

defineEmits<{
  activate: [item: SidebarNavItem];
}>();

const navItems: Array<{ id: SidebarNavItem; icon: SidebarIcon; label: string }> = [
  { id: "widgets", icon: "widgets", label: "Widgets" },
  { id: "layers", icon: "layers", label: "Layers" },
  { id: "screens", icon: "screens", label: "Screens" },
  { id: "resources", icon: "image", label: "Resources" },
  { id: "inspector", icon: "settings", label: "Inspector" },
  { id: "code", icon: "code", label: "Code" },
  { id: "settings", icon: "settings", label: "Settings" }
];

function navItemLabel(item: { id: SidebarNavItem; label: string }): string {
  return item.id === props.activeItem ? `${item.label} section selected` : `Open ${item.label} section`;
}
</script>
