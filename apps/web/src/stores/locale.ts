import { defineStore } from "pinia";
import { ref } from "vue";
import { isLocale } from "../i18n/copy";
import type { Locale } from "../i18n/types";

const localeStorageKey = "lvgl-editor-locale";

export const useLocaleStore = defineStore("locale", () => {
  const storedLocale = typeof localStorage === "undefined" ? null : localStorage.getItem(localeStorageKey);
  const locale = ref<Locale>(storedLocale && isLocale(storedLocale) ? storedLocale : "en-US");
  applyLocaleDocumentState(locale.value);

  function setLocale(nextLocale: Locale): void {
    locale.value = nextLocale;
    applyLocaleDocumentState(nextLocale);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(localeStorageKey, nextLocale);
    }
  }

  return {
    locale,
    setLocale
  };
});

function applyLocaleDocumentState(locale: Locale): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.lang = locale === "zh-CN" ? "zh-CN" : "en";
  document.title = locale === "zh-CN" ? "LVGL 在线编辑器" : "LVGL Online Editor";
}
