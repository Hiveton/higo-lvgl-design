<template>
  <header ref="toolbarRef" class="top-toolbar">
    <div class="menu-bar">
      <button
        class="icon-button menu-button"
        type="button"
        :class="{ active: projectMenuOpen }"
        :aria-label="projectMenuButtonLabel"
        :title="projectMenuButtonLabel"
        aria-haspopup="menu"
        :aria-expanded="projectMenuOpen ? 'true' : 'false'"
        data-testid="toolbar-menu-button"
        ref="projectMenuButtonRef"
        @click.stop="toggleProjectMenu"
        @keydown="handleProjectMenuButtonKeydown"
      >
        <IconGlyph name="menu" />
      </button>
      <strong class="product-name">LVGL Online Editor</strong>
      <nav class="desktop-menu-strip" aria-label="Application menus">
        <span v-for="menu in desktopMenus" :key="menu.id" class="desktop-menu-item">
          <button
            type="button"
            :class="{ active: activeDesktopMenu === menu.id }"
            :aria-label="desktopMenuButtonLabel(menu)"
            aria-haspopup="menu"
            :aria-expanded="activeDesktopMenu === menu.id ? 'true' : 'false'"
            :title="desktopMenuButtonLabel(menu)"
            :data-testid="`desktop-menu-${menu.id}-button`"
            :ref="(element) => setDesktopMenuButtonRef(menu.id, element)"
            @click.stop="toggleDesktopMenu(menu.id)"
            @keydown="handleDesktopMenuKeydown($event, menu.id)"
            @mouseenter="switchDesktopMenuOnHover(menu.id)"
          >
            {{ menu.label }}
          </button>
          <div v-if="activeDesktopMenu === menu.id" class="desktop-menu-popover" role="menu" :data-testid="`desktop-menu-${menu.id}-popover`">
            <template v-for="item in menu.items" :key="item.id">
              <div v-if="item.kind === 'divider'" class="desktop-menu-divider" role="separator" />
              <button
                v-else
                class="desktop-menu-command"
                type="button"
                role="menuitem"
                :disabled="item.disabled"
                :data-testid="`desktop-menu-command-${item.id}`"
                :ref="(element) => setDesktopMenuCommandRef(menu.id, item.id, element)"
                @click="runDesktopMenuCommand(menu.id, item.action)"
                @keydown="handleDesktopMenuCommandKeydown($event, menu.id, item.id)"
              >
                <span>{{ item.label }}</span>
                <kbd v-if="item.shortcut">{{ item.shortcut }}</kbd>
              </button>
            </template>
          </div>
        </span>
      </nav>
      <span class="toolbar-spacer" />
      <span class="window-dot" aria-hidden="true" />
      <span class="window-dot square" aria-hidden="true" />
      <span class="window-dot close" aria-hidden="true" />
      <div v-if="projectMenuOpen" ref="projectMenuRef" class="toolbar-project-menu" role="menu" data-testid="toolbar-project-menu">
        <div class="project-menu-heading">
          <div>
            <div class="menu-section-title">Project</div>
            <strong>{{ project.name }}</strong>
          </div>
          <span data-testid="menu-project-count">{{ selectableProjects.length }} cloud</span>
        </div>
        <button ref="projectMenuFirstActionRef" class="select-like" type="button" role="menuitem" data-testid="menu-load-projects-button" aria-label="Refresh cloud projects" title="Refresh cloud projects" @click="loadProjectsFromMenu" @keydown="handleProjectMenuItemKeydown">Refresh cloud projects</button>
        <select class="select-like" role="menuitem" data-testid="menu-project-select" aria-label="Open cloud project from menu" title="Open cloud project from menu" :disabled="selectableProjects.length === 0" :value="project.id" @change="openProject" @keydown="handleProjectMenuItemKeydown">
          <option :value="project.id">{{ currentProjectLabel }}</option>
          <option v-for="item in selectableProjects" :key="item.id" :value="item.id">
            {{ projectOptionLabel(item.id, item.name) }}
          </option>
        </select>
        <p v-if="selectableProjects.length === 0" class="project-menu-empty" data-testid="menu-project-empty-state" role="status" aria-live="polite" aria-atomic="true">
          No cloud projects loaded yet.
        </p>
        <button class="select-like" type="button" role="menuitem" data-testid="menu-new-project-button" aria-label="Create cloud project" title="Create cloud project" @click="createProjectFromMenu" @keydown="handleProjectMenuItemKeydown">Create cloud project</button>
        <form v-if="!authUser" class="project-menu-login-form" data-testid="menu-login-form" @submit.prevent="submitLogin">
          <input v-model="loginEmail" class="select-like" data-testid="menu-login-email-input" aria-label="Email for cloud login" title="Email for cloud login" placeholder="Email" autocomplete="username" :aria-invalid="authError ? 'true' : undefined" :aria-describedby="authError ? 'project-menu-login-error' : undefined" @input="clearLoginError" @keydown="handleProjectMenuItemKeydown" />
          <input v-model="loginPassword" class="select-like" data-testid="menu-login-password-input" aria-label="Password for cloud login" title="Password for cloud login" placeholder="Password" type="password" autocomplete="current-password" :aria-invalid="authError ? 'true' : undefined" :aria-describedby="authError ? 'project-menu-login-error' : undefined" @input="clearLoginError" @keydown="handleProjectMenuItemKeydown" />
          <button class="select-like" type="submit" data-testid="menu-login-button" aria-label="Log in from project menu" title="Log in from project menu" @keydown="handleProjectMenuItemKeydown">Login</button>
          <p v-if="authError" id="project-menu-login-error" class="login-error project-menu-login-error" data-testid="menu-login-error" role="alert">{{ authError }}</p>
        </form>
        <button v-if="!authUser" class="select-like" type="button" role="menuitem" data-testid="menu-demo-login-button" aria-label="Use demo account" title="Use demo account" @click="demoLoginFromMenu" @keydown="handleProjectMenuItemKeydown">Demo Login</button>
      </div>
    </div>
    <div class="command-bar">
      <div class="command-group">
        <button class="tool-button" type="button" data-testid="new-project-button" aria-label="New project" title="New project" @click="emit('create-project')"><IconGlyph name="add" /><span class="tool-label">New</span></button>
        <button class="tool-button" type="button" data-testid="load-projects-button" aria-label="Open cloud project" title="Open cloud project" @click="emit('load-projects')"><IconGlyph name="folder" /><span class="tool-label">Open</span></button>
        <button class="tool-button" type="button" data-testid="save-project-button" :aria-label="saveProjectLabel" :title="saveProjectLabel" @click="emit('save-project')"><IconGlyph name="save" /><span class="tool-label">Save</span></button>
      </div>
      <div class="command-group">
        <button class="tool-button" type="button" data-testid="undo-button" aria-label="Undo" title="Undo" :disabled="!canUndo" @click="emit('undo')"><IconGlyph name="undo" /><span class="tool-label">Undo</span></button>
        <button class="tool-button" type="button" data-testid="redo-button" aria-label="Redo" title="Redo" :disabled="!canRedo" @click="emit('redo')"><IconGlyph name="redo" /><span class="tool-label">Redo</span></button>
        <button class="tool-button" type="button" :aria-label="copyWidgetLabel" :title="copyWidgetLabel" data-testid="copy-widget-button" :disabled="!canCopyWidget" @click="emit('copy-widget')"><IconGlyph name="copy" /><span class="tool-label">Copy</span></button>
        <button class="tool-button" type="button" :aria-label="pasteWidgetLabel" :title="pasteWidgetLabel" data-testid="paste-widget-button" :disabled="!canPasteWidget" @click="emit('paste-widget')"><IconGlyph name="paste" /><span class="tool-label">Paste</span></button>
        <button class="tool-button" type="button" :aria-label="deleteWidgetLabel" :title="deleteWidgetLabel" data-testid="delete-widget-button" :disabled="!canDeleteWidget" @click="emit('delete-widget')"><IconGlyph name="trash" /><span class="tool-label">Delete</span></button>
      </div>
      <div class="command-group compact-tools">
        <button class="icon-button" type="button" :aria-label="gridToggleLabel" :title="gridToggleLabel" data-testid="grid-toggle" :aria-pressed="gridEnabled ? 'true' : 'false'" :class="{ active: gridEnabled }" @click="emit('update:grid-enabled', !gridEnabled)"><IconGlyph name="grid" /></button>
        <button class="icon-button" type="button" :aria-label="snapToggleLabel" :title="snapToggleLabel" data-testid="snap-toggle" :aria-pressed="snapEnabled ? 'true' : 'false'" :class="{ active: snapEnabled }" @click="emit('update:snap-enabled', !snapEnabled)"><IconGlyph name="crosshair" /></button>
      </div>
      <span class="toolbar-spacer" />
      <button class="simulator-toggle simulator-visibility-control" type="button" data-testid="simulator-toggle-button" :aria-pressed="simulatorVisible ? 'true' : 'false'" :aria-label="simulatorVisible ? 'Hide simulator' : 'Show simulator'" :title="simulatorVisible ? 'Hide simulator' : 'Show simulator'" @click="emit('toggle-simulator')">
        {{ simulatorVisible ? "Simulator" : "Show Sim" }}
      </button>
      <button class="primary-action" type="button" data-testid="preview-button" aria-label="Preview current screen" title="Preview current screen" @click="emit('preview')">Preview</button>
      <label class="project-control">
        Project
        <input
          class="select-like toolbar-input"
          data-testid="project-name-input"
          aria-label="Project name"
          title="Project name"
          :value="project.name"
          @input="emit('rename-project', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <select class="select-like project-select cloud-project-control" data-testid="project-select" aria-label="Open cloud project" title="Open cloud project" :value="project.id" @change="openProject">
        <option :value="project.id">{{ projectOptionLabel(project.id, project.name) }}</option>
        <option v-for="item in selectableProjects" :key="item.id" :value="item.id">
          {{ projectOptionLabel(item.id, item.name) }}
        </option>
      </select>
      <label>
        Target
        <button class="select-like" type="button" data-testid="target-settings-button" :aria-label="`Open target settings for ${targetLabel}`" :title="`Open target settings for ${targetLabel}`" @click="emit('show-settings')">{{ targetLabel }} ˅</button>
      </label>
      <label>
        Theme
        <select class="select-like" data-testid="theme-select" aria-label="Project theme" title="Project theme" :value="project.theme" @change="updateTheme">
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </label>
      <button
        class="success-action"
        type="button"
        data-testid="build-button"
        :disabled="buildDisabled"
        :aria-label="buildButtonTitle"
        :title="buildButtonTitle"
        @click="emit('build')"
      >
        {{ buildButtonLabel }}
      </button>
      <form v-if="!authUser" class="login-form" @submit.prevent="submitLogin">
        <input v-model="loginEmail" class="select-like login-input" data-testid="login-email-input" aria-label="Email" title="Email" placeholder="Email" autocomplete="username" size="1" :aria-invalid="authError ? 'true' : undefined" :aria-describedby="authError ? 'toolbar-login-error' : undefined" @input="clearLoginError" />
        <input v-model="loginPassword" class="select-like login-input" data-testid="login-password-input" aria-label="Password" title="Password" placeholder="Password" type="password" autocomplete="current-password" size="1" :aria-invalid="authError ? 'true' : undefined" :aria-describedby="authError ? 'toolbar-login-error' : undefined" @input="clearLoginError" />
        <button class="select-like" data-testid="login-button" type="submit" aria-label="Log in" title="Log in">Login</button>
        <button class="select-like" data-testid="demo-login-button" type="button" aria-label="Use demo account" title="Use demo account" @click="emit('demo-login')">Demo</button>
        <p v-if="authError" id="toolbar-login-error" class="login-error" data-testid="login-error" role="alert">{{ authError }}</p>
      </form>
      <span v-else class="user-chip" data-testid="current-user">
        {{ authUser.displayName }}
        <button class="mini-action" data-testid="logout-button" type="button" aria-label="Logout" title="Logout" @click="emit('logout')"><IconGlyph name="logout" /></button>
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { ProjectDoc } from "@hiveton-lvgl/schema";
import type { AuthUser } from "../api/auth";
import type { ProjectSummary } from "../api/projects";
import IconGlyph from "./IconGlyph.vue";

