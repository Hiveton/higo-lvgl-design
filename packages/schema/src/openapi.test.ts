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

  it("marks protected API operations with bearer auth by default and leaves public endpoints open", () => {
    expect(openapi.security).toEqual([{ bearerAuth: [] }]);
    expect(openapi.paths["/auth/login"].post.security).toEqual([]);
    expect(openapi.paths["/health"].get.security).toEqual([]);
    expect(openapi.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer"
    });
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
    expect(openapi.components.schemas.Job.properties.status.enum).toEqual(["queued", "running", "succeeded", "failed"]);
    expect(openapi.components.schemas.ErrorResponse).toMatchObject({
      type: "object",
      required: ["error"]
    });
    expect(openapi.components.schemas.ErrorBody.required).toEqual(["code", "message"]);
  });
});
