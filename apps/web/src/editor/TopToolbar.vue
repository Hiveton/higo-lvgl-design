<template>
  <header class="top-toolbar">
    <button class="icon-button" aria-label="Menu" data-testid="toolbar-menu-button" @click="projectMenuOpen = !projectMenuOpen">☰</button>
    <div v-if="projectMenuOpen" class="toolbar-project-menu" data-testid="toolbar-project-menu">
      <strong>Project</strong>
      <button class="select-like" data-testid="menu-load-projects-button" @click="emit('load-projects')">Load cloud projects</button>
      <select class="select-like" data-testid="menu-project-select" :value="project.id" @change="openProject">
        <option :value="project.id">{{ projectOptionLabel(project.id, project.name) }}</option>
        <option v-for="item in selectableProjects" :key="item.id" :value="item.id">
          {{ projectOptionLabel(item.id, item.name) }}
        </option>
      </select>
      <button class="select-like" data-testid="menu-new-project-button" @click="emit('create-project')">New Project</button>
      <button v-if="!authUser" class="select-like" data-testid="menu-demo-login-button" @click="emit('demo-login')">Demo Login</button>
    </div>
    <strong class="product-name">LVGL Online Editor</strong>
    <input
      class="select-like toolbar-input"
      data-testid="project-name-input"
      :value="project.name"
      @input="emit('rename-project', ($event.target as HTMLInputElement).value)"
    />
    <button class="select-like cloud-project-control" data-testid="load-projects-button" @click="emit('load-projects')">Load</button>
    <select class="select-like project-select cloud-project-control" data-testid="project-select" :value="project.id" @change="openProject">
      <option :value="project.id">{{ projectOptionLabel(project.id, project.name) }}</option>
      <option v-for="item in selectableProjects" :key="item.id" :value="item.id">
        {{ projectOptionLabel(item.id, item.name) }}
      </option>
    </select>
    <button class="select-like cloud-project-control" data-testid="new-project-button" @click="emit('create-project')">New Project</button>
    <label>
      Target
      <button class="select-like" data-testid="target-settings-button" @click="emit('show-settings')">{{ targetLabel }} ˅</button>
    </label>
    <label>
      Theme
      <select class="select-like" data-testid="theme-select" :value="project.theme" @change="updateTheme">
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </select>
    </label>
    <button class="icon-button" aria-label="Undo" @click="emit('undo')">↶</button>
    <button class="icon-button" aria-label="Redo" @click="emit('redo')">↷</button>
    <button
      class="icon-button"
      aria-label="Duplicate selected widget"
      data-testid="duplicate-widget-button"
      :disabled="!canDuplicateWidget"
      @click="emit('duplicate-widget')"
    >
      ⧉
    </button>
    <button class="icon-button" aria-label="Grid" data-testid="grid-toggle" :class="{ active: gridEnabled }" @click="emit('update:grid-enabled', !gridEnabled)">#</button>
    <button class="icon-button" aria-label="Snap" data-testid="snap-toggle" :class="{ active: snapEnabled }" @click="emit('update:snap-enabled', !snapEnabled)">⌖</button>
    <button class="select-like" data-testid="save-project-button" @click="emit('save-project')">Save</button>
    <span class="toolbar-spacer" />
    <span class="simulator-label">Simulator</span>
    <button
      class="simulator-toggle simulator-visibility-control"
      data-testid="simulator-toggle-button"
      :aria-pressed="simulatorVisible ? 'true' : 'false'"
      :aria-label="simulatorVisible ? 'Hide simulator' : 'Show simulator'"
      @click="emit('toggle-simulator')"
    >
      {{ simulatorVisible ? "Pause" : "Show" }}
    </button>
    <button class="primary-action" data-testid="preview-button" @click="emit('preview')">Preview</button>
    <button class="success-action" data-testid="build-button" :disabled="isBuildBusy" @click="emit('build')">
      {{ isBuildBusy ? "Building..." : "Build" }}
    </button>
    <form v-if="!authUser" class="login-form" @submit.prevent="submitLogin">
      <input v-model="loginEmail" class="select-like login-input" data-testid="login-email-input" autocomplete="username" size="1" />
      <input v-model="loginPassword" class="select-like login-input" data-testid="login-password-input" type="password" autocomplete="current-password" size="1" />
      <button class="select-like" data-testid="login-button" type="submit">Login</button>
      <button class="select-like" data-testid="demo-login-button" type="button" @click="emit('demo-login')">Demo</button>
    </form>
    <span v-else class="user-chip" data-testid="current-user">
      {{ authUser.displayName }}
      <button class="mini-action" data-testid="logout-button" @click="emit('logout')">Logout</button>
    </span>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { ProjectDoc } from "@hiveton-lvgl/schema";
import type { AuthUser } from "../api/auth";
import type { ProjectSummary } from "../api/projects";

const props = defineProps<{
  authUser: AuthUser | null;
  buildStatus: "idle" | "saving" | "queued" | "running" | "succeeded" | "failed";
  canDuplicateWidget: boolean;
  gridEnabled: boolean;
  project: ProjectDoc;
  projects: ProjectSummary[];
  simulatorVisible: boolean;
  snapEnabled: boolean;
  targetLabel: string;
}>();

const emit = defineEmits<{
  build: [];
  "create-project": [];
  "demo-login": [];
  "duplicate-widget": [];
  "load-projects": [];
  login: [email: string, password: string];
  logout: [];
  "open-project": [projectId: string];
  preview: [];
  "rename-project": [name: string];
  redo: [];
  "save-project": [];
  "show-settings": [];
  "toggle-simulator": [];
  "update:grid-enabled": [enabled: boolean];
  "update:snap-enabled": [enabled: boolean];
  "update-theme": [theme: ProjectDoc["theme"]];
  undo: [];
}>();

const loginEmail = ref("demo@hiveton.dev");
const loginPassword = ref("password");
const projectMenuOpen = ref(false);
const isBuildBusy = computed(() => props.buildStatus === "saving" || props.buildStatus === "queued" || props.buildStatus === "running");
const selectableProjects = computed(() => props.projects.filter((item) => item.id !== props.project.id));
const duplicateProjectNames = computed(() => {
  const counts = new Map<string, number>();
  for (const item of [{ id: props.project.id, name: props.project.name }, ...selectableProjects.value]) {
    const normalized = item.name.trim();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return counts;
});

function projectOptionLabel(projectId: string, name: string): string {
  if ((duplicateProjectNames.value.get(name.trim()) ?? 0) <= 1) {
    return name;
  }
  return `${name} (${shortProjectId(projectId)})`;
}

function shortProjectId(projectId: string): string {
  return projectId.length <= 12 ? projectId : projectId.slice(-8);
}

function openProject(event: Event): void {
  const projectId = (event.target as HTMLSelectElement).value;
  if (!projectId || projectId === props.project.id) {
    return;
  }
  emit("open-project", projectId);
}

function updateTheme(event: Event): void {
  const theme = (event.target as HTMLSelectElement).value;
  if (theme === "dark" || theme === "light") {
    emit("update-theme", theme);
  }
}

function submitLogin(): void {
  emit("login", loginEmail.value, loginPassword.value);
}
</script>