const props = defineProps<{
  authError: string | null;
  authUser: AuthUser | null;
  buildStatus: "idle" | "saving" | "queued" | "running" | "succeeded" | "failed";
  canBuildProject: boolean;
  canCopyWidget: boolean;
  canDeleteWidget: boolean;
  canPasteWidget: boolean;
  canRedo: boolean;
  canUndo: boolean;
  copiedWidgetName?: string;
  gridEnabled: boolean;
  project: ProjectDoc;
  projects: ProjectSummary[];
  selectedWidgetName?: string;
  simulatorVisible: boolean;
  snapEnabled: boolean;
  targetLabel: string;
}>();

const emit = defineEmits<{
  build: [];
  "clear-auth-error": [];
  "create-project": [];
  "demo-login": [];
  "copy-widget": [];
  "delete-widget": [];
  "load-projects": [];
  login: [email: string, password: string];
  logout: [];
  "open-project": [projectId: string];
  "paste-widget": [];
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
const activeDesktopMenu = ref<DesktopMenuId | null>(null);
const hoverActivatedDesktopMenu = ref<DesktopMenuId | null>(null);
const toolbarRef = ref<HTMLElement | null>(null);
const projectMenuRef = ref<HTMLElement | null>(null);
const projectMenuButtonRef = ref<HTMLButtonElement | null>(null);
const projectMenuFirstActionRef = ref<HTMLButtonElement | null>(null);
const desktopMenuButtonRefs = ref<Partial<Record<DesktopMenuId, HTMLButtonElement>>>({});
const desktopMenuCommandRefs = ref<Partial<Record<DesktopMenuId, Record<string, HTMLButtonElement>>>>({});
const isBuildBusy = computed(() => props.buildStatus === "saving" || props.buildStatus === "queued" || props.buildStatus === "running");
const buildDisabled = computed(() => !props.canBuildProject || isBuildBusy.value);
const copyWidgetLabel = computed(() =>
  props.selectedWidgetName ? `Copy ${props.selectedWidgetName} widget` : "Copy selected widget"
);
const pasteWidgetLabel = computed(() =>
  props.copiedWidgetName ? `Paste ${props.copiedWidgetName} widget` : "Paste copied widget"
);
const deleteWidgetLabel = computed(() =>
  props.selectedWidgetName ? `Delete ${props.selectedWidgetName} widget` : "Delete selected widget"
);
const saveProjectLabel = computed(() => `Save ${props.project.name} project`);
const gridToggleLabel = computed(() => (props.gridEnabled ? "Hide Grid" : "Show Grid"));
const snapToggleLabel = computed(() => (props.snapEnabled ? "Disable Snap" : "Enable Snap"));
const buildButtonLabel = computed(() => {
  if (!props.canBuildProject) {
    return "Login to Build";
  }
  return isBuildBusy.value ? "Building..." : "Build";
});
const buildButtonTitle = computed(() =>
  props.canBuildProject ? "Build LVGL C export" : "Sign in to build and export LVGL C code"
);
const selectableProjects = computed(() => props.projects.filter((item) => item.id !== props.project.id));
const currentProjectLabel = computed(() => `Current: ${projectOptionLabel(props.project.id, props.project.name)}`);
const projectMenuButtonLabel = computed(() => projectMenuOpen.value ? "Project menu open" : "Open project menu");
const duplicateProjectNames = computed(() => {
  const counts = new Map<string, number>();
  for (const item of [{ id: props.project.id, name: props.project.name }, ...selectableProjects.value]) {
    const normalized = item.name.trim();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return counts;
});
type DesktopMenuId = "file" | "edit" | "view" | "project" | "tools" | "export" | "help";
type DesktopMenuAction =
  | "build"
  | "copy-widget"
  | "create-project"
  | "delete-widget"
  | "demo-login"
  | "load-projects"
  | "paste-widget"
  | "preview"
  | "redo"
  | "save-project"
  | "show-settings"
  | "toggle-grid"
  | "toggle-simulator"
  | "toggle-snap"
  | "undo";
type DesktopMenuItem =
  | {
      id: string;
      kind?: "command";
      label: string;
      action: DesktopMenuAction;
      shortcut?: string;
      disabled?: boolean;
    }
  | {
      id: string;
      kind: "divider";
    };
type DesktopMenu = {
  id: DesktopMenuId;
  label: string;
  items: DesktopMenuItem[];
};
const desktopMenus = computed<DesktopMenu[]>(() => [
  {
    id: "file",
    label: "File",
    items: [
      { id: "new", label: "New Project", action: "create-project", shortcut: "⌘N" },
      { id: "open", label: "Open Cloud Project", action: "load-projects", shortcut: "⌘O" },
      { id: "save", label: "Save", action: "save-project", shortcut: "⌘S" },
      { id: "file-separator", kind: "divider" },
      { id: "build", label: props.canBuildProject ? "Build" : "Login to Build", action: "build", disabled: buildDisabled.value }
    ]
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      { id: "undo", label: "Undo", action: "undo", shortcut: "⌘Z", disabled: !props.canUndo },
      { id: "redo", label: "Redo", action: "redo", shortcut: "⇧⌘Z", disabled: !props.canRedo },
      { id: "edit-separator", kind: "divider" },
      { id: "copy", label: "Copy", action: "copy-widget", shortcut: "⌘C", disabled: !props.canCopyWidget },
      { id: "paste", label: "Paste", action: "paste-widget", shortcut: "⌘V", disabled: !props.canPasteWidget },
      { id: "delete", label: "Delete", action: "delete-widget", shortcut: "⌫", disabled: !props.canDeleteWidget }
    ]
  },
  {
    id: "view",
    label: "View",
    items: [
      { id: "preview", label: "Preview", action: "preview" },
      { id: "simulator", label: props.simulatorVisible ? "Hide Simulator" : "Show Simulator", action: "toggle-simulator" },
      { id: "view-separator", kind: "divider" },
      { id: "grid", label: props.gridEnabled ? "Hide Grid" : "Show Grid", action: "toggle-grid" },
      { id: "snap", label: props.snapEnabled ? "Disable Snap" : "Enable Snap", action: "toggle-snap" }
    ]
  },
  {
    id: "project",
    label: "Project",
    items: [
      { id: "project-settings", label: "Target Settings", action: "show-settings" },
      { id: "project-save", label: "Save Project", action: "save-project", shortcut: "⌘S" },
      { id: "project-open", label: "Load Cloud Projects", action: "load-projects" }
    ]
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { id: "tools-grid", label: props.gridEnabled ? "Grid Enabled" : "Grid Disabled", action: "toggle-grid" },
      { id: "tools-snap", label: props.snapEnabled ? "Snap Enabled" : "Snap Disabled", action: "toggle-snap" }
    ]
  },
  {
    id: "export",
    label: "Export",
    items: [
      { id: "export-build", label: props.canBuildProject ? "Build C Export" : "Login to Build", action: "build", disabled: buildDisabled.value },
      { id: "export-preview", label: "Preview Before Export", action: "preview" }
    ]
  },
  {
    id: "help",
    label: "Help",
    items: [
      { id: "help-demo-login", label: props.authUser ? "Demo Account Connected" : "Login With Demo Account", action: "demo-login", disabled: Boolean(props.authUser) },
      { id: "help-settings", label: "Open Settings", action: "show-settings" }
    ]
  }
]);

