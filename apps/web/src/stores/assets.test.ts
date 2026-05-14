import { setActivePinia, createPinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAssetsStore } from "./assets";

describe("useAssetsStore", () => {
  beforeEach(() => {
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

  it("stores an error when upload fails", async () => {
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
    expect(store.error).toBe("only PNG and JPG assets are supported");
  });

  it("rejects unsupported asset MIME types before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const store = useAssetsStore();

    const asset = await store.uploadAsset("project-1", new File(["txt"], "notes.txt", { type: "text/plain" }));

    expect(asset).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.error).toBe("only PNG, JPG, TTF, OTF, WOFF and WOFF2 assets are supported");
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
    expect(store.error).toBe("asset file is too large");
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
});
