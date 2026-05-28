import { describe, expect, it } from "vitest";
import { localizeError } from "./errors";

describe("localized errors", () => {
  it("keeps generic Error messages in English for developer-visible diagnostics", () => {
    expect(localizeError(new Error("offline"), "en-US", "ASSET_LIST_FAILED")).toBe("offline");
  });

  it("uses the localized fallback for generic Error messages in Chinese", () => {
    expect(localizeError(new Error("offline"), "zh-CN", "ASSET_LIST_FAILED")).toBe("资源列表加载失败");
  });
});