function projectOptionLabel(projectId: string, name: string): string {
  if ((duplicateProjectNames.value.get(name.trim()) ?? 0) <= 1) {
    return name;
  }
  return `${name} (${shortProjectId(projectId)})`;
}

function shortProjectId(projectId: string): string {
  return projectId.length <= 12 ? projectId : projectId.slice(-8);
}

function setDesktopMenuButtonRef(menuId: DesktopMenuId, element: unknown): void {
  if (element instanceof HTMLButtonElement) {
    desktopMenuButtonRefs.value[menuId] = element;
    return;
  }
  delete desktopMenuButtonRefs.value[menuId];
}

function setDesktopMenuCommandRef(menuId: DesktopMenuId, itemId: string, element: unknown): void {
  const menuRefs = desktopMenuCommandRefs.value[menuId] ?? {};
  if (element instanceof HTMLButtonElement) {
    menuRefs[itemId] = element;
    desktopMenuCommandRefs.value[menuId] = menuRefs;
    return;
  }
  delete menuRefs[itemId];
}

function desktopMenuButtonLabel(menu: DesktopMenu): string {
  return activeDesktopMenu.value === menu.id ? `${menu.label} menu open` : `Open ${menu.label} menu`;
}

function openProject(event: Event): void {
  const projectId = (event.target as HTMLSelectElement).value;
  if (!projectId || projectId === props.project.id) {
    return;
  }
  emit("open-project", projectId);
  if (projectMenuOpen.value) {
    closeProjectMenuAndReturnFocus();
    return;
  }
  projectMenuOpen.value = false;
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

function clearLoginError(): void {
  if (props.authError) {
    emit("clear-auth-error");
  }
}

function toggleProjectMenu(): void {
  projectMenuOpen.value = !projectMenuOpen.value;
  if (projectMenuOpen.value) {
    activeDesktopMenu.value = null;
    hoverActivatedDesktopMenu.value = null;
  }
}

function handleProjectMenuButtonKeydown(event: KeyboardEvent): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
    return;
  }
  event.preventDefault();
  projectMenuOpen.value = true;
  activeDesktopMenu.value = null;
  hoverActivatedDesktopMenu.value = null;
  void nextTick(() => {
    const items = projectMenuItems();
    if (event.key === "ArrowUp") {
      items[items.length - 1]?.focus();
      return;
    }
    projectMenuFirstActionRef.value?.focus();
  });
}

