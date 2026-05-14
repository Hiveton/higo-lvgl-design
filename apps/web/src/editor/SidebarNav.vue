<template>
  <nav class="sidebar-nav" aria-label="Editor sections">
    <button
      v-for="item in navItems"
      :key="item.id"
      class="nav-item"
      :class="{ active: activeItem === item.id }"
      :data-testid="`${item.id}-nav-button`"
      @click="$emit('activate', item.id)"
    >
      {{ item.icon }}<span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
export type SidebarNavItem = "widgets" | "layers" | "screens" | "code" | "settings";

defineProps<{
  activeItem: SidebarNavItem;
}>();

defineEmits<{
  activate: [item: SidebarNavItem];
}>();

const navItems: Array<{ id: SidebarNavItem; icon: string; label: string }> = [
  { id: "widgets", icon: "◇", label: "Widgets" },
  { id: "layers", icon: "▱", label: "Layers" },
  { id: "screens", icon: "▭", label: "Screens" },
  { id: "code", icon: "⌘", label: "Code" },
  { id: "settings", icon: "⚙", label: "Settings" }
];
</script>
