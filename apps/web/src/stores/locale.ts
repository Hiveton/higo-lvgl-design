import { defineStore } from "pinia";
import { ref } from "vue";
import { getBrowserStorage } from "../api/auth";
import { isLocale } from "../i18n/copy";
import type { Locale } from "../i18n/types";

const localeStorageKey = "lvgl-editor-locale";

export const useLocaleStore = defineStore("locale", () => {
  const storedLocale = readStoredLocale();
  const locale = ref<Locale>(storedLocale && isLocale(storedLocale) ? storedLocale : "en-US");
  applyLocaleDocumentState(locale.value);

  function setLocale(nextLocale: Locale): void {
    locale.value = nextLocale;
    applyLocaleDocumentState(nextLocale);
    const writableStorage = getBrowserStorage();
    if (typeof writableStorage?.setItem === "function") {
      try {
        writableStorage.setItem(localeStorageKey, nextLocale);
      } catch {
        // Keep the in-memory locale active when persistence is unavailable.
      }
    }
  }

  return {
    locale,
    setLocale
  };
});

function readStoredLocale(): string | null {
  const storage = getBrowserStorage();
  if (typeof storage?.getItem !== "function") {
    return null;
  }
  try {
    return storage.getItem(localeStorageKey);
  } catch {
    return null;
  }
}

function applyLocaleDocumentState(locale: Locale): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.lang = locale === "zh-CN" ? "zh-CN" : "en";
  document.title = locale === "zh-CN" ? "LVGL 在线编辑器" : "LVGL Online Editor";
}
