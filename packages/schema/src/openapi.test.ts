import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("OpenAPI artifact", () => {
  const openapi = JSON.parse(readFileSync(fileURLToPath(new URL("../openapi.json", import.meta.url)), "utf8"));

  it("documents every first-release HTTP route implemented by the Go API", () => {
    expect(Object.keys(openapi.paths).sort()).toEqual([
      "/auth/login",
      "/auth/me",
      "/health",
      "/jobs/{jobId}",
      "/jobs/{jobId}/download",
      "/projects",
      "/projects/{projectId}",
      "/projects/{projectId}/assets",
      "/projects/{projectId}/assets/{assetId}",
      "/projects/{projectId}/assets/{assetId}/content",
      "/projects/{projectId}/doc",
      "/projects/{projectId}/export/c",
      "/projects/{projectId}/versions"
    ]);
  });

  it("keeps ProjectDoc and asset schemas linked to the generated JSON Schema artifact", () => {
    expect(openapi.components.schemas.ProjectDoc).toEqual({
      $ref: "./project-doc.schema.json"
    });
    expect(openapi.components.schemas.Asset).toEqual({
      $ref: "./project-doc.schema.json#/$defs/AssetRef"
    });
    expect(openapi.components.schemas.TargetConfig).toEqual({
      $ref: "./project-doc.schema.json#/$defs/TargetConfig"
    });
  });

  it("documents project list items as the persisted project records returned by the Go API", () => {
    expect(openapi.paths["/projects"].get.responses["200"].content["application/json"].schema.properties.projects.items).toEqual({
      $ref: "#/components/schemas/ProjectSummary"
    });
    expect(openapi.components.schemas.ProjectSummary).toMatchObject({
      type: "object",
      required: ["id", "name", "doc", "createdAt", "updatedAt"],
      properties: {
        doc: {
          $ref: "#/components/schemas/ProjectDoc"
        },
        createdAt: {
          type: "string"
        },
        updatedAt: {
          type: "string"
        }
      }
    });
    expect(openapi.components.schemas.ProjectSummary.properties.target).toBeUndefined();
  });

  it("documents project detail responses with persisted timestamps returned by the Go API", () => {
    expect(openapi.components.schemas.Project).toMatchObject({
      type: "object",
      required: ["id", "name", "doc", "createdAt", "updatedAt"],
      properties: {
        createdAt: {
          type: "string",
          format: "date-time"
        },
        updatedAt: {
          type: "string",
          format: "date-time"
        }
      }
    });
  });

  it("documents public timestamp fields as RFC3339 date-time strings", () => {
    expect(openapi.components.schemas.ProjectSummary.properties.createdAt).toEqual({
      type: "string",
      format: "date-time"
    });
    expect(openapi.components.schemas.ProjectSummary.properties.updatedAt).toEqual({
      type: "string",
      format: "date-time"
    });
    expect(openapi.components.schemas.ProjectVersion.properties.createdAt).toEqual({
      type: "string",
      format: "date-time"
    });
    expect(openapi.components.schemas.JobLogEntry.properties.time).toEqual({
      type: "string",
      format: "date-time"
    });
    expect(openapi.paths["/projects/{projectId}/doc"].put.responses["200"].content["application/json"].schema.properties.updatedAt).toEqual({
      type: "string",
      format: "date-time"
    });
  });

  it("documents project version snapshots with the persisted ProjectDoc returned by the Go API", () => {
    expect(openapi.components.schemas.ProjectVersion).toMatchObject({
      type: "object",
      required: ["id", "projectId", "name", "label", "doc", "createdAt"],
      properties: {
        label: {
          type: "string"
        },
        doc: {
          $ref: "#/components/schemas/ProjectDoc"
        }
      }
    });
  });

  it("marks protected API operations with bearer auth by default and leaves public endpoints open", () => {
    expect(openapi.security).toEqual([{ bearerAuth: [] }]);
    expect(openapi.paths["/auth/login"].post.security).toEqual([]);
    expect(openapi.paths["/health"].get.security).toEqual([]);
    expect(openapi.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer"
    });
  });

  it("documents unauthenticated errors for every protected operation", () => {
    for (const [path, methods] of Object.entries(openapi.paths)) {
      for (const [method, operation] of Object.entries(methods as Record<string, { security?: unknown[]; responses: Record<string, unknown> }>)) {
        if (operation.security && operation.security.length === 0) {
          continue;
        }
        expect(operation.responses["401"], `${method.toUpperCase()} ${path}`).toEqual({
          $ref: "#/components/responses/Error"
        });
      }
    }
  });

  it("documents project lookup failures for project-scoped operations", () => {
    for (const [path, methods] of Object.entries(openapi.paths)) {
      if (!path.includes("{projectId}")) {
        continue;
      }
      for (const [method, operation] of Object.entries(methods as Record<string, { responses: Record<string, unknown> }>)) {
        expect(operation.responses["404"], `${method.toUpperCase()} ${path}`).toEqual({
          $ref: "#/components/responses/Error"
        });
      }
    }
  });

  it("documents bad request errors for operations that parse request bodies", () => {
    for (const [path, methods] of Object.entries(openapi.paths)) {
      for (const [method, operation] of Object.entries(methods as Record<string, { requestBody?: unknown; responses: Record<string, unknown> }>)) {
        if (!operation.requestBody) {
          continue;
        }
        expect(operation.responses["400"], `${method.toUpperCase()} ${path}`).toEqual({
          $ref: "#/components/responses/Error"
        });
      }
    }
  });

  it("documents JSON request bodies as strict single-shape objects", () => {
    expect(openapi.components.schemas.LoginRequest.additionalProperties).toBe(false);
    expect(openapi.components.schemas.CreateProjectRequest.additionalProperties).toBe(false);
    expect(openapi.paths["/projects/{projectId}/doc"].put.requestBody.content["application/json"].schema.additionalProperties).toBe(false);
    expect(openapi.paths["/projects/{projectId}/versions"].post.requestBody.content["application/json"].schema.additionalProperties).toBe(false);
    expect(openapi.paths["/projects/{projectId}/export/c"].post.requestBody.content["application/json"].schema.additionalProperties).toBe(false);
    expect(openapi.paths["/projects/{projectId}/assets"].post.requestBody.content["multipart/form-data"].schema.additionalProperties).toBe(false);
  });

  it("documents internal server errors for operations that can surface backend persistence or storage failures", () => {
    const operationsWithInternalErrors = [
      ["post", "/auth/login"],
      ["get", "/jobs/{jobId}"],
      ["get", "/jobs/{jobId}/download"],
      ["get", "/projects"],
      ["post", "/projects"],
      ["get", "/projects/{projectId}"],
      ["put", "/projects/{projectId}/doc"],
      ["post", "/projects/{projectId}/versions"],
      ["get", "/projects/{projectId}/assets"],
      ["post", "/projects/{projectId}/assets"],
      ["get", "/projects/{projectId}/assets/{assetId}/content"],
      ["delete", "/projects/{projectId}/assets/{assetId}"],
      ["post", "/projects/{projectId}/export/c"]
    ] as const;

    for (const [method, path] of operationsWithInternalErrors) {
      expect(openapi.paths[path][method].responses["500"], `${method.toUpperCase()} ${path}`).toEqual({
        $ref: "#/components/responses/Error"
      });
    }
    expect(openapi.paths["/auth/me"].get.responses["500"]).toBeUndefined();
    expect(openapi.paths["/health"].get.responses["500"]).toBeUndefined();
  });

  it("does not document lookup or validation errors for operations that cannot return them", () => {
    expect(openapi.paths["/auth/me"].get.responses["404"]).toBeUndefined();
    expect(openapi.paths["/projects"].get.responses["400"]).toBeUndefined();
    expect(openapi.paths["/projects"].get.responses["404"]).toBeUndefined();
    expect(openapi.paths["/projects"].post.responses["404"]).toBeUndefined();
  });

  it("documents the health response returned by the unauthenticated health route", () => {
    expect(openapi.paths["/health"].get.responses["200"].content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/HealthResponse"
    });
    expect(openapi.components.schemas.HealthResponse).toEqual({
      type: "object",
      required: ["ok", "service"],
      properties: {
        ok: {
          type: "boolean"
        },
        service: {
          type: "string"
        }
      }
    });
  });

  it("documents export job states and structured API errors", () => {
    expect(openapi.components.schemas.Job.required).toEqual(["id", "kind", "status", "progress", "logs"]);
    expect(openapi.components.schemas.Job.properties.projectId).toEqual({
      type: "string"
    });
    expect(openapi.components.schemas.Job.properties.kind).toEqual({
      type: "string",
      enum: ["export_c"]
    });
    expect(openapi.components.schemas.Job.properties.status.enum).toEqual(["queued", "running", "succeeded", "failed"]);
    expect(openapi.components.schemas.Job.properties.progress).toMatchObject({
      type: "integer",
      minimum: 0,
      maximum: 100
    });
    expect(openapi.components.schemas.Job.properties.result.required).toEqual(["downloadUrl"]);
    expect(openapi.components.schemas.ErrorResponse).toMatchObject({
      type: "object",
      required: ["error"]
    });
    expect(openapi.components.schemas.ErrorBody.required).toEqual(["code", "message"]);
    expect(openapi.components.schemas.ErrorBody.properties.code.enum).toEqual([
      "ASSET_CONTENT_NOT_FOUND",
      "ASSET_CREATE_FAILED",
      "ASSET_FILE_REQUIRED",
      "ASSET_IN_USE",
      "ASSET_LIST_FAILED",
      "ASSET_LOAD_FAILED",
      "ASSET_NOT_FOUND",
      "ASSET_READ_FAILED",
      "ASSET_STORE_FAILED",
      "ASSET_TOO_LARGE",
      "CODEGEN_FAILED",
      "INVALID_CREDENTIALS",
      "INVALID_JSON",
      "INVALID_LOGIN_REQUEST",
      "INVALID_MULTIPART",
      "INVALID_PROJECT_DOC",
      "INVALID_PROJECT_NAME",
      "JOB_CREATE_FAILED",
      "JOB_NOT_FOUND",
      "JOB_QUEUE_FAILED",
      "JOB_RESULT_NOT_FOUND",
      "OBJECT_STORE_FAILED",
      "PROJECT_CREATE_FAILED",
      "PROJECT_LIST_FAILED",
      "PROJECT_NOT_FOUND",
      "PROJECT_SAVE_FAILED",
      "PROJECT_VERSION_CREATE_FAILED",
      "TOKEN_ISSUE_FAILED",
      "UNAUTHENTICATED",
      "UNSUPPORTED_ASSET_TYPE"
    ]);
  });

  it("documents that C export creates a version snapshot by default", () => {
    const createVersion = openapi.paths["/projects/{projectId}/export/c"].post.requestBody.content["application/json"].schema.properties.createVersion;

    expect(createVersion).toMatchObject({
      type: "boolean",
      default: true
    });
  });

  it("documents raw asset content downloads for supported image and font assets", () => {
    expect(Object.keys(openapi.paths["/projects/{projectId}/assets/{assetId}/content"].get.responses["200"].content).sort()).toEqual([
      "font/otf",
      "font/ttf",
      "font/woff",
      "font/woff2",
      "image/jpeg",
      "image/png"
    ]);
  });

  it("documents project asset uploads for both image and font assets", () => {
    const uploadOperation = openapi.paths["/projects/{projectId}/assets"].post;
    const multipartSchema = uploadOperation.requestBody.content["multipart/form-data"].schema;

    expect(uploadOperation.summary).toBe("Upload an image or font asset");
    expect(multipartSchema.required).toEqual(["file", "kind"]);
    expect(multipartSchema.properties.kind.enum).toEqual(["image", "font"]);
  });
});