function handleProjectMenuItemKeydown(event: KeyboardEvent): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") {
    return;
  }
  const items = projectMenuItems();
  const currentIndex = items.indexOf(event.currentTarget as HTMLElement);
  if (currentIndex < 0) {
    return;
  }
  event.preventDefault();
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? items.length - 1
      : event.key === "ArrowDown"
        ? (currentIndex + 1) % items.length
        : (currentIndex - 1 + items.length) % items.length;
  items[nextIndex]?.focus();
}

function projectMenuItems(): HTMLElement[] {
  return Array.from(projectMenuRef.value?.querySelectorAll<HTMLElement>("button, input, select") ?? [])
    .filter((item) => !isDisabledControl(item));
}

function isDisabledControl(item: HTMLElement): boolean {
  return "disabled" in item && Boolean(item.disabled);
}

function toggleDesktopMenu(menuId: DesktopMenuId): void {
  projectMenuOpen.value = false;
  if (activeDesktopMenu.value === menuId && hoverActivatedDesktopMenu.value === menuId) {
    hoverActivatedDesktopMenu.value = null;
    return;
  }
  hoverActivatedDesktopMenu.value = null;
  activeDesktopMenu.value = activeDesktopMenu.value === menuId ? null : menuId;
}

function switchDesktopMenuOnHover(menuId: DesktopMenuId): void {
  if (!activeDesktopMenu.value || activeDesktopMenu.value === menuId) {
    return;
  }
  activeDesktopMenu.value = menuId;
  hoverActivatedDesktopMenu.value = menuId;
}

