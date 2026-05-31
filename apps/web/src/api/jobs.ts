import { authHeaders } from "./auth";
import { apiError, apiErrorFromPayload, parseJsonPayload, type ErrorPayload } from "./errors";
import { isRecord, isNonEmptyString } from "./utils";

export type JobLogEntry = {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
};

export type JobResponse = {
  job: {
    id: string;
    projectId?: string;
    kind: "export_c";
    status: "queued" | "running" | "succeeded" | "failed";
    progress: number;
    logs: JobLogEntry[];
    result?: {
      downloadUrl: string;
    };
    error?: {
      code: string;
      message: string;
    };
  };
};

export async function getJob(jobId: string): Promise<JobResponse> {
  const response = await fetch(`/api/jobs/${jobId}`, {
    headers: authHeaders()
  });
  const payload = await parseJsonPayload<Partial<JobResponse> & ErrorPayload>(response);
  if (!response.ok || !isJobFor(payload?.job, jobId)) {
    throw apiErrorFromPayload(response, payload, "JOB_LOOKUP_FAILED", `job lookup failed with status ${response.status}`);
  }
  return { job: payload.job };
}

export async function downloadJobResult(downloadUrl: string): Promise<Blob> {
  const response = await fetch(downloadUrl, {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw await apiError(response, "JOB_DOWNLOAD_FAILED", `job download failed with status ${response.status}`);
  }
  return response.blob();
}

function isJob(value: unknown): value is JobResponse["job"] {
  if (!isRecord(value)) {
    return false;
  }
  const progress = value.progress;
  return typeof value.id === "string"
    && (value.projectId === undefined || typeof value.projectId === "string")
    && value.kind === "export_c"
    && isJobStatus(value.status)
    && typeof progress === "number"
    && Number.isInteger(progress)
    && progress >= 0
    && progress <= 100
    && Array.isArray(value.logs)
    && value.logs.every(isJobLogEntry)
    && (value.result === undefined || isJobResult(value.result))
    && (value.error === undefined || isJobError(value.error))
    && isJobTerminalPayload(value.status, value.result, value.error);
}

function isJobFor(value: unknown, jobId: string): value is JobResponse["job"] {
  return isJob(value) && value.id === jobId;
}

function isJobStatus(value: unknown): value is JobResponse["job"]["status"] {
  return value === "queued" || value === "running" || value === "succeeded" || value === "failed";
}

function isJobLogEntry(value: unknown): value is JobLogEntry {
  if (!isRecord(value)) {
    return false;
  }
  const level = value.level;
  return isDateTime(value.time)
    && (level === "info" || level === "warn" || level === "error")
    && isNonEmptyString(value.message);
}

function isJobResult(value: unknown): value is NonNullable<JobResponse["job"]["result"]> {
  return isRecord(value) && isNonEmptyString(value.downloadUrl);
}

function isJobError(value: unknown): value is NonNullable<JobResponse["job"]["error"]> {
  return isRecord(value) && isNonEmptyString(value.code) && isNonEmptyString(value.message);
}

function isJobTerminalPayload(
  status: JobResponse["job"]["status"],
  result: unknown,
  error: unknown
): boolean {
  if (status === "succeeded" && result === undefined) {
    return false;
  }
  if (result !== undefined && status !== "succeeded") {
    return false;
  }
  if (error !== undefined && status !== "failed") {
    return false;
  }
  return true;
}

function isDateTime(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}
