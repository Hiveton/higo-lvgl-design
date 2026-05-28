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
      <strong class="product-name">{{ copy.toolbar.productName }}</strong>
      <nav class="desktop-menu-strip" :aria-label="copy.toolbar.applicationMenus">
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
            <div class="menu-section-title">{{ copy.toolbar.project }}</div>
            <strong>{{ project.name }}</strong>
          </div>
          <span data-testid="menu-project-count">{{ copy.toolbar.cloudProjectCount(selectableProjects.length) }}</span>
        </div>
        <button ref="projectMenuFirstActionRef" class="select-like" type="button" role="menuitem" data-testid="menu-load-projects-button" :aria-label="copy.toolbar.refreshCloudProjects" :title="copy.toolbar.refreshCloudProjects" @click="loadProjectsFromMenu" @keydown="handleProjectMenuItemKeydown">{{ copy.toolbar.refreshCloudProjects }}</button>
        <select class="select-like" role="menuitem" data-testid="menu-project-select" :aria-label="copy.toolbar.openCloudProjectFromMenu" :title="copy.toolbar.openCloudProjectFromMenu" :disabled="selectableProjects.length === 0" :value="project.id" @change="openProject" @keydown="handleProjectMenuItemKeydown">
          <option :value="project.id">{{ currentProjectLabel }}</option>
          <option v-for="item in selectableProjects" :key="item.id" :value="item.id">
            {{ projectOptionLabel(item.id, item.name) }}
          </option>
        </select>
        <label class="project-menu-field" role="none">
          <span>{{ copy.toolbar.language }}</span>
          <select class="select-like" role="menuitem" data-menu-skip="true" data-testid="menu-locale-select" :aria-label="copy.toolbar.editorLanguage" :title="copy.toolbar.editorLanguage" :value="localeStore.locale" @change="updateLocale" @keydown="handleProjectMenuItemKeydown">
            <option value="en-US">{{ copy.toolbar.localeNames["en-US"] }}</option>
            <option value="zh-CN">{{ copy.toolbar.localeNames["zh-CN"] }}</option>
          </select>
        </label>
        <p v-if="selectableProjects.length === 0" class="project-menu-empty" data-testid="menu-project-empty-state" role="status" aria-live="polite" aria-atomic="true">
          {{ copy.toolbar.noCloudProjects }}
        </p>
        <button class="select-like" type="button" role="menuitem" data-testid="menu-new-project-button" :aria-label="copy.toolbar.createCloudProject" :title="copy.toolbar.createCloudProject" @click="createProjectFromMenu" @keydown="handleProjectMenuItemKeydown">{{ copy.toolbar.createCloudProject }}</button>
        <form v-if="!authUser" class="project-menu-login-form" data-testid="menu-login-form" @submit.prevent="submitLogin">
          <input v-model="loginEmail" class="select-like" data-testid="menu-login-email-input" :aria-label="copy.toolbar.emailForCloudLogin" :title="copy.toolbar.emailForCloudLogin" :placeholder="copy.toolbar.email" autocomplete="username" :aria-invalid="authError ? 'true' : undefined" :aria-describedby="authError ? 'project-menu-login-error' : undefined" @input="clearLoginError" @keydown="handleProjectMenuItemKeydown" />
          <input v-model="loginPassword" class="select-like" data-testid="menu-login-password-input" :aria-label="copy.toolbar.passwordForCloudLogin" :title="copy.toolbar.passwordForCloudLogin" :placeholder="copy.toolbar.password" type="password" autocomplete="current-password" :aria-invalid="authError ? 'true' : undefined" :aria-describedby="authError ? 'project-menu-login-error' : undefined" @input="clearLoginError" @keydown="handleProjectMenuItemKeydown" />
          <button class="select-like" type="submit" data-testid="menu-login-button" :aria-label="copy.toolbar.loginFromProjectMenu" :title="copy.toolbar.loginFromProjectMenu" @keydown="handleProjectMenuItemKeydown">{{ copy.toolbar.login }}</button>
          <p v-if="authError" id="project-menu-login-error" class="login-error project-menu-login-error" data-testid="menu-login-error" role="alert">{{ authError }}</p>
        </form>
        <button v-if="!authUser" class="select-like" type="button" role="menuitem" data-testid="menu-demo-login-button" :aria-label="copy.toolbar.loginWithDemoAccount" :title="copy.toolbar.loginWithDemoAccount" @click="demoLoginFromMenu" @keydown="handleProjectMenuItemKeydown">{{ copy.toolbar.demoLogin }}</button>
      </div>
    </div>
    <div class="command-bar">
      <div class="command-group">
        <button class="tool-button" type="button" data-testid="new-project-button" :aria-label="copy.toolbar.newProjectA11y" :title="copy.toolbar.newProjectA11y" @click="emit('create-project')"><IconGlyph name="add" /><span class="tool-label">{{ copy.toolbar.newProject }}</span></button>
        <button class="tool-button" type="button" data-testid="load-projects-button" :aria-label="copy.toolbar.openCloudProject" :title="copy.toolbar.openCloudProject" @click="emit('load-projects')"><IconGlyph name="folder" /><span class="tool-label">{{ copy.toolbar.open }}</span></button>
        <button class="tool-button" type="button" data-testid="save-project-button" :aria-label="saveProjectLabel" :title="saveProjectLabel" @click="emit('save-project')"><IconGlyph name="save" /><span class="tool-label">{{ copy.toolbar.save }}</span></button>
      </div>
      <div class="command-group">
        <button class="tool-button" type="button" data-testid="undo-button" :aria-label="copy.toolbar.undo" :title="copy.toolbar.undo" :disabled="!canUndo" @click="emit('undo')"><IconGlyph name="undo" /><span class="tool-label">{{ copy.toolbar.undo }}</span></button>
        <button class="tool-button" type="button" data-testid="redo-button" :aria-label="copy.toolbar.redo" :title="copy.toolbar.redo" :disabled="!canRedo" @click="emit('redo')"><IconGlyph name="redo" /><span class="tool-label">{{ copy.toolbar.redo }}</span></button>
        <button class="tool-button" type="button" :aria-label="copyWidgetLabel" :title="copyWidgetLabel" data-testid="copy-widget-button" :disabled="!canCopyWidget" @click="emit('copy-widget')"><IconGlyph name="copy" /><span class="tool-label">{{ copy.toolbar.copy }}</span></button>
        <button class="tool-button" type="button" :aria-label="pasteWidgetLabel" :title="pasteWidgetLabel" data-testid="paste-widget-button" :disabled="!canPasteWidget" @click="emit('paste-widget')"><IconGlyph name="paste" /><span class="tool-label">{{ copy.toolbar.paste }}</span></button>
        <button class="tool-button" type="button" :aria-label="deleteWidgetLabel" :title="deleteWidgetLabel" data-testid="delete-widget-button" :disabled="!canDeleteWidget" @click="emit('delete-widget')"><IconGlyph name="trash" /><span class="tool-label">{{ copy.toolbar.delete }}</span></button>
      </div>
      <div class="command-group compact-tools">
        <button class="icon-button" type="button" :aria-label="gridToggleLabel" :title="gridToggleLabel" data-testid="grid-toggle" :aria-pressed="gridEnabled ? 'true' : 'false'" :class="{ active: gridEnabled }" @click="emit('update:grid-enabled', !gridEnabled)"><IconGlyph name="grid" /></button>
        <button class="icon-button" type="button" :aria-label="snapToggleLabel" :title="snapToggleLabel" data-testid="snap-toggle" :aria-pressed="snapEnabled ? 'true' : 'false'" :class="{ active: snapEnabled }" @click="emit('update:snap-enabled', !snapEnabled)"><IconGlyph name="crosshair" /></button>
      </div>
      <span class="toolbar-spacer" />
      <button class="simulator-toggle simulator-visibility-control" type="button" data-testid="simulator-toggle-button" :aria-pressed="simulatorVisible ? 'true' : 'false'" :aria-label="simulatorVisibilityLabel" :title="simulatorVisibilityLabel" @click="emit('toggle-simulator')">
        {{ simulatorVisible ? copy.toolbar.simulator : copy.toolbar.simulatorShow }}
      </button>
      <button class="primary-action" type="button" data-testid="preview-button" :aria-label="copy.toolbar.previewCurrentScreen" :title="copy.toolbar.previewCurrentScreen" @click="emit('preview')">{{ copy.toolbar.preview }}</button>
      <label class="project-control">
        {{ copy.toolbar.project }}
        <input
          class="select-like toolbar-input"
          data-testid="project-name-input"
          :aria-label="copy.toolbar.projectName"
          :title="copy.toolbar.projectName"
          :value="project.name"
          @input="emit('rename-project', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <select class="select-like project-select cloud-project-control" data-testid="project-select" :aria-label="copy.toolbar.openCloudProject" :title="copy.toolbar.openCloudProject" :value="project.id" @change="openProject">
        <option :value="project.id">{{ projectOptionLabel(project.id, project.name) }}</option>
        <option v-for="item in selectableProjects" :key="item.id" :value="item.id">
          {{ projectOptionLabel(item.id, item.name) }}
        </option>
      </select>
      <label>
        {{ copy.toolbar.target }}
        <button class="select-like" type="button" data-testid="target-settings-button" :aria-label="copy.toolbar.openTargetSettingsFor(targetLabel)" :title="copy.toolbar.openTargetSettingsFor(targetLabel)" @click="emit('show-settings')">{{ targetLabel }} ˅</button>
      </label>
      <label>
        {{ copy.toolbar.theme }}
        <select class="select-like" data-testid="theme-select" :aria-label="copy.toolbar.projectTheme" :title="copy.toolbar.projectTheme" :value="project.theme" @change="updateTheme">
          <option value="dark">{{ copy.toolbar.dark }}</option>
          <option value="light">{{ copy.toolbar.light }}</option>
        </select>
      </label>
      <label class="locale-control">
        {{ copy.toolbar.language }}
        <select class="select-like locale-select" data-testid="locale-select" :aria-label="copy.toolbar.editorLanguage" :title="copy.toolbar.editorLanguage" :value="localeStore.locale" @change="updateLocale">
          <option value="en-US">{{ copy.toolbar.localeNames["en-US"] }}</option>
          <option value="zh-CN">{{ copy.toolbar.localeNames["zh-CN"] }}</option>
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
        <input v-model="loginEmail" class="select-like login-input" data-testid="login-email-input" :aria-label="copy.toolbar.email" :title="copy.toolbar.email" :placeholder="copy.toolbar.email" autocomplete="username" size="1" :aria-invalid="authError ? 'true' : undefined" :aria-describedby="authError ? 'toolbar-login-error' : undefined" @input="clearLoginError" />
        <input v-model="loginPassword" class="select-like login-input" data-testid="login-password-input" :aria-label="copy.toolbar.password" :title="copy.toolbar.password" :placeholder="copy.toolbar.password" type="password" autocomplete="current-password" size="1" :aria-invalid="authError ? 'true' : undefined" :aria-describedby="authError ? 'toolbar-login-error' : undefined" @input="clearLoginError" />
        <button class="select-like" data-testid="login-button" type="submit" :aria-label="copy.toolbar.login" :title="copy.toolbar.login">{{ copy.toolbar.login }}</button>
        <button class="select-like" data-testid="demo-login-button" type="button" :aria-label="copy.toolbar.loginWithDemoAccount" :title="copy.toolbar.loginWithDemoAccount" @click="emit('demo-login')">{{ copy.toolbar.demo }}</button>
        <p v-if="authError" id="toolbar-login-error" class="login-error" data-testid="login-error" role="alert">{{ authError }}</p>
      </form>
      <span v-else class="user-chip" data-testid="current-user">
        {{ authUser.displayName }}
        <button class="mini-action" data-testid="logout-button" type="button" :aria-label="copy.toolbar.logout" :title="copy.toolbar.logout" @click="emit('logout')"><IconGlyph name="logout" /></button>
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { ProjectDoc } from "@hiveton-lvgl/schema";
import type { AuthUser } from "../api/auth";
import type { ProjectSummary } from "../api/projects";
import { isLocale } from "../i18n/copy";
import { useCopy } from "../i18n/useCopy";
import { useLocaleStore } from "../stores/locale";
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
const localeStore = useLocaleStore();
const copy = useCopy();
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
  props.selectedWidgetName ? copy.value.toolbar.copyWidget(props.selectedWidgetName) : copy.value.toolbar.copySelectedWidget
);
const pasteWidgetLabel = computed(() =>
  props.copiedWidgetName ? copy.value.toolbar.pasteWidget(props.copiedWidgetName) : copy.value.toolbar.pasteCopiedWidget
);
const deleteWidgetLabel = computed(() =>
  props.selectedWidgetName ? copy.value.toolbar.deleteWidget(props.selectedWidgetName) : copy.value.toolbar.deleteSelectedWidget
);
const saveProjectLabel = computed(() => copy.value.toolbar.saveProject(props.project.name));
const gridToggleLabel = computed(() => (props.gridEnabled ? copy.value.toolbar.gridHide : copy.value.toolbar.gridShow));
const snapToggleLabel = computed(() => (props.snapEnabled ? copy.value.toolbar.snapDisable : copy.value.toolbar.snapEnable));
const simulatorVisibilityLabel = computed(() => (props.simulatorVisible ? copy.value.toolbar.hideSimulator : copy.value.toolbar.showSimulator));
const buildButtonLabel = computed(() => {
  if (!props.canBuildProject) {
    return copy.value.toolbar.loginToBuild;
  }
  return isBuildBusy.value ? copy.value.toolbar.building : copy.value.toolbar.build;
});
const buildButtonTitle = computed(() =>
  props.canBuildProject ? copy.value.toolbar.buildCExport : copy.value.toolbar.signInToBuild
);
const selectableProjects = computed(() => props.projects.filter((item) => item.id !== props.project.id));
const currentProjectLabel = computed(() => copy.value.toolbar.currentProject(projectOptionLabel(props.project.id, props.project.name)));
const projectMenuButtonLabel = computed(() => projectMenuOpen.value ? copy.value.toolbar.projectMenuOpen : copy.value.toolbar.openProjectMenu);
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
    label: copy.value.toolbar.file,
    items: [
      { id: "new", label: copy.value.toolbar.newProject, action: "create-project", shortcut: "⌘N" },
      { id: "open", label: copy.value.toolbar.openCloudProject, action: "load-projects", shortcut: "⌘O" },
      { id: "save", label: copy.value.toolbar.save, action: "save-project", shortcut: "⌘S" },
      { id: "file-separator", kind: "divider" },
      { id: "build", label: props.canBuildProject ? copy.value.toolbar.build : copy.value.toolbar.loginToBuild, action: "build", disabled: buildDisabled.value }
    ]
  },
  {
    id: "edit",
    label: copy.value.toolbar.edit,
    items: [
      { id: "undo", label: copy.value.toolbar.undo, action: "undo", shortcut: "⌘Z", disabled: !props.canUndo },
      { id: "redo", label: copy.value.toolbar.redo, action: "redo", shortcut: "⇧⌘Z", disabled: !props.canRedo },
      { id: "edit-separator", kind: "divider" },
      { id: "copy", label: copy.value.toolbar.copy, action: "copy-widget", shortcut: "⌘C", disabled: !props.canCopyWidget },
      { id: "paste", label: copy.value.toolbar.paste, action: "paste-widget", shortcut: "⌘V", disabled: !props.canPasteWidget },
      { id: "delete", label: copy.value.toolbar.delete, action: "delete-widget", shortcut: "⌫", disabled: !props.canDeleteWidget }
    ]
  },
  {
    id: "view",
    label: copy.value.toolbar.view,
    items: [
      { id: "preview", label: copy.value.toolbar.preview, action: "preview" },
      { id: "simulator", label: props.simulatorVisible ? copy.value.toolbar.hideSimulator : copy.value.toolbar.showSimulator, action: "toggle-simulator" },
      { id: "view-separator", kind: "divider" },
      { id: "grid", label: props.gridEnabled ? copy.value.toolbar.gridHide : copy.value.toolbar.gridShow, action: "toggle-grid" },
      { id: "snap", label: props.snapEnabled ? copy.value.toolbar.snapDisable : copy.value.toolbar.snapEnable, action: "toggle-snap" }
    ]
  },
  {
    id: "project",
    label: copy.value.toolbar.project,
    items: [
      { id: "project-settings", label: copy.value.toolbar.targetSettings, action: "show-settings" },
      { id: "project-save", label: copy.value.toolbar.saveProjectMenu, action: "save-project", shortcut: "⌘S" },
      { id: "project-open", label: copy.value.toolbar.refreshCloudProjects, action: "load-projects" }
    ]
  },
  {
    id: "tools",
    label: copy.value.toolbar.tools,
    items: [
      { id: "tools-grid", label: props.gridEnabled ? copy.value.toolbar.gridEnabled : copy.value.toolbar.gridDisabled, action: "toggle-grid" },
      { id: "tools-snap", label: props.snapEnabled ? copy.value.toolbar.snapEnabled : copy.value.toolbar.snapDisabled, action: "toggle-snap" }
    ]
  },
  {
    id: "export",
    label: copy.value.toolbar.export,
    items: [
      { id: "export-build", label: props.canBuildProject ? copy.value.toolbar.buildCExport : copy.value.toolbar.buildCExportSignedOut, action: "build", disabled: buildDisabled.value },
      { id: "export-preview", label: copy.value.toolbar.previewBeforeExport, action: "preview" }
    ]
  },
  {
    id: "help",
    label: copy.value.toolbar.help,
    items: [
      { id: "help-demo-login", label: props.authUser ? copy.value.toolbar.demoAccountConnected : copy.value.toolbar.loginWithDemoAccount, action: "demo-login", disabled: Boolean(props.authUser) },
      { id: "help-settings", label: copy.value.navigation.openSection(copy.value.navigation.settings), action: "show-settings" }
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
  return activeDesktopMenu.value === menu.id ? copy.value.toolbar.menuOpen(menu.label) : copy.value.toolbar.openMenu(menu.label);
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

function updateLocale(event: Event): void {
  const nextLocale = (event.target as HTMLSelectElement).value;
  if (isLocale(nextLocale)) {
    localeStore.setLocale(nextLocale);
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
    .filter((item) => !isDisabledControl(item) && item.dataset.menuSkip !== "true");
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