function handleDesktopMenuKeydown(event: KeyboardEvent, menuId: DesktopMenuId): void {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    activeDesktopMenu.value = menuId;
    projectMenuOpen.value = false;
    hoverActivatedDesktopMenu.value = null;
    void nextTick(() => {
      focusDesktopMenuCommand(menuId, event.key === "ArrowDown" ? 0 : desktopMenuCommands(menuId).length - 1);
    });
    return;
  }
  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    switchDesktopMenuByPosition(event.key === "Home" ? 0 : desktopMenus.value.length - 1);
    return;
  }
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
    return;
  }
  event.preventDefault();
  const direction = event.key === "ArrowRight" ? 1 : -1;
  switchDesktopMenuByOffset(menuId, direction, "button");
}

function switchDesktopMenuByPosition(index: number): void {
  const nextMenuId = desktopMenus.value[index]?.id;
  if (!nextMenuId) {
    return;
  }
  activeDesktopMenu.value = nextMenuId;
  projectMenuOpen.value = false;
  hoverActivatedDesktopMenu.value = null;
  void nextTick(() => {
    desktopMenuButtonRefs.value[nextMenuId]?.focus();
  });
}

function handleDesktopMenuCommandKeydown(event: KeyboardEvent, menuId: DesktopMenuId, itemId: string): void {
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    switchDesktopMenuByOffset(menuId, event.key === "ArrowRight" ? 1 : -1, "command");
    return;
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") {
    return;
  }
  const commands = desktopMenuCommands(menuId);
  const currentIndex = commands.findIndex((item) => item.id === itemId);
  if (currentIndex < 0) {
    return;
  }
  event.preventDefault();
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? commands.length - 1
      : event.key === "ArrowDown"
        ? (currentIndex + 1) % commands.length
        : (currentIndex - 1 + commands.length) % commands.length;
  focusDesktopMenuCommand(menuId, nextIndex);
}

