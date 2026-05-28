import { computed } from "vue";
import { editorCopy } from "./copy";
import { useLocaleStore } from "../stores/locale";

export function useCopy() {
  const localeStore = useLocaleStore();
  return computed(() => editorCopy[localeStore.locale]);
}
