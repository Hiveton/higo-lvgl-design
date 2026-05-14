import { authHeaders } from "./auth";
import { ApiError } from "./projects";

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

type ErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

async function apiError(response: Response, fallback: string): Promise<ApiError> {
  let message = fallback;
  try {
    const payload = (await response.clone().json()) as ErrorPayload;
    if (payload.error?.message) {
      message = payload.error.message;
    }
  } catch {
    // Keep the endpoint-specific fallback when the body is not JSON.
  }
  return new ApiError(message, response.status);
}

export async function getJob(jobId: string): Promise<JobResponse> {
  const response = await fetch(`/api/jobs/${jobId}`, {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw await apiError(response, `job lookup failed with status ${response.status}`);
  }
  return response.json() as Promise<JobResponse>;
}

export async function downloadJobResult(downloadUrl: string): Promise<Blob> {
  const response = await fetch(downloadUrl, {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw await apiError(response, `job download failed with status ${response.status}`);
  }
  return response.blob();
}
