import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadJobResult, getJob } from "./jobs";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("jobs api", () => {
  it("loads job status and downloads job result archives with auth headers", async () => {
    const archive = new Blob(["zip"], { type: "application/zip" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            job: {
              id: "job-1",
              status: "succeeded",
              logs: [],
              result: { downloadUrl: "/api/jobs/job-1/download" }
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(archive, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJob("job-1")).resolves.toMatchObject({
      job: {
        id: "job-1",
        status: "succeeded"
      }
    });
    await expect(downloadJobResult("/api/jobs/job-1/download")).resolves.toBeInstanceOf(Blob);

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
});
