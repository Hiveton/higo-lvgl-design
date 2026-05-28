import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useLocaleStore } from "./locale";

describe("useLocaleStore", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("defaults to English and persists selected locale", () => {
    const store = useLocaleStore();

    expect(store.locale).toBe("en-US");
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe("LVGL Online Editor");

    store.setLocale("zh-CN");

    expect(store.locale).toBe("zh-CN");
    expect(localStorage.getItem("lvgl-editor-locale")).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(document.title).toBe("LVGL 在线编辑器");
  });

  it("ignores unsupported persisted locale values", () => {
    localStorage.setItem("lvgl-editor-locale", "fr-FR");
    setActivePinia(createPinia());

    expect(useLocaleStore().locale).toBe("en-US");
  });
});
