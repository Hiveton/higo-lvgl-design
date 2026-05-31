import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJobsStore } from "./jobs";
import { useLocaleStore } from "./locale";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

function job(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "job-1",
    kind: "export_c",
    status: "queued",
    progress: 0,
    logs: [],
    ...overrides
  };
}

describe("useJobsStore", () => {
  it("creates an export job, polls until success and records job logs once", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-1" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-1",
          status: "running",
          progress: 50,
          logs: [{ time: "2026-05-08T00:00:00Z", level: "info", message: "Generating code" }]
        })
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-1",
          status: "succeeded",
          progress: 100,
          logs: [
            { time: "2026-05-08T00:00:00Z", level: "info", message: "Generating code" },
            { time: "2026-05-08T00:00:01Z", level: "info", message: "Build completed successfully" }
          ],
          result: { downloadUrl: "/api/jobs/job-1/download" }
        })
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

  it("passes export snapshot options to the project API", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-1" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-1",
          status: "succeeded",
          progress: 100,
          logs: [],
          result: { downloadUrl: "/api/jobs/job-1/download" }
        })
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useJobsStore();

    const run = store.startExport("project-1", { createVersion: false });
    await run;

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/projects/project-1/export/c",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ createVersion: false })
      })
    );
  });

  it("rejects a polled export job that belongs to another project", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-1" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-1",
          projectId: "project-2",
          status: "succeeded",
          progress: 100,
          logs: [{ time: "2026-05-08T00:00:00Z", level: "info", message: "Build completed successfully" }],
          result: { downloadUrl: "/api/jobs/job-1/download" }
        })
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useJobsStore();

    await expect(store.startExport("project-1")).resolves.toBe(false);

    expect(store.buildStatus).toBe("failed");
    expect(store.exportDownloadUrl).toBeNull();
    expect(store.logEntries.map((entry) => entry.message)).toEqual([
      "Job status: queued",
      "Job lookup failed"
    ]);
  });

  it("starts each export run with fresh logs and no stale download URL", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-1" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-1",
          status: "succeeded",
          progress: 100,
          logs: [{ time: "2026-05-08T00:00:00Z", level: "info", message: "Build completed successfully" }],
          result: { downloadUrl: "/api/jobs/job-1/download" }
        })
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-2" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-2",
          status: "failed",
          progress: 100,
          logs: [{ time: "2026-05-08T00:00:01Z", level: "error", message: "Build failed" }],
          error: { code: "CODEGEN_FAILED", message: "unsupported widget type: unknown" }
        })
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useJobsStore();

    await expect(store.startExport("project-1")).resolves.toBe(true);
    expect(store.exportDownloadUrl).toBe("/api/jobs/job-1/download");

    await expect(store.startExport("project-1")).resolves.toBe(false);

    expect(store.exportDownloadUrl).toBeNull();
    expect(store.logEntries.map((entry) => entry.message)).toEqual([
      "Job status: queued",
      "Job status: failed",
      "Code generation failed: unsupported widget type: unknown",
      "Build failed"
    ]);
  });

  it("keeps the latest export run when polling resolves out of order", async () => {
    let resolveFirstPoll: (response: Response) => void = () => undefined;
    const firstPollResponse = new Promise<Response>((resolve) => {
      resolveFirstPoll = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/projects/project-1/export/c") {
        return Promise.resolve(new Response(JSON.stringify({ jobId: "job-1" }), { status: 202 }));
      }
      if (url === "/api/projects/project-2/export/c") {
        return Promise.resolve(new Response(JSON.stringify({ jobId: "job-2" }), { status: 202 }));
      }
      if (url === "/api/jobs/job-1") {
        return firstPollResponse;
      }
      if (url === "/api/jobs/job-2") {
        return Promise.resolve(new Response(JSON.stringify({
          job: job({
            id: "job-2",
            status: "succeeded",
            progress: 100,
            logs: [{ time: "2026-05-08T00:00:01Z", level: "info", message: "Build completed successfully" }],
            result: { downloadUrl: "/api/jobs/job-2/download" }
          })
        }), { status: 200 }));
      }
      return Promise.reject(new Error(`unexpected request ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useJobsStore();

    const firstRun = store.startExport("project-1");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job-1", expect.any(Object)));
    const secondRun = store.startExport("project-2");
    await secondRun;

    expect(store.buildStatus).toBe("succeeded");
    expect(store.exportDownloadUrl).toBe("/api/jobs/job-2/download");
    expect(store.logEntries.map((entry) => entry.message)).toEqual([
      "Job status: queued",
      "Job status: succeeded",
      "Build completed successfully"
    ]);

    resolveFirstPoll(new Response(JSON.stringify({
      job: job({
        id: "job-1",
        status: "failed",
        progress: 100,
        logs: [{ time: "2026-05-08T00:00:00Z", level: "error", message: "Build failed" }],
        error: { code: "CODEGEN_FAILED", message: "old export failed" }
      })
    }), { status: 200 }));
    await firstRun;

    expect(store.buildStatus).toBe("succeeded");
    expect(store.exportDownloadUrl).toBe("/api/jobs/job-2/download");
    expect(store.logEntries.map((entry) => entry.message)).toEqual([
      "Job status: queued",
      "Job status: succeeded",
      "Build completed successfully"
    ]);
  });

  it("ignores stale export jobs when job creation resolves out of order", async () => {
    let resolveFirstExport: (response: Response) => void = () => undefined;
    const firstExportResponse = new Promise<Response>((resolve) => {
      resolveFirstExport = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/projects/project-1/export/c") {
        return firstExportResponse;
      }
      if (url === "/api/projects/project-2/export/c") {
        return Promise.resolve(new Response(JSON.stringify({ jobId: "job-2" }), { status: 202 }));
      }
      if (url === "/api/jobs/job-1") {
        return Promise.resolve(new Response(JSON.stringify({
          job: job({ id: "job-1", status: "failed", progress: 100, logs: [] })
        }), { status: 200 }));
      }
      if (url === "/api/jobs/job-2") {
        return Promise.resolve(new Response(JSON.stringify({
          job: job({
            id: "job-2",
            status: "succeeded",
            progress: 100,
            logs: [{ time: "2026-05-08T00:00:01Z", level: "info", message: "Build completed successfully" }],
            result: { downloadUrl: "/api/jobs/job-2/download" }
          })
        }), { status: 200 }));
      }
      return Promise.reject(new Error(`unexpected request ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
    const store = useJobsStore();

    const firstRun = store.startExport("project-1");
    const secondRun = store.startExport("project-2");
    await secondRun;
    resolveFirstExport(new Response(JSON.stringify({ jobId: "job-1" }), { status: 202 }));
    await firstRun;

    expect(store.buildStatus).toBe("succeeded");
    expect(store.exportDownloadUrl).toBe("/api/jobs/job-2/download");
    expect(store.logEntries.map((entry) => entry.message)).toEqual([
      "Job status: queued",
      "Job status: succeeded",
      "Build completed successfully"
    ]);
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/jobs/job-1")).toBe(false);
  });

  it("adds the configured build failure message when a failed job has no error detail", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-failed" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-failed",
          status: "failed",
          progress: 100,
          logs: []
        })
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const store = useJobsStore();

    await expect(store.startExport("project-1", { buildFailedMessage: "Build could not finish" })).resolves.toBe(false);

    expect(store.buildStatus).toBe("failed");
    expect(store.logEntries.map((entry) => entry.message)).toEqual([
      "Job status: queued",
      "Job status: failed",
      "Build could not finish"
    ]);
  });

  it("marks export failed when polling never reaches a terminal status", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-timeout" }), { status: 202 }));
    for (let index = 0; index < 10; index += 1) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-timeout",
          status: "running",
          progress: 50,
          logs: [{ time: "2026-05-08T00:00:00Z", level: "info", message: "Generating code" }]
        })
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

  it("localizes job status, known backend logs and job error codes in Chinese", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ jobId: "job-failed" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        job: job({
          id: "job-failed",
          status: "failed",
          progress: 100,
          logs: [
            { time: "2026-05-08T00:00:00Z", level: "info", message: "Build started" },
            { time: "2026-05-08T00:00:01Z", level: "info", message: "Generating code" }
          ],
          error: { code: "CODEGEN_FAILED", message: "unsupported widget type: unknown" }
        })
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    useLocaleStore().setLocale("zh-CN");
    const store = useJobsStore();

    const run = store.startExport("project-1");
    await vi.advanceTimersByTimeAsync(500);
    await run;

    expect(store.buildStatus).toBe("failed");
    expect(store.logEntries.map((entry) => entry.message)).toEqual([
      "任务状态：排队中",
      "任务状态：失败",
      "代码生成失败",
      "构建已开始",
      "正在生成代码"
    ]);
    expect(store.logEntries.map((entry) => entry.message).join("\n")).not.toContain("unsupported widget type");
  });
});
