import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("OpenAPI artifact", () => {
  const openapi = JSON.parse(readFileSync(fileURLToPath(new URL("../openapi.json", import.meta.url)), "utf8"));

  it("documents every first-release HTTP route implemented by the Go API", () => {
    expect(Object.keys(openapi.paths).sort()).toEqual([
      "/auth/login",
      "/auth/me",
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

  it("marks protected API operations with bearer auth by default and leaves login public", () => {
    expect(openapi.security).toEqual([{ bearerAuth: [] }]);
    expect(openapi.paths["/auth/login"].post.security).toEqual([]);
    expect(openapi.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer"
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