function switchDesktopMenuByOffset(menuId: DesktopMenuId, direction: 1 | -1, focusTarget: "button" | "command"): void {
  const menuIds = desktopMenus.value.map((menu) => menu.id);
  const currentIndex = menuIds.indexOf(menuId);
  if (currentIndex < 0) {
    return;
  }
  const nextIndex = (currentIndex + direction + menuIds.length) % menuIds.length;
  const nextMenuId = menuIds[nextIndex];
  activeDesktopMenu.value = nextMenuId;
  projectMenuOpen.value = false;
  hoverActivatedDesktopMenu.value = null;
  void nextTick(() => {
    if (focusTarget === "command") {
      focusDesktopMenuCommand(nextMenuId, 0);
      return;
    }
    desktopMenuButtonRefs.value[nextMenuId]?.focus();
  });
}

function desktopMenuCommands(menuId: DesktopMenuId): Array<Extract<DesktopMenuItem, { action: DesktopMenuAction }>> {
  return desktopMenus.value
    .find((menu) => menu.id === menuId)
    ?.items.filter((item): item is Extract<DesktopMenuItem, { action: DesktopMenuAction }> => item.kind !== "divider" && !item.disabled) ?? [];
}

function focusDesktopMenuCommand(menuId: DesktopMenuId, index: number): void {
  const command = desktopMenuCommands(menuId)[index];
  if (!command) {
    desktopMenuButtonRefs.value[menuId]?.focus();
    return;
  }
  desktopMenuCommandRefs.value[menuId]?.[command.id]?.focus();
}

