import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteProjectAsset, getProjectAssetContent, listProjectAssets, uploadProjectAsset } from "./assets";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assets api", () => {
  it("lists assets and downloads protected asset content", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        assets: [{
          id: "asset-1",
          projectId: "project-1",
          name: "icon.png",
          kind: "image",
          mimeType: "image/png",
          width: 24,
          height: 24,
          sizeBytes: 3,
          objectKey: "projects/project-1/assets/icon.png",
          createdAt: "2026-05-08T00:00:00Z"
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response("png", { status: 200, headers: { "Content-Type": "image/png" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProjectAssets("project-1")).resolves.toHaveLength(1);
    const content = await getProjectAssetContent("project-1", "asset-1");
    expect(content.size).toBe(3);
    expect(content.type).toBe("image/png");
    await expect(content.text()).resolves.toBe("png");

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/assets", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/assets/asset-1/content", expect.any(Object));
  });

  it("downloads protected font asset content with its original MIME type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("font", { status: 200, headers: { "Content-Type": "font/woff2" } }));
    vi.stubGlobal("fetch", fetchMock);

    const content = await getProjectAssetContent("project-1", "font-1");

    expect(content.type).toBe("font/woff2");
    await expect(content.text()).resolves.toBe("font");
  });

  it("accepts legacy raw array asset list responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{
        id: "asset-legacy",
        projectId: "project-1",
        name: "legacy.png",
        kind: "image",
        mimeType: "image/png",
        width: 12,
        height: 12,
        sizeBytes: 128,
        objectKey: "projects/project-1/assets/legacy.png",
        createdAt: "2026-05-08T00:00:00Z"
      }]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProjectAssets("project-1")).resolves.toEqual([
      expect.objectContaining({ id: "asset-legacy", name: "legacy.png" })
    ]);
  });

  it("rejects malformed asset list payloads", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ assets: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ assets: [{}] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        assets: [{
          id: "asset-decimal",
          projectId: "project-1",
          name: "decimal.png",
          kind: "image",
          mimeType: "image/png",
          width: 12.5,
          height: 12,
          sizeBytes: 128,
          objectKey: "projects/project-1/assets/decimal.png",
          createdAt: "2026-05-08T00:00:00Z"
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        assets: [{
          id: "asset-negative",
          projectId: "project-1",
          name: "negative.png",
          kind: "image",
          mimeType: "image/png",
          width: 12,
          height: 12,
          sizeBytes: -1,
          objectKey: "projects/project-1/assets/negative.png",
          createdAt: "2026-05-08T00:00:00Z"
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        assets: [{
          id: "asset-other-project",
          projectId: "project-2",
          name: "other.png",
          kind: "image",
          mimeType: "image/png",
          width: 12,
          height: 12,
          sizeBytes: 128,
          objectKey: "projects/project-2/assets/other.png",
          createdAt: "2026-05-08T00:00:00Z"
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        assets: [{
          id: "asset-bad-time",
          projectId: "project-1",
          name: "bad-time.png",
          kind: "image",
          mimeType: "image/png",
          width: 12,
          height: 12,
          sizeBytes: 128,
          objectKey: "projects/project-1/assets/bad-time.png",
          createdAt: "today"
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        assets: [{
          id: "",
          projectId: "project-1",
          name: "",
          kind: "image",
          mimeType: "",
          width: 12,
          height: 12,
          sizeBytes: 128,
          objectKey: "",
          createdAt: "2026-05-08T00:00:00Z"
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        assets: [{
          id: "asset-gif",
          projectId: "project-1",
          name: "animated.gif",
          kind: "image",
          mimeType: "image/gif",
          width: 12,
          height: 12,
          sizeBytes: 128,
          objectKey: "projects/project-1/assets/animated.gif",
          createdAt: "2026-05-08T00:00:00Z"
        }]
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProjectAssets("project-1")).rejects.toMatchObject({
      code: "ASSET_LIST_FAILED",
      status: 200
    });
    await expect(listProjectAssets("project-1")).rejects.toMatchObject({
      code: "ASSET_LIST_FAILED",
      status: 200
    });
    await expect(listProjectAssets("project-1")).rejects.toMatchObject({
      code: "ASSET_LIST_FAILED",
      status: 200
    });
    await expect(listProjectAssets("project-1")).rejects.toMatchObject({
      code: "ASSET_LIST_FAILED",
      status: 200
    });
    await expect(listProjectAssets("project-1")).rejects.toMatchObject({
      code: "ASSET_LIST_FAILED",
      status: 200
    });
    await expect(listProjectAssets("project-1")).rejects.toMatchObject({
      code: "ASSET_LIST_FAILED",
      status: 200
    });
    await expect(listProjectAssets("project-1")).rejects.toMatchObject({
      code: "ASSET_LIST_FAILED",
      status: 200
    });
    await expect(listProjectAssets("project-1")).rejects.toMatchObject({
      code: "ASSET_LIST_FAILED",
      status: 200
    });
  });

  it("uploads font assets with font kind metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
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
      }), { status: 201 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadProjectAsset("project-1", new File(["font"], "brand.ttf", { type: "font/ttf" }))).resolves.toMatchObject({
      id: "font-1",
      kind: "font"
    });

    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get("kind")).toBe("font");
  });

  it("rejects malformed successful asset upload payloads", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ asset: {} }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        asset: {
          id: "asset-other-project",
          projectId: "project-2",
          name: "icon.png",
          kind: "image",
          mimeType: "image/png",
          width: 12,
          height: 12,
          sizeBytes: 128,
          objectKey: "projects/project-2/assets/icon.png",
          createdAt: "2026-05-08T00:00:00Z"
        }
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        asset: {
          id: "asset-bad-time",
          projectId: "project-1",
          name: "icon.png",
          kind: "image",
          mimeType: "image/png",
          width: 12,
          height: 12,
          sizeBytes: 128,
          objectKey: "projects/project-1/assets/icon.png",
          createdAt: "today"
        }
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        asset: {
          id: "",
          projectId: "project-1",
          name: "",
          kind: "image",
          mimeType: "",
          width: 12,
          height: 12,
          sizeBytes: 128,
          objectKey: "",
          createdAt: "2026-05-08T00:00:00Z"
        }
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        asset: {
          id: "asset-1",
          projectId: "project-1",
          name: "icon.png",
          kind: "image",
          mimeType: "image/png",
          width: 12,
          height: 12,
          sizeBytes: 128,
          objectKey: "projects/project-2/assets/asset-1/icon.png",
          createdAt: "2026-05-08T00:00:00Z"
        }
      }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        asset: {
          id: "font-1",
          projectId: "project-1",
          name: "brand.bin",
          kind: "font",
          mimeType: "application/octet-stream",
          sizeBytes: 128,
          objectKey: "projects/project-1/assets/font-1/brand.bin",
          createdAt: "2026-05-08T00:00:00Z"
        }
      }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadProjectAsset("project-1", new File(["png"], "icon.png", { type: "image/png" }))).rejects.toMatchObject({
      code: "ASSET_UPLOAD_FAILED",
      status: 201
    });
    await expect(uploadProjectAsset("project-1", new File(["png"], "icon.png", { type: "image/png" }))).rejects.toMatchObject({
      code: "ASSET_UPLOAD_FAILED",
      status: 201
    });
    await expect(uploadProjectAsset("project-1", new File(["png"], "icon.png", { type: "image/png" }))).rejects.toMatchObject({
      code: "ASSET_UPLOAD_FAILED",
      status: 201
    });
    await expect(uploadProjectAsset("project-1", new File(["png"], "icon.png", { type: "image/png" }))).rejects.toMatchObject({
      code: "ASSET_UPLOAD_FAILED",
      status: 201
    });
    await expect(uploadProjectAsset("project-1", new File(["png"], "icon.png", { type: "image/png" }))).rejects.toMatchObject({
      code: "ASSET_UPLOAD_FAILED",
      status: 201
    });
    await expect(uploadProjectAsset("project-1", new File(["font"], "brand.ttf", { type: "font/ttf" }))).rejects.toMatchObject({
      code: "ASSET_UPLOAD_FAILED",
      status: 201
    });
  });

  it("rejects malformed successful asset delete payloads", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ deleted: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ deleted: "yes" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteProjectAsset("project-1", "asset-1")).rejects.toMatchObject({
      code: "ASSET_DELETE_FAILED",
      status: 200
    });
    await expect(deleteProjectAsset("project-1", "asset-1")).rejects.toMatchObject({
      code: "ASSET_DELETE_FAILED",
      status: 200
    });
    await expect(deleteProjectAsset("project-1", "asset-1")).rejects.toMatchObject({
      code: "ASSET_DELETE_FAILED",
      status: 200
    });
  });
});
