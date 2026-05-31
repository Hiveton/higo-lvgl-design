import { validateProjectDoc, type ProjectDoc } from "@hiveton-lvgl/schema";
import { authHeaders } from "./auth";
import { apiError, apiErrorFromPayload, ApiError, parseJsonPayload, type ErrorPayload } from "./errors";
import { isRecord, isNonEmptyString } from "./utils";

export type ProjectSummary = {
  id: string;
  name: string;
  doc: ProjectDoc;
  createdAt: string;
  updatedAt: string;
};

export type ProjectResponse = {
  id: string;
  name: string;
  doc: ProjectDoc;
  createdAt: string;
  updatedAt: string;
};

export type ExportJobResponse = {
  jobId: string;
};

export type ExportProjectOptions = {
  createVersion?: boolean;
};

export type ProjectVersionResponse = {
  id: string;
  projectId: string;
  name: string;
  label: string;
  doc: ProjectDoc;
  createdAt: string;
};

export async function listProjects(): Promise<ProjectSummary[]> {
  const response = await fetch("/api/projects", {
    headers: authHeaders()
  });
  const payload = await parseJsonPayload<{ projects?: ProjectSummary[] } & ErrorPayload>(response);
  if (!response.ok || !Array.isArray(payload?.projects) || !payload.projects.every(isProjectSummary)) {
    throw apiErrorFromPayload(response, payload, "PROJECT_LIST_FAILED", `project list failed with status ${response.status}`);
  }
  return payload.projects;
}

export async function createProject(name: string, target?: unknown): Promise<ProjectResponse> {
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
  const payload = await parseJsonPayload<{ project?: ProjectResponse } & ErrorPayload>(response);
  if (!response.ok || !isProjectResponse(payload?.project)) {
    throw apiErrorFromPayload(response, payload, "PROJECT_CREATE_FAILED", `project create failed with status ${response.status}`);
  }
  return payload.project;
}

export async function getProject(projectId: string): Promise<ProjectResponse> {
  const response = await fetch(`/api/projects/${projectId}`, {
    headers: authHeaders()
  });
  const payload = await parseJsonPayload<{ project?: ProjectResponse } & ErrorPayload>(response);
  if (!response.ok || !isProjectResponseFor(payload?.project, projectId)) {
    throw apiErrorFromPayload(response, payload, "PROJECT_LOOKUP_FAILED", `project lookup failed with status ${response.status}`);
  }
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
  const payload = await parseJsonPayload<{ version?: ProjectVersionResponse } & ErrorPayload>(response);
  if (!response.ok || !isProjectVersionResponseFor(payload?.version, projectId)) {
    throw apiErrorFromPayload(response, payload, "PROJECT_VERSION_CREATE_FAILED", `project version create failed with status ${response.status}`);
  }
  return payload.version;
}

export async function exportProjectC(projectId: string, options: ExportProjectOptions = {}): Promise<ExportJobResponse> {
  const response = await fetch(`/api/projects/${projectId}/export/c`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ createVersion: options.createVersion ?? true })
  });
  const payload = await parseJsonPayload<Partial<ExportJobResponse> & ErrorPayload>(response);
  const jobId = typeof payload?.jobId === "string" ? payload.jobId.trim() : "";
  if (!response.ok || jobId === "") {
    throw apiErrorFromPayload(response, payload, "EXPORT_FAILED", `export failed with status ${response.status}`);
  }
  return { jobId };
}

export async function saveProjectDoc(projectId: string, doc: unknown): Promise<{ projectId: string; updatedAt: string }> {
  const response = await fetch(`/api/projects/${projectId}/doc`, {
    method: "PUT",
    headers: authHeaders({
      "Content-Type": "application/json"
    }),
    body: JSON.stringify({ doc })
  });
  const payload = await parseJsonPayload<Partial<{ projectId: string; updatedAt: string }> & ErrorPayload>(response);
  if (!response.ok || payload?.projectId !== projectId || !isDateTime(payload.updatedAt)) {
    throw apiErrorFromPayload(response, payload, "SAVE_FAILED", `save failed with status ${response.status}`);
  }
  return { projectId: payload.projectId, updatedAt: payload.updatedAt };
}

function isProjectSummary(value: unknown): value is ProjectSummary {
  if (!isRecord(value)) {
    return false;
  }
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.name)
    && isProjectDocFor(value.doc, value.id)
    && isDateTime(value.createdAt)
    && isDateTime(value.updatedAt);
}

function isProjectResponse(value: unknown): value is ProjectResponse {
  return isProjectSummary(value);
}

function isProjectResponseFor(value: unknown, projectId: string): value is ProjectResponse {
  return isProjectResponse(value) && value.id === projectId;
}

function isProjectVersionResponse(value: unknown): value is ProjectVersionResponse {
  if (!isRecord(value)) {
    return false;
  }
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.projectId)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.label)
    && isProjectDocFor(value.doc, value.projectId)
    && isDateTime(value.createdAt);
}

function isProjectVersionResponseFor(value: unknown, projectId: string): value is ProjectVersionResponse {
  return isProjectVersionResponse(value) && value.projectId === projectId;
}

function isProjectDoc(value: unknown): value is ProjectDoc {
  return validateProjectDoc(value).valid;
}

function isProjectDocFor(value: unknown, projectId: string): value is ProjectDoc {
  return isProjectDoc(value) && value.id === projectId;
}

function isDateTime(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}

export { downloadJobResult, getJob, type JobLogEntry, type JobResponse } from "./jobs";
export { ApiError };
