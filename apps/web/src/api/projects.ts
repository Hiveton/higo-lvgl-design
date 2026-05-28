import { authHeaders } from "./auth";
import { apiError, ApiError } from "./errors";

export type ProjectSummary = {
  id: string;
  name: string;
  doc?: unknown;
  target?: unknown;
  updatedAt?: string;
};

export type ProjectResponse = {
  id: string;
  name: string;
  doc: unknown;
  updatedAt?: string;
};

export type ExportJobResponse = {
  jobId: string;
};

export type ProjectVersionResponse = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
};

export async function listProjects(): Promise<ProjectSummary[]> {
  const response = await fetch("/api/projects", {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw await apiError(response, "PROJECT_LIST_FAILED", `project list failed with status ${response.status}`);
  }
  const payload = (await response.json()) as { projects: ProjectSummary[] };
  return payload.projects;
}

export async function createProject(name: string, target?: ProjectSummary["target"]): Promise<ProjectResponse> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({
      name,
      target: target ?? {
        lvglVersion: "8.3",
        deviceName: "ESP32-S3",
        width: 480,
        height: 480,
        dpi: 240,
        colorDepth: 16
      }
    })
  });
  if (!response.ok) {
    throw await apiError(response, "PROJECT_CREATE_FAILED", `project create failed with status ${response.status}`);
  }
  const payload = (await response.json()) as { project: ProjectResponse };
  return payload.project;
}

export async function getProject(projectId: string): Promise<ProjectResponse> {
  const response = await fetch(`/api/projects/${projectId}`, {
    headers: authHeaders()
  });
  if (!response.ok) {
    throw await apiError(response, "PROJECT_LOOKUP_FAILED", `project lookup failed with status ${response.status}`);
  }
  const payload = (await response.json()) as { project: ProjectResponse };
  return payload.project;
}

export async function createProjectVersion(projectId: string, name: string): Promise<ProjectVersionResponse> {
  const response = await fetch(`/api/projects/${projectId}/versions`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ name })
  });
  if (!response.ok) {
    throw await apiError(response, "PROJECT_VERSION_CREATE_FAILED", `project version create failed with status ${response.status}`);
  }
  const payload = (await response.json()) as { version: ProjectVersionResponse };
  return payload.version;
}

export async function exportProjectC(projectId: string): Promise<ExportJobResponse> {
  const response = await fetch(`/api/projects/${projectId}/export/c`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ createVersion: true })
  });
  if (!response.ok) {
    throw await apiError(response, "EXPORT_FAILED", `export failed with status ${response.status}`);
  }
  return response.json() as Promise<ExportJobResponse>;
}

export async function saveProjectDoc(projectId: string, doc: unknown): Promise<{ projectId: string; updatedAt: string }> {
  const response = await fetch(`/api/projects/${projectId}/doc`, {
    method: "PUT",
    headers: authHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ doc })
  });
  if (!response.ok) {
    throw await apiError(response, "SAVE_FAILED", `save failed with status ${response.status}`);
  }
  return response.json() as Promise<{ projectId: string; updatedAt: string }>;
}

export { downloadJobResult, getJob, type JobLogEntry, type JobResponse } from "./jobs";
export { ApiError };
