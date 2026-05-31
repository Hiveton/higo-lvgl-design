import { setActivePinia, createPinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAssetsStore } from "./assets";
import { useLocaleStore } from "./locale";

describe("useAssetsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uploads an image asset and appends it to the asset list", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:icon-heart");
    vi.stubGlobal("URL", { ...URL, createObjectURL });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            asset: {
              id: "asset-1",
              projectId: "project-1",
              name: "icon_heart.png",
              kind: "image",
              mimeType: "image/png",
              width: 24,
              height: 24,
              sizeBytes: 12,
              objectKey: "projects/project-1/assets/asset-1/icon_heart.png",
              createdAt: "2026-05-08T00:00:00Z"
            }
          }),
          { status: 201 }
        )
      )
    );
    const store = useAssetsStore();
    const file = new File(["png"], "icon_heart.png", { type: "image/png" });

    const asset = await store.uploadAsset("project-1", file);

    expect(asset?.id).toBe("asset-1");
    expect(store.assets).toHaveLength(1);
    expect(store.assets[0].name).toBe("icon_heart.png");
    expect(store.previewUrls["asset-1"]).toBe("blob:icon-heart");
    expect(store.error).toBeNull();
  });

  it("uploads a font asset as metadata without creating an image preview URL", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:font");
    vi.stubGlobal("URL", { ...URL, createObjectURL });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          asset: {
            id: "font-1",
            projectId: "project-1",
            name: "brand.ttf",
            kind: "font",
            mimeType: "font/ttf",
            sizeBytes: 12,
            objectKey: "projects/project-1/assets/font-1/brand.ttf",
            createdAt: "2026-05-08T00:00:00Z"
          }
        }),
        { status: 201 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();

    const asset = await store.uploadAsset("project-1", new File(["font"], "brand.ttf", { type: "font/ttf" }));

    expect(asset?.kind).toBe("font");
    expect(store.assets).toHaveLength(1);
    expect(store.previewUrls).toEqual({});
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(store.error).toBeNull();
  });

  it("imports a local image asset without calling the API", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:local-heart");
    const fetchMock = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL });
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();

    const asset = store.importLocalAsset("project-local", new File(["png"], "heart.png", { type: "image/png" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(asset?.id).toMatch(/^local-heart-png-/);
    expect(asset).toMatchObject({
      projectId: "project-local",
      name: "heart.png",
      kind: "image",
      mimeType: "image/png",
      objectKey: "local://heart.png"
    });
    expect(store.assets).toHaveLength(1);
    expect(store.previewUrls[asset?.id ?? ""]).toBe("blob:local-heart");
    expect(store.localFiles[asset?.id ?? ""]?.name).toBe("heart.png");
    expect(store.error).toBeNull();
  });

  it("keeps uploaded image metadata when preview object URL creation fails", async () => {
    const createObjectURL = vi.fn(() => {
      throw new Error("object url blocked");
    });
    vi.stubGlobal("URL", { ...URL, createObjectURL });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            asset: {
              id: "asset-1",
              projectId: "project-1",
              name: "icon_heart.png",
              kind: "image",
              mimeType: "image/png",
              width: 24,
              height: 24,
              sizeBytes: 12,
              objectKey: "projects/project-1/assets/asset-1/icon_heart.png",
              createdAt: "2026-05-08T00:00:00Z"
            }
          }),
          { status: 201 }
        )
      )
    );
    const store = useAssetsStore();

    const asset = await store.uploadAsset("project-1", new File(["png"], "icon_heart.png", { type: "image/png" }));

    expect(asset?.id).toBe("asset-1");
    expect(store.assets).toEqual([expect.objectContaining({ id: "asset-1" })]);
    expect(store.previewUrls).toEqual({});
    expect(store.error).toBeNull();
  });

  it("keeps local image metadata when preview object URL creation fails", () => {
    const createObjectURL = vi.fn(() => {
      throw new Error("object url blocked");
    });
    vi.stubGlobal("URL", { ...URL, createObjectURL });
    const store = useAssetsStore();

    const asset = store.importLocalAsset("project-local", new File(["png"], "heart.png", { type: "image/png" }));

    expect(asset?.id).toMatch(/^local-heart-png-/);
    expect(store.assets).toEqual([expect.objectContaining({ id: asset?.id })]);
    expect(store.previewUrls).toEqual({});
    expect(store.localFiles[asset?.id ?? ""]?.name).toBe("heart.png");
    expect(store.error).toBeNull();
  });

  it("uploads a stored local asset and removes its local state after success", async () => {
    const createObjectURL = vi.fn()
      .mockReturnValueOnce("blob:local-heart")
      .mockReturnValueOnce("blob:cloud-heart");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          asset: {
            id: "asset-cloud",
            projectId: "project-cloud",
            name: "heart.png",
            kind: "image",
            mimeType: "image/png",
            width: 1,
            height: 1,
            sizeBytes: 3,
            objectKey: "projects/project-cloud/assets/asset-cloud/heart.png",
            createdAt: "2026-05-08T00:00:00Z"
          }
        }),
        { status: 201 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();
    const localAsset = store.importLocalAsset("project-local", new File(["png"], "heart.png", { type: "image/png" }));
    expect(localAsset).not.toBeNull();

    const uploaded = await store.uploadStoredLocalAsset("project-cloud", localAsset!.id);

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-cloud/assets", expect.objectContaining({ method: "POST" }));
    expect(uploaded).toEqual({
      oldAssetId: localAsset!.id,
      asset: expect.objectContaining({ id: "asset-cloud", objectKey: "projects/project-cloud/assets/asset-cloud/heart.png" })
    });
    expect(store.assets).toEqual([expect.objectContaining({ id: "asset-cloud" })]);
    expect(store.previewUrls).toEqual({ "asset-cloud": "blob:cloud-heart" });
    expect(store.localFiles[localAsset!.id]).toBeUndefined();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-heart");
  });

  it("stores a localized error when upload fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "UNSUPPORTED_ASSET_TYPE", message: "only PNG and JPG assets are supported" } }), {
          status: 400
        })
      )
    );
    const store = useAssetsStore();

    await store.uploadAsset("project-1", new File(["png"], "broken.png", { type: "image/png" }));

    expect(store.assets).toHaveLength(0);
    expect(store.error).toBe("Only PNG, JPG, TTF, OTF, WOFF and WOFF2 assets are supported");
  });

  it("keeps the latest upload state when upload requests resolve out of order", async () => {
    let resolveFirstUpload: (response: Response) => void = () => undefined;
    const firstUploadResponse = new Promise<Response>((resolve) => {
      resolveFirstUpload = resolve;
    });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstUploadResponse)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            asset: {
              id: "asset-2",
              projectId: "project-1",
              name: "second.png",
              kind: "image",
              mimeType: "image/png",
              width: 24,
              height: 24,
              sizeBytes: 12,
              objectKey: "projects/project-1/assets/asset-2/second.png",
              createdAt: "2026-05-08T00:00:00Z"
            }
          }),
          { status: 201 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();

    const firstUpload = store.uploadAsset("project-1", new File(["png"], "first.png", { type: "image/png" }));
    const secondUpload = store.uploadAsset("project-1", new File(["png"], "second.png", { type: "image/png" }));
    await secondUpload;

    expect(store.assets).toEqual([expect.objectContaining({ id: "asset-2", name: "second.png" })]);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);

    resolveFirstUpload(new Response(JSON.stringify({
      error: { code: "ASSET_CREATE_FAILED", message: "old upload failed" }
    }), { status: 500 }));
    await firstUpload;

    expect(store.assets).toEqual([expect.objectContaining({ id: "asset-2", name: "second.png" })]);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it("does not append an older successful upload after a newer upload has completed", async () => {
    let resolveFirstUpload: (response: Response) => void = () => undefined;
    const firstUploadResponse = new Promise<Response>((resolve) => {
      resolveFirstUpload = resolve;
    });
    const fetchMock = vi.fn()
      .mockReturnValueOnce(firstUploadResponse)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            asset: {
              id: "asset-2",
              projectId: "project-1",
              name: "second.png",
              kind: "image",
              mimeType: "image/png",
              width: 24,
              height: 24,
              sizeBytes: 12,
              objectKey: "projects/project-1/assets/asset-2/second.png",
              createdAt: "2026-05-08T00:00:00Z"
            }
          }),
          { status: 201 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();

    const firstUpload = store.uploadAsset("project-1", new File(["png"], "first.png", { type: "image/png" }));
    const secondUpload = store.uploadAsset("project-1", new File(["png"], "second.png", { type: "image/png" }));
    await secondUpload;

    resolveFirstUpload(new Response(JSON.stringify({
      asset: {
        id: "asset-1",
        projectId: "project-1",
        name: "first.png",
        kind: "image",
        mimeType: "image/png",
        width: 24,
        height: 24,
        sizeBytes: 12,
        objectKey: "projects/project-1/assets/asset-1/first.png",
        createdAt: "2026-05-08T00:00:00Z"
      }
    }), { status: 201 }));

    await expect(firstUpload).resolves.toBeNull();
    expect(store.assets).toEqual([expect.objectContaining({ id: "asset-2", name: "second.png" })]);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it("stores Chinese upload API errors when the locale is Chinese", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "UNSUPPORTED_ASSET_TYPE", message: "only PNG and JPG assets are supported" } }), {
          status: 400
        })
      )
    );
    useLocaleStore().setLocale("zh-CN");
    const store = useAssetsStore();

    await store.uploadAsset("project-1", new File(["png"], "broken.png", { type: "image/png" }));

    expect(store.assets).toHaveLength(0);
    expect(store.error).toBe("仅支持 PNG、JPG、TTF、OTF、WOFF 和 WOFF2 资源");
  });

  it("keeps Chinese upload errors localized when the API returns non-JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>server error</html>", { status: 500, headers: { "Content-Type": "text/html" } }))
    );
    useLocaleStore().setLocale("zh-CN");
    const store = useAssetsStore();

    await store.uploadAsset("project-1", new File(["png"], "broken.png", { type: "image/png" }));

    expect(store.assets).toHaveLength(0);
    expect(store.error).toBe("资源上传失败");
    expect(store.error).not.toContain("Unexpected token");
  });

  it("keeps Chinese asset list errors localized when the API returns an empty body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    useLocaleStore().setLocale("zh-CN");
    const store = useAssetsStore();

    await store.loadAssets("project-1");

    expect(store.assets).toHaveLength(0);
    expect(store.error).toBe("资源列表加载失败");
    expect(store.error).not.toContain("Unexpected end");
  });

  it("rejects unsupported asset MIME types before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();

    const asset = await store.uploadAsset("project-1", new File(["txt"], "notes.txt", { type: "text/plain" }));

    expect(asset).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.error).toBe("Only PNG, JPG, TTF, OTF, WOFF and WOFF2 assets are supported");
    expect(store.loading).toBe(false);
  });

  it("rejects assets over 5MB before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });

    const asset = await store.uploadAsset("project-1", file);

    expect(asset).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.error).toBe("Asset file is too large");
    expect(store.loading).toBe(false);
  });

  it("deletes an uploaded asset from the asset list", async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn().mockReturnValue("blob:icon-heart"), revokeObjectURL });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            asset: {
              id: "asset-1",
              projectId: "project-1",
              name: "icon_heart.png",
              kind: "image",
              mimeType: "image/png",
              width: 24,
              height: 24,
              sizeBytes: 12,
              objectKey: "projects/project-1/assets/asset-1/icon_heart.png",
              createdAt: "2026-05-08T00:00:00Z"
            }
          }),
          { status: 201 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();

    await store.uploadAsset("project-1", new File(["png"], "icon_heart.png", { type: "image/png" }));
    await store.deleteAsset("project-1", "asset-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/assets/asset-1", expect.objectContaining({ method: "DELETE" }));
    expect(store.assets).toEqual([]);
    expect(store.previewUrls).toEqual({});
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:icon-heart");
  });

  it("keeps the latest delete state when delete requests resolve out of order", async () => {
    let resolveFirstDelete: (response: Response) => void = () => undefined;
    const firstDeleteResponse = new Promise<Response>((resolve) => {
      resolveFirstDelete = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/projects/project-1/assets/asset-1") {
        return firstDeleteResponse;
      }
      if (url === "/api/projects/project-1/assets/asset-2") {
        return Promise.resolve(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
      }
      return Promise.reject(new Error(`unexpected request ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();
    store.assets = [
      {
        id: "asset-1",
        projectId: "project-1",
        name: "first.png",
        kind: "image",
        mimeType: "image/png",
        sizeBytes: 12,
        objectKey: "projects/project-1/assets/asset-1/first.png",
        createdAt: "2026-05-08T00:00:00Z"
      },
      {
        id: "asset-2",
        projectId: "project-1",
        name: "second.png",
        kind: "image",
        mimeType: "image/png",
        sizeBytes: 12,
        objectKey: "projects/project-1/assets/asset-2/second.png",
        createdAt: "2026-05-08T00:00:00Z"
      }
    ];

    const firstDelete = store.deleteAsset("project-1", "asset-1");
    const secondDelete = store.deleteAsset("project-1", "asset-2");
    await secondDelete;

    expect(store.assets).toEqual([expect.objectContaining({ id: "asset-1" })]);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);

    resolveFirstDelete(new Response(JSON.stringify({
      error: { code: "ASSET_DELETE_FAILED", message: "old delete failed" }
    }), { status: 500 }));
    await firstDelete;

    expect(store.assets).toEqual([expect.objectContaining({ id: "asset-1" })]);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it("deletes a local asset from state without calling the API", () => {
    const revokeObjectURL = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn().mockReturnValue("blob:local-heart"), revokeObjectURL });
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();
    const asset = store.importLocalAsset("project-local", new File(["png"], "heart.png", { type: "image/png" }));

    const deleted = store.deleteLocalAsset(asset?.id ?? "");

    expect(deleted).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.assets).toEqual([]);
    expect(store.previewUrls).toEqual({});
    expect(store.localFiles[asset?.id ?? ""]).toBeUndefined();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-heart");
  });

  it("removes assets from state when preview URL revocation fails", () => {
    const revokeObjectURL = vi.fn(() => {
      throw new Error("revoke blocked");
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn().mockReturnValue("blob:local-heart"), revokeObjectURL });
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();
    const asset = store.importLocalAsset("project-local", new File(["png"], "heart.png", { type: "image/png" }));

    const deleted = store.deleteLocalAsset(asset?.id ?? "");

    expect(deleted).toBe(true);
    expect(store.assets).toEqual([]);
    expect(store.previewUrls).toEqual({});
    expect(store.localFiles[asset?.id ?? ""]).toBeUndefined();
    expect(store.error).toBeNull();
  });

  it("loads persisted assets and hydrates preview object URLs", async () => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn().mockReturnValue("blob:persisted-icon") });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        assets: [{
          id: "asset-1",
          projectId: "project-1",
          name: "icon_heart.png",
          kind: "image",
          mimeType: "image/png",
          width: 24,
          height: 24,
          sizeBytes: 12,
          objectKey: "projects/project-1/assets/asset-1/icon_heart.png",
          createdAt: "2026-05-08T00:00:00Z"
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Blob(["png"], { type: "image/png" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();

    await store.loadAssets("project-1");

    expect(store.assets).toHaveLength(1);
    expect(store.previewUrls["asset-1"]).toBe("blob:persisted-icon");
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/assets/asset-1/content", expect.any(Object));
  });

  it("keeps the latest project assets when asset list requests resolve out of order", async () => {
    let resolveProjectOne: (response: Response) => void = () => undefined;
    let resolveProjectTwo: (response: Response) => void = () => undefined;
    const projectOneResponse = new Promise<Response>((resolve) => {
      resolveProjectOne = resolve;
    });
    const projectTwoResponse = new Promise<Response>((resolve) => {
      resolveProjectTwo = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/projects/project-1/assets") {
        return projectOneResponse;
      }
      if (url === "/api/projects/project-2/assets") {
        return projectTwoResponse;
      }
      return Promise.reject(new Error(`unexpected request ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();

    const firstLoad = store.loadAssets("project-1");
    const secondLoad = store.loadAssets("project-2");
    resolveProjectTwo(new Response(JSON.stringify({
      assets: [{
        id: "font-2",
        projectId: "project-2",
        name: "project-two.ttf",
        kind: "font",
        mimeType: "font/ttf",
        sizeBytes: 12,
        objectKey: "projects/project-2/assets/font-2/project-two.ttf",
        createdAt: "2026-05-08T00:00:00Z"
      }]
    }), { status: 200 }));
    await secondLoad;

    expect(store.assets).toEqual([expect.objectContaining({ id: "font-2", projectId: "project-2" })]);

    resolveProjectOne(new Response(JSON.stringify({
      assets: [{
        id: "font-1",
        projectId: "project-1",
        name: "project-one.ttf",
        kind: "font",
        mimeType: "font/ttf",
        sizeBytes: 12,
        objectKey: "projects/project-1/assets/font-1/project-one.ttf",
        createdAt: "2026-05-08T00:00:00Z"
      }]
    }), { status: 200 }));
    await firstLoad;

    expect(store.assets).toEqual([expect.objectContaining({ id: "font-2", projectId: "project-2" })]);
    expect(store.error).toBeNull();
  });

  it("does not restore a deleted asset when an older asset list load resolves later", async () => {
    let resolveAssetList: (response: Response) => void = () => undefined;
    const assetListResponse = new Promise<Response>((resolve) => {
      resolveAssetList = resolve;
    });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/projects/project-1/assets") {
        return assetListResponse;
      }
      if (url === "/api/projects/project-1/assets/asset-1" && init?.method === "DELETE") {
        return Promise.resolve(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
      }
      return Promise.reject(new Error(`unexpected request ${init?.method ?? "GET"} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();
    store.assets = [{
      id: "asset-1",
      projectId: "project-1",
      name: "icon_heart.png",
      kind: "image",
      mimeType: "image/png",
      sizeBytes: 12,
      objectKey: "projects/project-1/assets/asset-1/icon_heart.png",
      createdAt: "2026-05-08T00:00:00Z"
    }];

    const load = store.loadAssets("project-1");
    await store.deleteAsset("project-1", "asset-1");
    expect(store.assets).toEqual([]);

    resolveAssetList(new Response(JSON.stringify({
      assets: [{
        id: "asset-1",
        projectId: "project-1",
        name: "icon_heart.png",
        kind: "image",
        mimeType: "image/png",
        sizeBytes: 12,
        objectKey: "projects/project-1/assets/asset-1/icon_heart.png",
        createdAt: "2026-05-08T00:00:00Z"
      }]
    }), { status: 200 }));
    await load;

    expect(store.assets).toEqual([]);
    expect(store.error).toBeNull();
  });

  it("clears stale assets and preview URLs when the latest asset list load fails", async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn().mockReturnValue("blob:local-heart"), revokeObjectURL });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "ASSET_LIST_FAILED", message: "asset list failed" } }), { status: 500 }))
    );
    const store = useAssetsStore();
    const staleAsset = store.importLocalAsset("project-1", new File(["png"], "heart.png", { type: "image/png" }));
    expect(staleAsset).not.toBeNull();

    await store.loadAssets("project-2");

    expect(store.assets).toEqual([]);
    expect(store.previewUrls).toEqual({});
    expect(store.localFiles).toEqual({});
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-heart");
    expect(store.error).toBe("Asset list failed");
  });

  it("keeps latest preview URLs when stale image hydration resolves after a newer load", async () => {
    const createObjectURL = vi.fn((source: Blob) =>
      source.size === "project-two".length ? "blob:project-two" : "blob:project-one"
    );
    vi.stubGlobal("URL", { ...URL, createObjectURL });
    let resolveProjectOneContent: (response: Response) => void = () => undefined;
    const projectOneContent = new Promise<Response>((resolve) => {
      resolveProjectOneContent = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/projects/project-1/assets") {
        return Promise.resolve(new Response(JSON.stringify({
          assets: [{
            id: "image-1",
            projectId: "project-1",
            name: "one.png",
            kind: "image",
            mimeType: "image/png",
            width: 1,
            height: 1,
            sizeBytes: 12,
            objectKey: "projects/project-1/assets/image-1/one.png",
            createdAt: "2026-05-08T00:00:00Z"
          }]
        }), { status: 200 }));
      }
      if (url === "/api/projects/project-1/assets/image-1/content") {
        return projectOneContent;
      }
      if (url === "/api/projects/project-2/assets") {
        return Promise.resolve(new Response(JSON.stringify({
          assets: [{
            id: "image-2",
            projectId: "project-2",
            name: "two.png",
            kind: "image",
            mimeType: "image/png",
            width: 1,
            height: 1,
            sizeBytes: 12,
            objectKey: "projects/project-2/assets/image-2/two.png",
            createdAt: "2026-05-08T00:00:00Z"
          }]
        }), { status: 200 }));
      }
      if (url === "/api/projects/project-2/assets/image-2/content") {
        return Promise.resolve(new Response(new Blob(["project-two"], { type: "image/png" }), { status: 200 }));
      }
      return Promise.reject(new Error(`unexpected request ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();

    const firstLoad = store.loadAssets("project-1");
    await waitForFetchCall(fetchMock, "/api/projects/project-1/assets/image-1/content");
    const secondLoad = store.loadAssets("project-2");
    await secondLoad;

    expect(store.assets).toEqual([expect.objectContaining({ id: "image-2", projectId: "project-2" })]);
    expect(store.previewUrls).toEqual({ "image-2": "blob:project-two" });

    resolveProjectOneContent(new Response(new Blob(["project-one"], { type: "image/png" }), { status: 200 }));
    await firstLoad;

    expect(store.assets).toEqual([expect.objectContaining({ id: "image-2", projectId: "project-2" })]);
    expect(store.previewUrls).toEqual({ "image-2": "blob:project-two" });
  });
});

async function waitForFetchCall(fetchMock: ReturnType<typeof vi.fn>, url: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (fetchMock.mock.calls.some(([calledUrl]) => calledUrl === url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`expected fetch call ${url}`);
}
