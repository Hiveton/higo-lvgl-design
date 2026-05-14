<template>
  <RouterView />
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { RouterView } from "vue-router";
import { useAssetsStore } from "./stores/assets";
import { useAuthStore } from "./stores/auth";
import { useProjectStore } from "./stores/project";

const assetsStore = useAssetsStore();
const authStore = useAuthStore();
const projectStore = useProjectStore();

onMounted(() => {
  void restoreAppState();
});

async function restoreAppState(): Promise<void> {
  await authStore.restoreSession();
  if (authStore.user) {
    await projectStore.restoreLastProject();
    if (projectStore.project.id !== "project-watch-demo") {
      await assetsStore.loadAssets(projectStore.project.id);
    }
  }
}
</script>
