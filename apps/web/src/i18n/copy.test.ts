import { describe, expect, it } from "vitest";
import { widgetCatalog } from "@hiveton-lvgl/schema";
import { editorCopy } from "./copy";

function collectObjectPaths(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      return [path, ...collectObjectPaths(child, path)];
    }
    return [path];
  });
}

describe("editor copy", () => {
  it("keeps English and Chinese copy keys symmetric", () => {
    const englishPaths = collectObjectPaths(editorCopy["en-US"]).sort();
    const chinesePaths = collectObjectPaths(editorCopy["zh-CN"]).sort();

    expect(chinesePaths).toEqual(englishPaths);
  });

  it("formats cloud project counts in English with singular and plural labels", () => {
    expect(editorCopy["en-US"].toolbar.cloudProjectCount(1)).toBe("1 cloud project");
    expect(editorCopy["en-US"].toolbar.cloudProjectCount(2)).toBe("2 cloud projects");
  });

  it("localizes every widget catalog type and category", () => {
    const widgetTypes = widgetCatalog.map((widget) => widget.type);
    const widgetCategories = [...new Set(widgetCatalog.map((widget) => widget.category))];

    for (const locale of ["en-US", "zh-CN"] as const) {
      for (const type of widgetTypes) {
        expect(editorCopy[locale].widgets.names[type], `${locale} widget name ${type}`).toEqual(expect.any(String));
        expect(editorCopy[locale].widgets.names[type].trim(), `${locale} widget name ${type}`).not.toBe("");
      }
      for (const category of widgetCategories) {
        expect(editorCopy[locale].widgets.categories[category], `${locale} widget category ${category}`).toEqual(expect.any(String));
        expect(editorCopy[locale].widgets.categories[category].trim(), `${locale} widget category ${category}`).not.toBe("");
      }
    }
  });
});
