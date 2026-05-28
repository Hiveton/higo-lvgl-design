<template>
  <div class="log-panel panel">
    <div class="tabs compact" role="tablist" :aria-label="copy.bottomDock.sections">
      <button
        class="tab"
        :class="{ active: modelValue === 'log' }"
        ref="logTabRef"
        data-testid="bottom-log-tab"
        type="button"
        role="tab"
        :aria-selected="modelValue === 'log' ? 'true' : 'false'"
        :tabindex="modelValue === 'log' ? 0 : -1"
        @click="$emit('update:modelValue', 'log')"
        @keydown="handleBottomTabKeydown($event, 'log')"
      >
        {{ copy.bottomDock.console }}
      </button>
      <button
        class="tab"
        :class="{ active: modelValue === 'timeline' }"
        ref="timelineTabRef"
        data-testid="bottom-timeline-tab"
        type="button"
        role="tab"
        :aria-selected="modelValue === 'timeline' ? 'true' : 'false'"
        :tabindex="modelValue === 'timeline' ? 0 : -1"
        @click="$emit('update:modelValue', 'timeline')"
        @keydown="handleBottomTabKeydown($event, 'timeline')"
      >
        {{ copy.bottomDock.build }}
      </button>
    </div>
    <template v-if="modelValue === 'log'">
      <div class="build-status" :data-testid="`build-status-${buildStatus}`" role="status" aria-live="polite" aria-atomic="true">
        {{ copy.bottomDock.buildLabel }} <strong>{{ localizedBuildStatus }}</strong>
      </div>
      <button v-if="exportDownloadUrl" class="icon-button download-link" type="button" data-testid="download-export-button" :aria-label="downloadExportLabel" :title="downloadExportLabel" @click="$emit('download-export')">
        <IconGlyph name="download" />
      </button>
      <p v-if="logEntries.length === 0" class="log-empty" data-testid="console-empty-state" role="status" aria-live="polite" aria-atomic="true">{{ copy.bottomDock.emptyConsole }}</p>
      <template v-else>
        <div class="console-list-header" data-testid="console-list-header">
          <span>{{ copy.bottomDock.logColumns.time }}</span>
          <span>{{ copy.bottomDock.logColumns.message }}</span>
        </div>
        <ol class="log-stream" data-testid="console-log-stream" role="status" aria-live="polite" aria-atomic="false">
          <li v-for="entry in logEntries" :key="entry.id" class="log-entry" data-testid="console-log-entry">
            <time data-log-cell="time">{{ entry.time }}</time>
            <span data-log-cell="message">{{ entry.message }}</span>
          </li>
        </ol>
      </template>
    </template>
    <template v-else>
      <div class="build-summary" :class="`build-summary-${buildStatus}`" data-testid="build-summary" role="status" aria-live="polite" aria-atomic="true">
        <span>{{ copy.bottomDock.buildStatus }}</span>
        <strong>{{ localizedBuildStatus }}</strong>
        <p v-if="latestBuildMessage" class="build-last-log" data-testid="build-last-log">
          {{ latestBuildMessage }}
        </p>
        <button v-if="exportDownloadUrl" class="icon-button download-link compact-download" type="button" data-testid="download-export-build-tab-button" :aria-label="downloadExportLabel" :title="downloadExportLabel" @click="$emit('download-export')">
          <IconGlyph name="download" />
        </button>
      </div>
      <h3 class="timeline-heading">{{ copy.bottomDock.projectActivity }}</h3>
      <p v-if="timelineItems.length === 0" class="log-empty" data-testid="timeline-empty-state" role="status" aria-live="polite" aria-atomic="true">{{ copy.bottomDock.emptyTimeline }}</p>
      <template v-else>
        <div class="timeline-list-header" data-testid="timeline-list-header">
          <span>{{ copy.bottomDock.timelineColumns.kind }}</span>
          <span>{{ copy.bottomDock.timelineColumns.item }}</span>
          <span>{{ copy.bottomDock.timelineColumns.status }}</span>
        </div>
        <ol class="timeline-list" data-testid="timeline-list">
          <li v-for="item in timelineItems" :key="item.id">
            <span data-timeline-cell="kind" class="timeline-kind" :class="`timeline-kind-${item.kind.toLowerCase()}`" :data-testid="`timeline-kind-${item.kind.toLowerCase()}`">{{ timelineKindLabel(item.kind) }}</span>
            <strong data-timeline-cell="item">{{ item.label }}</strong>
            <em data-timeline-cell="status" class="timeline-status" data-testid="timeline-status">{{ timelineStatusLabel(item.status) }}</em>
          </li>
        </ol>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useCopy } from "../i18n/useCopy";
import IconGlyph from "./IconGlyph.vue";

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

const props = defineProps<{
  modelValue: "log" | "timeline";
  buildStatus: "idle" | "saving" | "queued" | "running" | "succeeded" | "failed";
  exportDownloadUrl: string | null;
  logEntries: LogEntry[];
  projectName: string;
  timelineItems: TimelineItem[];
}>();

const emit = defineEmits<{
  "download-export": [];
  "update:modelValue": [value: "log" | "timeline"];
}>();

const bottomTabs = ["log", "timeline"] as const;
type BottomTab = typeof bottomTabs[number];
const logTabRef = ref<HTMLButtonElement | null>(null);
const timelineTabRef = ref<HTMLButtonElement | null>(null);
const bottomTabRefs = [logTabRef, timelineTabRef];
const copy = useCopy();
const downloadExportLabel = computed(() => copy.value.bottomDock.downloadExport(props.projectName));
const localizedBuildStatus = computed(() => copy.value.bottomDock.buildStatusLabels[props.buildStatus]);

function handleBottomTabKeydown(event: KeyboardEvent, tab: BottomTab): void {
  const currentIndex = bottomTabs.indexOf(tab);
  const nextIndex = event.key === "ArrowRight"
    ? (currentIndex + 1) % bottomTabs.length
    : event.key === "ArrowLeft"
      ? (currentIndex - 1 + bottomTabs.length) % bottomTabs.length
      : -1;
  if (nextIndex < 0) {
    return;
  }
  event.preventDefault();
  emit("update:modelValue", bottomTabs[nextIndex]);
  bottomTabRefs[nextIndex].value?.focus();
}

const latestBuildMessage = computed(() => {
  const exportFeedback = [...props.logEntries]
    .reverse()
    .find((entry) => entry.id === "log-export-downloaded" || entry.id === "log-export-download-failed");
  return exportFeedback?.message ?? props.logEntries.at(-1)?.message ?? "";
});

function timelineKindLabel(kind: string): string {
  return copy.value.bottomDock.timelineKinds[kind as keyof typeof copy.value.bottomDock.timelineKinds] ?? kind;
}

function timelineStatusLabel(status: string): string {
  return copy.value.bottomDock.timelineStatuses[status as keyof typeof copy.value.bottomDock.timelineStatuses] ?? status;
}
</script>
