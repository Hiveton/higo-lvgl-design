import { afterEach, describe, expect, it, vi } from "vitest";
import { createProject, createProjectVersion, downloadJobResult, exportProjectC, getJob, getProject, listProjects, saveProjectDoc } from "./projects";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("projects api", () => {
  it("lists, creates and reads projects with auth headers", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{ id: "project-1", name: "My Watch UI" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "project-2", name: "New UI", doc: { schemaVersion: 1 } } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "project-2", name: "New UI", doc: { schemaVersion: 1 } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProjects()).resolves.toEqual([{ id: "project-1", name: "My Watch UI" }]);
    await expect(createProject("New UI")).resolves.toMatchObject({ id: "project-2", name: "New UI" });
    await expect(getProject("project-2")).resolves.toMatchObject({ id: "project-2", name: "New UI" });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("/api/projects", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-2", expect.any(Object));
  });

  it("downloads job results with auth headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("zip", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadJobResult("/api/jobs/job-1/download");
    expect(result.size).toBe(3);
    await expect(result.text()).resolves.toBe("zip");

    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job-1/download", expect.objectContaining({ headers: expect.any(Object) }));
  });

  it("creates a named project version snapshot", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          version: {
            id: "version-1",
            projectId: "project-1",
            name: "Before Build",
            createdAt: "2026-05-08T00:00:00Z"
          }
        }),
        { status: 201 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createProjectVersion("project-1", "Before Build")).resolves.toMatchObject({
      id: "version-1",
      projectId: "project-1",
      name: "Before Build"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/versions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Before Build" })
      })
    );
  });

  it("surfaces API error messages from project endpoints", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "PROJECT_NOT_FOUND", message: "project not found" } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "INVALID_PROJECT_DOC", message: "target width must be greater than 0" } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "PROJECT_NOT_FOUND", message: "project not found" } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "JOB_NOT_FOUND", message: "job not found" } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "JOB_RESULT_NOT_FOUND", message: "job result not found" } }), { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getProject("missing")).rejects.toThrow("project not found");
    await expect(saveProjectDoc("project-1", { id: "project-1" })).rejects.toThrow("target width must be greater than 0");
    await expect(exportProjectC("missing")).rejects.toThrow("project not found");
    await expect(getJob("missing-job")).rejects.toThrow("job not found");
    await expect(downloadJobResult("/api/jobs/job-1/download")).rejects.toThrow("job result not found");
  });
});