function runDesktopMenuCommand(menuId: DesktopMenuId, action: DesktopMenuAction): void {
  activeDesktopMenu.value = null;
  desktopMenuButtonRefs.value[menuId]?.focus();
  const actionMap: Record<DesktopMenuAction, () => void> = {
    build: () => emit("build"),
    "copy-widget": () => emit("copy-widget"),
    "create-project": () => emit("create-project"),
    "delete-widget": () => emit("delete-widget"),
    "demo-login": () => emit("demo-login"),
    "load-projects": () => emit("load-projects"),
    "paste-widget": () => emit("paste-widget"),
    preview: () => emit("preview"),
    redo: () => emit("redo"),
    "save-project": () => emit("save-project"),
    "show-settings": () => emit("show-settings"),
    "toggle-grid": () => emit("update:grid-enabled", !props.gridEnabled),
    "toggle-simulator": () => emit("toggle-simulator"),
    "toggle-snap": () => emit("update:snap-enabled", !props.snapEnabled),
    undo: () => emit("undo")
  };
  actionMap[action]();
}

function loadProjectsFromMenu(): void {
  closeProjectMenuAndReturnFocus();
  emit("load-projects");
}

function createProjectFromMenu(): void {
  closeProjectMenuAndReturnFocus();
  emit("create-project");
}

function demoLoginFromMenu(): void {
  closeProjectMenuAndReturnFocus();
  emit("demo-login");
}

function closeProjectMenuAndReturnFocus(): void {
  projectMenuOpen.value = false;
  projectMenuButtonRef.value?.focus();
}

function closeMenuOnOutsidePointer(event: PointerEvent): void {
  if ((!projectMenuOpen.value && !activeDesktopMenu.value) || toolbarRef.value?.contains(event.target as Node)) {
    return;
  }
  projectMenuOpen.value = false;
  activeDesktopMenu.value = null;
  hoverActivatedDesktopMenu.value = null;
}

function closeMenuOnEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || (!projectMenuOpen.value && !activeDesktopMenu.value)) {
    return;
  }
  const desktopMenuToFocus = activeDesktopMenu.value;
  const returnFocusElement = projectMenuOpen.value
    ? projectMenuButtonRef.value
    : desktopMenuToFocus
      ? desktopMenuButtonRefs.value[desktopMenuToFocus] ?? null
      : null;
  projectMenuOpen.value = false;
  activeDesktopMenu.value = null;
  hoverActivatedDesktopMenu.value = null;
  void nextTick(() => {
    returnFocusElement?.focus();
  });
}

onMounted(() => {
  document.addEventListener("pointerdown", closeMenuOnOutsidePointer);
  document.addEventListener("keydown", closeMenuOnEscape);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeMenuOnOutsidePointer);
  document.removeEventListener("keydown", closeMenuOnEscape);
});
</script>
