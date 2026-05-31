import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadJobResult, getJob } from "./jobs";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("jobs api", () => {
  it("loads job status and downloads job result archives with auth headers", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            job: {
              id: "job-1",
              kind: "export_c",
              status: "succeeded",
              progress: 100,
              logs: [],
              result: { downloadUrl: "/api/jobs/job-1/download" }
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response("zip", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJob("job-1")).resolves.toMatchObject({
      job: {
        id: "job-1",
        status: "succeeded"
      }
    });
    const result = await downloadJobResult("/api/jobs/job-1/download");
    expect(result.size).toBe(3);
    await expect(result.text()).resolves.toBe("zip");

    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job-1", expect.objectContaining({ headers: expect.any(Object) }));
    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job-1/download", expect.objectContaining({ headers: expect.any(Object) }));
  });

  it("surfaces API error messages from job endpoints", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "JOB_NOT_FOUND", message: "job not found" } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "JOB_RESULT_NOT_FOUND", message: "job result not found" } }), { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJob("missing-job")).rejects.toThrow("job not found");
    await expect(downloadJobResult("/api/jobs/job-1/download")).rejects.toThrow("job result not found");
  });

  it("rejects malformed successful job payloads", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ job: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ job: {} }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ job: { id: "job-1", kind: "export_c", status: "succeeded", progress: 101, logs: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-1",
          kind: "export_c",
          status: "succeeded",
          progress: 100,
          logs: [{ time: "yesterday", level: "info", message: "Build completed successfully" }]
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-1",
          kind: "email",
          status: "succeeded",
          progress: 100,
          logs: []
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-2",
          kind: "export_c",
          status: "succeeded",
          progress: 100,
          logs: []
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-1",
          kind: "export_c",
          status: "succeeded",
          progress: 100,
          logs: [],
          result: { downloadUrl: "" }
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-1",
          kind: "export_c",
          status: "running",
          progress: 50,
          logs: [{ time: "2026-05-29T13:40:00Z", level: "info", message: "" }]
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-1",
          kind: "export_c",
          status: "failed",
          progress: 100,
          logs: [],
          error: { code: "", message: "Build failed" }
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-1",
          kind: "export_c",
          status: "failed",
          progress: 100,
          logs: [],
          error: { code: "CODEGEN_FAILED", message: "" }
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-1",
          kind: "export_c",
          status: "failed",
          progress: 100,
          logs: [],
          result: { downloadUrl: "/api/jobs/job-1/download" },
          error: { code: "CODEGEN_FAILED", message: "Build failed" }
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-1",
          kind: "export_c",
          status: "succeeded",
          progress: 100,
          logs: []
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-1",
          kind: "export_c",
          status: "succeeded",
          progress: 100,
          logs: [],
          result: { downloadUrl: "/api/jobs/job-1/download" },
          error: { code: "CODEGEN_FAILED", message: "Build failed" }
        }
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
    await expect(getJob("job-1")).rejects.toMatchObject({
      code: "JOB_LOOKUP_FAILED",
      status: 200
    });
  });
});
