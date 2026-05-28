import { authHeaders } from "./auth";
import { apiError } from "./errors";

export type JobLogEntry = {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
};

export type JobResponse = {
  job: {
    id: string;
    status: "queued" | "running" | "succeeded" | "failed";
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
  if (!response.ok) {
    throw await apiError(response, "JOB_LOOKUP_FAILED", `job lookup failed with status ${response.status}`);
  }
  return response.json() as Promise<JobResponse>;
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
