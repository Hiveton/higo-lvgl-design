import { describe, expect, it } from "vitest";
import { localizedErrorForCode, localizeError } from "./errors";

describe("localized errors", () => {
  it("keeps generic Error messages in English for developer-visible diagnostics", () => {
    expect(localizeError(new Error("offline"), "en-US", "ASSET_LIST_FAILED")).toBe("offline");
  });

  it("uses the localized fallback for generic Error messages in Chinese", () => {
    expect(localizeError(new Error("offline"), "zh-CN", "ASSET_LIST_FAILED")).toBe("资源列表加载失败");
  });

  it("describes referenced assets without assuming the reference is a widget", () => {
    expect(localizedErrorForCode("ASSET_IN_USE", "en-US")).toBe("Asset is still referenced by this project");
    expect(localizedErrorForCode("ASSET_IN_USE", "zh-CN")).toBe("资源仍被当前项目引用");
  });

  it("localizes backend persistence and job lookup failure codes", () => {
    expect(localizedErrorForCode("ASSET_STORE_FAILED", "en-US")).toBe("Asset storage failed");
    expect(localizedErrorForCode("ASSET_CREATE_FAILED", "zh-CN")).toBe("资源记录创建失败");
    expect(localizedErrorForCode("JOB_CREATE_FAILED", "en-US")).toBe("Build job create failed");
    expect(localizedErrorForCode("JOB_LOOKUP_FAILED", "zh-CN")).toBe("任务读取失败");
  });
});
