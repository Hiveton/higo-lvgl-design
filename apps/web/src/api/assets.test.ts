import { afterEach, describe, expect, it, vi } from "vitest";
import { getProjectAssetContent, listProjectAssets, uploadProjectAsset } from "./assets";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assets api", () => {
  it("lists assets and downloads protected asset content", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
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
      .mockResolvedValueOnce(new Response(blob, { status: 200, headers: { "Content-Type": "image/png" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProjectAssets("project-1")).resolves.toHaveLength(1);
    await expect(getProjectAssetContent("project-1", "asset-1")).resolves.toBeInstanceOf(Blob);

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/assets", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-1/assets/asset-1/content", expect.any(Object));
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

  it("treats null asset lists as empty arrays", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ assets: null }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProjectAssets("project-1")).resolves.toEqual([]);
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
});
