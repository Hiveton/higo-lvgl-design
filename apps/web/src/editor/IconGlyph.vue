<template>
  <svg class="icon-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false" :data-icon-name="name">
    <path v-for="path in paths" :key="path" :d="path" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

type IconName =
  | "add"
  | "arrowDown"
  | "arrowUp"
  | "bar"
  | "button"
  | "checkbox"
  | "code"
  | "container"
  | "copy"
  | "close"
  | "crosshair"
  | "dropdown"
  | "download"
  | "eye"
  | "eyeOff"
  | "fit"
  | "folder"
  | "fullscreen"
  | "grid"
  | "image"
  | "label"
  | "layers"
  | "line"
  | "lock"
  | "logout"
  | "menu"
  | "paste"
  | "camera"
  | "redo"
  | "refresh"
  | "save"
  | "screens"
  | "settings"
  | "slider"
  | "spinner"
  | "trash"
  | "undo"
  | "unlock"
  | "widgets";

const props = defineProps<{
  name: IconName;
}>();

const iconPaths: Record<IconName, string[]> = {
  add: ["M12 5v14", "M5 12h14"],
  arrowDown: ["M12 5v14", "M7 14l5 5 5-5"],
  arrowUp: ["M12 19V5", "M7 10l5-5 5 5"],
  bar: ["M5 12h14", "M5 8h14", "M5 16h14"],
  button: ["M5 8h14v8H5z", "M9 12h6"],
  checkbox: ["M5 5h14v14H5z", "M8 12l3 3 5-6"],
  code: ["M8 9l-3 3 3 3", "M16 9l3 3-3 3", "M14 5l-4 14"],
  container: ["M4 5h16v14H4z", "M8 9h8", "M8 13h5"],
  copy: ["M9 9h10v10H9z", "M5 15H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  crosshair: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0"],
  dropdown: ["M5 7h14v10H5z", "M9 11l3 3 3-3"],
  download: ["M12 4v10", "M7 10l5 5 5-5", "M5 20h14"],
  eye: ["M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z", "M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0"],
  eyeOff: ["M3 3l18 18", "M10.6 10.6a3 3 0 0 0 4 4", "M8.5 5.7A10.7 10.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a14 14 0 0 1-2.2 2.8", "M6.2 6.9C3.9 8.4 2.5 12 2.5 12s3.5 6.5 9.5 6.5a10.6 10.6 0 0 0 4-.8"],
  fit: ["M8 3H4a1 1 0 0 0-1 1v4", "M16 3h4a1 1 0 0 1 1 1v4", "M8 21H4a1 1 0 0 1-1-1v-4", "M16 21h4a1 1 0 0 0 1-1v-4", "M8 8h8v8H8z"],
  folder: ["M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z", "M3 7V6a2 2 0 0 1 2-2h5l2 3"],
  fullscreen: ["M8 3H3v5", "M16 3h5v5", "M8 21H3v-5", "M16 21h5v-5"],
  grid: ["M4 4h16v16H4z", "M4 9h16", "M4 15h16", "M9 4v16", "M15 4v16"],
  image: ["M4 5h16v14H4z", "M8 13l3-3 3 4 2-2 3 4", "M8 9h.01"],
  label: ["M6 17V7", "M6 7h12", "M10 7v10", "M8 17h4"],
  layers: ["M12 3 3 8l9 5 9-5-9-5Z", "M5 12l7 4 7-4", "M5 16l7 4 7-4"],
  line: ["M5 17L19 7"],
  lock: ["M7 10V8a5 5 0 0 1 10 0v2", "M6 10h12v10H6z"],
  logout: ["M10 6H6v12h4", "M14 8l4 4-4 4", "M18 12H9"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  paste: ["M8 5h8v3H8z", "M6 7H5a1 1 0 0 0-1 1v12h16V8a1 1 0 0 0-1-1h-1", "M8 12h8", "M8 16h6"],
  camera: ["M5 7h3l1.5-2h5L16 7h3v12H5V7Z", "M9 13a3 3 0 1 0 6 0 3 3 0 0 0-6 0"],
  redo: ["M17 7h-6a6 6 0 1 0 5.2 9", "M17 7v5h-5"],
  refresh: ["M20 7v5h-5", "M4 17v-5h5", "M18.2 10a6 6 0 0 0-10-3.2L4 12", "M5.8 14a6 6 0 0 0 10 3.2L20 12"],
  save: ["M5 4h12l2 2v14H5V4Z", "M8 4v6h8V4", "M8 20v-6h8v6"],
  screens: ["M4 5h16v11H4z", "M9 20h6", "M12 16v4"],
  settings: ["M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z", "M19.4 15a8.4 8.4 0 0 0 .1-1l2-1.5-2-3.5-2.4 1a7.7 7.7 0 0 0-1.7-1L15 6.5h-6L8.6 9a7.7 7.7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8.4 8.4 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a7.7 7.7 0 0 0 1.7 1l.4 2.5h6l.4-2.5a7.7 7.7 0 0 0 1.7-1l2.4 1 2-3.5-2.2-2Z"],
  slider: ["M4 12h16", "M8 8v8", "M16 8v8"],
  spinner: ["M12 5a7 7 0 1 1-6.1 3.6", "M6 5v4h4"],
  trash: ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 14h10l1-14", "M9 7V4h6v3"],
  undo: ["M7 7h6a6 6 0 1 1-5.2 9", "M7 7v5h5"],
  unlock: ["M8 10V8a4 4 0 0 1 7.5-2", "M6 10h12v10H6z"],
  widgets: ["M12 3l7 7-7 7-7-7 7-7Z", "M12 17v4", "M7 21h10"]
};

const paths = computed(() => iconPaths[props.name]);
</script>
