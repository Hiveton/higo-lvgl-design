import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultProjectDoc } from "@hiveton-lvgl/schema";
import { createProject, createProjectVersion, downloadJobResult, exportProjectC, getJob, getProject, listProjects, saveProjectDoc } from "./projects";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("projects api", () => {
  const validDoc = createDefaultProjectDoc({
    id: "project-1",
    name: "My Watch UI",
    updatedAt: "2026-05-08T00:00:00Z"
  });

  it("lists, creates and reads projects with auth headers", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{ id: "project-1", name: "My Watch UI", doc: validDoc, createdAt: "2026-05-08T00:00:00Z", updatedAt: "2026-05-08T00:00:00Z" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "project-2", name: "New UI", doc: { ...validDoc, id: "project-2", name: "New UI" }, createdAt: "2026-05-08T00:00:00Z", updatedAt: "2026-05-08T00:00:00Z" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "project-2", name: "New UI", doc: { ...validDoc, id: "project-2", name: "New UI" }, createdAt: "2026-05-08T00:00:00Z", updatedAt: "2026-05-08T00:00:00Z" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProjects()).resolves.toMatchObject([{ id: "project-1", name: "My Watch UI" }]);
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
            label: "Before Build",
            doc: validDoc,
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
      name: "Before Build",
      label: "Before Build",
      doc: validDoc
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/versions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Before Build" })
      })
    );
  });

  it("exports C code without creating a version snapshot when requested", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ jobId: "job-1" }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(exportProjectC("project-1", { createVersion: false })).resolves.toEqual({ jobId: "job-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/export/c",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ createVersion: false })
      })
    );
  });

  it("normalizes export job ids before returning them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ jobId: "  job-1  " }), { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(exportProjectC("project-1")).resolves.toEqual({ jobId: "job-1" });
  });

  it("rejects malformed successful project payloads", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{}] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: null }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: {} }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: {} }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: null }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: {} }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{ id: "project-1", name: "Bad Time", doc: {}, createdAt: "yesterday", updatedAt: "2026-05-08T00:00:00Z" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "project-1", name: "Bad Time", doc: {}, createdAt: "2026-05-08T00:00:00Z", updatedAt: "today" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: { id: "version-1", projectId: "project-1", name: "Bad Time", label: "Bad Time", doc: {}, createdAt: "tomorrow" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{ id: "project-1", name: "Bad Doc", doc: {}, createdAt: "2026-05-08T00:00:00Z", updatedAt: "2026-05-08T00:00:00Z" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "project-1", name: "Bad Doc", doc: {}, createdAt: "2026-05-08T00:00:00Z", updatedAt: "2026-05-08T00:00:00Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: { id: "version-1", projectId: "project-1", name: "Bad Doc", label: "Bad Doc", doc: {}, createdAt: "2026-05-08T00:00:00Z" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "project-2", name: "Wrong Project", doc: { ...validDoc, id: "project-2", name: "Wrong Project" }, createdAt: "2026-05-08T00:00:00Z", updatedAt: "2026-05-08T00:00:00Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: { id: "version-1", projectId: "project-2", name: "Wrong Version", label: "Wrong Version", doc: validDoc, createdAt: "2026-05-08T00:00:00Z" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{ id: "project-1", name: "", doc: validDoc, createdAt: "2026-05-08T00:00:00Z", updatedAt: "2026-05-08T00:00:00Z" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "", name: "Broken", doc: validDoc, createdAt: "2026-05-08T00:00:00Z", updatedAt: "2026-05-08T00:00:00Z" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: { id: "version-1", projectId: "project-1", name: "Broken", label: "", doc: validDoc, createdAt: "2026-05-08T00:00:00Z" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{ id: "project-1", name: "Mismatched Doc", doc: { ...validDoc, id: "project-2" }, createdAt: "2026-05-08T00:00:00Z", updatedAt: "2026-05-08T00:00:00Z" }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "project-1", name: "Mismatched Doc", doc: { ...validDoc, id: "project-2" }, createdAt: "2026-05-08T00:00:00Z", updatedAt: "2026-05-08T00:00:00Z" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ project: { id: "project-1", name: "Mismatched Doc", doc: { ...validDoc, id: "project-2" }, createdAt: "2026-05-08T00:00:00Z", updatedAt: "2026-05-08T00:00:00Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: { id: "version-1", projectId: "project-1", name: "Mismatched Doc", label: "Mismatched Doc", doc: { ...validDoc, id: "project-2" }, createdAt: "2026-05-08T00:00:00Z" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: 123 }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projectId: "project-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projectId: 123, updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projectId: "project-1", updatedAt: "today" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projectId: "project-2", updatedAt: "2026-05-08T00:00:00Z" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listProjects()).rejects.toMatchObject({ code: "PROJECT_LIST_FAILED", status: 200 });
    await expect(listProjects()).rejects.toMatchObject({ code: "PROJECT_LIST_FAILED", status: 200 });
    await expect(createProject("Broken")).rejects.toMatchObject({ code: "PROJECT_CREATE_FAILED", status: 201 });
    await expect(createProject("Broken")).rejects.toMatchObject({ code: "PROJECT_CREATE_FAILED", status: 201 });
    await expect(getProject("project-1")).rejects.toMatchObject({ code: "PROJECT_LOOKUP_FAILED", status: 200 });
    await expect(getProject("project-1")).rejects.toMatchObject({ code: "PROJECT_LOOKUP_FAILED", status: 200 });
    await expect(createProjectVersion("project-1", "Broken")).rejects.toMatchObject({ code: "PROJECT_VERSION_CREATE_FAILED", status: 201 });
    await expect(createProjectVersion("project-1", "Broken")).rejects.toMatchObject({ code: "PROJECT_VERSION_CREATE_FAILED", status: 201 });
    await expect(listProjects()).rejects.toMatchObject({ code: "PROJECT_LIST_FAILED", status: 200 });
    await expect(getProject("project-1")).rejects.toMatchObject({ code: "PROJECT_LOOKUP_FAILED", status: 200 });
    await expect(createProjectVersion("project-1", "Broken")).rejects.toMatchObject({ code: "PROJECT_VERSION_CREATE_FAILED", status: 201 });
    await expect(listProjects()).rejects.toMatchObject({ code: "PROJECT_LIST_FAILED", status: 200 });
    await expect(getProject("project-1")).rejects.toMatchObject({ code: "PROJECT_LOOKUP_FAILED", status: 200 });
    await expect(createProjectVersion("project-1", "Broken")).rejects.toMatchObject({ code: "PROJECT_VERSION_CREATE_FAILED", status: 201 });
    await expect(getProject("project-1")).rejects.toMatchObject({ code: "PROJECT_LOOKUP_FAILED", status: 200 });
    await expect(createProjectVersion("project-1", "Broken")).rejects.toMatchObject({ code: "PROJECT_VERSION_CREATE_FAILED", status: 201 });
    await expect(listProjects()).rejects.toMatchObject({ code: "PROJECT_LIST_FAILED", status: 200 });
    await expect(createProject("Broken")).rejects.toMatchObject({ code: "PROJECT_CREATE_FAILED", status: 201 });
    await expect(createProjectVersion("project-1", "Broken")).rejects.toMatchObject({ code: "PROJECT_VERSION_CREATE_FAILED", status: 201 });
    await expect(listProjects()).rejects.toMatchObject({ code: "PROJECT_LIST_FAILED", status: 200 });
    await expect(createProject("Broken")).rejects.toMatchObject({ code: "PROJECT_CREATE_FAILED", status: 201 });
    await expect(getProject("project-1")).rejects.toMatchObject({ code: "PROJECT_LOOKUP_FAILED", status: 200 });
    await expect(createProjectVersion("project-1", "Broken")).rejects.toMatchObject({ code: "PROJECT_VERSION_CREATE_FAILED", status: 201 });
    await expect(exportProjectC("project-1")).rejects.toMatchObject({ code: "EXPORT_FAILED", status: 202 });
    await expect(exportProjectC("project-1")).rejects.toMatchObject({ code: "EXPORT_FAILED", status: 202 });
    await expect(saveProjectDoc("project-1", { id: "project-1" })).rejects.toMatchObject({ code: "SAVE_FAILED", status: 200 });
    await expect(saveProjectDoc("project-1", { id: "project-1" })).rejects.toMatchObject({ code: "SAVE_FAILED", status: 200 });
    await expect(saveProjectDoc("project-1", { id: "project-1" })).rejects.toMatchObject({ code: "SAVE_FAILED", status: 200 });
    await expect(saveProjectDoc("project-1", { id: "project-1" })).rejects.toMatchObject({ code: "SAVE_FAILED", status: 200 });
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
