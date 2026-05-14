import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJobsStore } from "./jobs";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("useJobsStore", () => {
  it("creates an export job, polls until success and records job logs once", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-1" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-1",
          status: "running",
          logs: [{ time: "2026-05-08T00:00:00Z", level: "info", message: "Generating code" }]
        }
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-1",
          status: "succeeded",
          logs: [
            { time: "2026-05-08T00:00:00Z", level: "info", message: "Generating code" },
            { time: "2026-05-08T00:00:01Z", level: "info", message: "Build completed successfully" }
          ],
          result: { downloadUrl: "/api/jobs/job-1/download" }
        }
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useJobsStore();

    const run = store.startExport("project-1");
    await vi.advanceTimersByTimeAsync(500);
    await run;

    expect(store.buildStatus).toBe("succeeded");
    expect(store.exportDownloadUrl).toBe("/api/jobs/job-1/download");
    expect(store.logEntries.map((entry) => entry.message)).toEqual([
      "Job status: queued",
      "Job status: running",
      "Generating code",
      "Job status: succeeded",
      "Build completed successfully"
    ]);
  });

  it("marks export failed when polling never reaches a terminal status", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-timeout" }), { status: 202 }));
    for (let index = 0; index < 10; index += 1) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
        job: {
          id: "job-timeout",
          status: "running",
          logs: [{ time: "2026-05-08T00:00:00Z", level: "info", message: "Generating code" }]
        }
      }), { status: 200 }));
    }
    vi.stubGlobal("fetch", fetchMock);
    const store = useJobsStore();

    const run = store.startExport("project-1");
    await vi.advanceTimersByTimeAsync(4500);
    await run;

    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(store.buildStatus).toBe("failed");
    expect(store.logEntries.map((entry) => entry.message)).toContain("Export job timed out after 10 polls");
  });
});
