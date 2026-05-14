import { defineStore } from "pinia";
import { ref } from "vue";
import { getJob, type JobResponse } from "../api/jobs";
import { exportProjectC } from "../api/projects";

export type BuildStatus = "idle" | "saving" | "queued" | "running" | "succeeded" | "failed";

export type BuildLogEntry = {
  id: string;
  time: string;
  message: string;
};

type StartExportOptions = {
  pollLimit?: number;
  pollIntervalMs?: number;
};

export const useJobsStore = defineStore("jobs", () => {
  const buildStatus = ref<BuildStatus>("idle");
  const exportDownloadUrl = ref<string | null>(null);
  const logEntries = ref<BuildLogEntry[]>([]);
  const appendedLogKeys = ref<Set<string>>(new Set());

  function beginSaving(): boolean {
    if (buildStatus.value === "saving" || buildStatus.value === "queued" || buildStatus.value === "running") {
      return false;
    }
    buildStatus.value = "saving";
    exportDownloadUrl.value = null;
    logEntries.value = [];
    appendedLogKeys.value = new Set();
    return true;
  }

  async function startExport(projectId: string, options: StartExportOptions = {}): Promise<boolean> {
    const pollLimit = options.pollLimit ?? 10;
    const pollIntervalMs = options.pollIntervalMs ?? 500;
    buildStatus.value = "queued";
    try {
      const exportResponse = await exportProjectC(projectId);
      appendUniqueJobLog(exportResponse.jobId, "status:queued", "Job status: queued");
      let finished = false;
      for (let attempt = 0; attempt < pollLimit; attempt += 1) {
        const jobResponse = await getJob(exportResponse.jobId);
        appendJobLogs(jobResponse);
        buildStatus.value = jobStatusToBuildStatus(jobResponse.job.status);
        if (jobResponse.job.status === "succeeded" || jobResponse.job.status === "failed") {
          finished = true;
          break;
        }
        if (attempt < pollLimit - 1) {
          await sleep(pollIntervalMs);
        }
      }
      if (!finished) {
        buildStatus.value = "failed";
        appendUniqueJobLog(exportResponse.jobId, "poll-timeout", `Export job timed out after ${pollLimit} polls`);
      }
      return buildStatus.value === "succeeded";
    } catch (error) {
      buildStatus.value = "failed";
      appendLog(error instanceof Error ? error.message : "Build failed", "10:21:12");
      return false;
    }
  }

  function markFailed(message: string): void {
    buildStatus.value = "failed";
    appendLog(message, "10:21:12");
  }

  function appendJobLogs(jobResponse: JobResponse): void {
    if (jobResponse.job.result?.downloadUrl) {
      exportDownloadUrl.value = jobResponse.job.result.downloadUrl;
    }
    appendUniqueJobLog(jobResponse.job.id, `status:${jobResponse.job.status}`, `Job status: ${jobResponse.job.status}`);
    if (jobResponse.job.error?.message) {
      appendUniqueJobLog(
        jobResponse.job.id,
        `error:${jobResponse.job.error.code}:${jobResponse.job.error.message}`,
        jobResponse.job.error.message
      );
    }
    for (const entry of jobResponse.job.logs) {
      const key = `${jobResponse.job.id}:${entry.time}:${entry.level}:${entry.message}`;
      appendUniqueJobLog(jobResponse.job.id, key, entry.message, formatLogTime(entry.time));
    }
  }

  function appendUniqueJobLog(jobId: string, key: string, message: string, time = "10:21:12"): void {
    if (appendedLogKeys.value.has(key)) {
      return;
    }
    appendedLogKeys.value.add(key);
    logEntries.value.push({
      id: `log-${jobId}-${logEntries.value.length}`,
      time,
      message
    });
  }

  function appendLog(message: string, time: string): void {
    logEntries.value.push({
      id: `log-build-${logEntries.value.length}`,
      time,
      message
    });
  }

  return {
    buildStatus,
    exportDownloadUrl,
    logEntries,
    beginSaving,
    startExport,
    markFailed
  };
});

function jobStatusToBuildStatus(status: JobResponse["job"]["status"]): BuildStatus {
  return status === "queued"
    ? "queued"
    : status === "running"
      ? "running"
      : status === "succeeded"
        ? "succeeded"
        : "failed";
}

function formatLogTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().slice(11, 19);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
