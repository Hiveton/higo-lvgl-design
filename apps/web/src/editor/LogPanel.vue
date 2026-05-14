<template>
  <div class="log-panel panel">
    <div class="tabs compact">
      <button class="tab" :class="{ active: modelValue === 'log' }" data-testid="bottom-log-tab" @click="$emit('update:modelValue', 'log')">Log</button>
      <button class="tab" :class="{ active: modelValue === 'timeline' }" data-testid="bottom-timeline-tab" @click="$emit('update:modelValue', 'timeline')">Timeline</button>
    </div>
    <template v-if="modelValue === 'log'">
      <div class="build-status" :data-testid="`build-status-${buildStatus}`">
        Build: <strong>{{ buildStatus }}</strong>
      </div>
      <button v-if="exportDownloadUrl" class="download-link" data-testid="download-export-button" @click="$emit('download-export')">
        Download LVGL C zip
      </button>
      <p v-for="entry in logEntries" :key="entry.id">{{ entry.time }} {{ entry.message }}</p>
    </template>
    <ol v-else class="timeline-list" data-testid="timeline-list">
      <li v-for="item in timelineItems" :key="item.id">
        <span>{{ item.kind }}</span>
        <strong>{{ item.label }}</strong>
        <em>{{ item.status }}</em>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
export type LogEntry = {
  id: string;
  time: string;
  message: string;
};

export type TimelineItem = {
  id: string;
  kind: string;
  label: string;
  status: string;
};

defineProps<{
  modelValue: "log" | "timeline";
  buildStatus: "idle" | "saving" | "queued" | "running" | "succeeded" | "failed";
  exportDownloadUrl: string | null;
  logEntries: LogEntry[];
  timelineItems: TimelineItem[];
}>();

defineEmits<{
  "download-export": [];
  "update:modelValue": [value: "log" | "timeline"];
}>();
</script>
