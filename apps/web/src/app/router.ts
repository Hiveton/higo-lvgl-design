import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import EditorShell from "../editor/EditorShell.vue";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "editor",
    component: EditorShell
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/"
  }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});
