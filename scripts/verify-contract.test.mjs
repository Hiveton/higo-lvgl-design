import { readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const scripts = pkg.scripts ?? {};

assert.equal(typeof scripts.verify, "string", "package.json must define scripts.verify");
assert.equal(typeof scripts["verify:native"], "string", "package.json must define scripts.verify:native");
assert.ok(
  !scripts.verify.includes("wasm:check") && !scripts.verify.includes("wasm:smoke") && !scripts.verify.includes("wasm:build"),
  "npm run verify should not require the optional native WASM toolchain"
);
assert.match(
  scripts["verify:native"],
  /wasm:check.*wasm:build.*wasm:smoke/,
  "npm run verify:native must check, build, then smoke-test the real WASM runtime"
);

const docs = await readdir(new URL("../docs", import.meta.url));
const numberedDocs = docs.filter((file) => /^\d{2}-.+\.md$/.test(file)).sort();
assert.deepEqual(
  numberedDocs.map((file) => file.slice(0, 2)),
  ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"],
  "docs must include the complete 01-12 documentation set"
);

const projectDocDocs = await readFile(new URL("../docs/04-project-doc-schema.md", import.meta.url), "utf8");
assert.match(projectDocDocs, /`updatedAt` 使用 ISO 8601 UTC 字符串。/, "ProjectDoc docs must define updatedAt as ISO 8601 UTC");
assert.match(projectDocDocs, /`createdAt` 使用 ISO 8601 UTC 字符串。/, "ProjectDoc docs must define AssetRef createdAt as ISO 8601 UTC");

function assertNoDuplicateJsonKeys(jsonText, sourceName) {
  const stack = [];
  for (let index = 0; index < jsonText.length; index += 1) {
    const char = jsonText[index];
    if (char === '"') {
      index += 1;
      while (index < jsonText.length) {
        if (jsonText[index] === "\\") {
          index += 2;
          continue;
        }
        if (jsonText[index] === '"') {
          break;
        }
        index += 1;
      }
      continue;
    }
    if (char === "{") {
      stack.push(new Set());
      continue;
    }
    if (char === "}") {
      stack.pop();
      continue;
    }
    if (char !== "," && char !== "{" && char !== "[" && char !== "\n" && char !== "\r" && char !== "\t" && char !== " ") {
      continue;
    }
    let keyStart = index + 1;
    while (/\s/.test(jsonText[keyStart] ?? "")) {
      keyStart += 1;
    }
    if (jsonText[keyStart] !== '"' || !stack.length) {
      continue;
    }
    let keyEnd = keyStart + 1;
    while (keyEnd < jsonText.length) {
      if (jsonText[keyEnd] === "\\") {
        keyEnd += 2;
        continue;
      }
      if (jsonText[keyEnd] === '"') {
        break;
      }
      keyEnd += 1;
    }
    let colon = keyEnd + 1;
    while (/\s/.test(jsonText[colon] ?? "")) {
      colon += 1;
    }
    if (jsonText[colon] !== ":") {
      continue;
    }
    const key = JSON.parse(jsonText.slice(keyStart, keyEnd + 1));
    const keys = stack[stack.length - 1];
    assert.ok(!keys.has(key), `${sourceName} JSON example must not repeat key "${key}"`);
    keys.add(key);
    index = colon;
  }
}

for (const doc of numberedDocs) {
  const source = await readFile(new URL(`../docs/${doc}`, import.meta.url), "utf8");
  for (const [index, match] of [...source.matchAll(/```json\n([\s\S]*?)\n```/g)].entries()) {
    const sourceName = `${doc} block ${index + 1}`;
    assertNoDuplicateJsonKeys(match[1], sourceName);
    assert.doesNotThrow(() => JSON.parse(match[1]), `${sourceName} must be valid JSON`);
  }
}

function jsonBlockAfterHeading(markdown, heading) {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, `docs must include ${heading}`);
  const block = markdown.slice(start).match(/```json\n([\s\S]*?)\n```/)?.[1];
  assert.ok(block, `${heading} must include a JSON example`);
  return JSON.parse(block);
}

function jsonBlockAfterHeadingText(markdown, heading, text) {
  const headingStart = markdown.indexOf(heading);
  assert.notEqual(headingStart, -1, `docs must include ${heading}`);
  const textStart = markdown.indexOf(text, headingStart);
  assert.notEqual(textStart, -1, `${heading} must include ${text}`);
  const block = markdown.slice(textStart).match(/```json\n([\s\S]*?)\n```/)?.[1];
  assert.ok(block, `${heading} ${text} must include a JSON example`);
  return JSON.parse(block);
}

const apiDesignDocSource = await readFile(new URL("../docs/08-api-design.md", import.meta.url), "utf8");
const openapi = JSON.parse(await readFile(new URL("../packages/schema/openapi.json", import.meta.url), "utf8"));
const listProjectsExample = jsonBlockAfterHeading(apiDesignDocSource, "### GET /api/projects");
assert.deepEqual(
  Object.keys(listProjectsExample.projects[0]).sort(),
  ["createdAt", "doc", "id", "name", "updatedAt"],
  "GET /api/projects docs example must match the ProjectSummary response schema"
);
const getJobExample = jsonBlockAfterHeading(apiDesignDocSource, "### GET /api/jobs/:jobId");
assert.deepEqual(
  Object.keys(getJobExample.job.result).sort(),
  ["downloadUrl"],
  "GET /api/jobs/:jobId docs example result must match the Job result response schema"
);
assert.deepEqual(
  Object.keys(openapi.components.schemas.Job.properties.result.properties).sort(),
  ["downloadUrl"],
  "OpenAPI Job result must only expose the public download URL"
);
for (const [schemaName, field] of [
  ["Project", "createdAt"],
  ["Project", "updatedAt"],
  ["ProjectSummary", "createdAt"],
  ["ProjectSummary", "updatedAt"],
  ["ProjectVersion", "createdAt"],
  ["JobLogEntry", "time"]
]) {
  assert.equal(
    openapi.components.schemas[schemaName].properties[field].format,
    "date-time",
    `${schemaName}.${field} must be documented as date-time`
  );
}
assert.equal(
  openapi.paths["/projects/{projectId}/doc"].put.responses["200"].content["application/json"].schema.properties.updatedAt.format,
  "date-time",
  "save ProjectDoc updatedAt response must be documented as date-time"
);
assert.match(
  getJobExample.job.result.downloadUrl,
  /^\/api\/jobs\/[^/]+\/download$/,
  "GET /api/jobs/:jobId docs example must use the API download route"
);
const createVersionExample = jsonBlockAfterHeadingText(
  apiDesignDocSource,
  "### POST /api/projects/:projectId/versions",
  "响应："
);
assert.deepEqual(
  Object.keys(createVersionExample.version).sort(),
  ["createdAt", "doc", "id", "label", "name", "projectId"],
  "POST /api/projects/:projectId/versions docs example must match the ProjectVersion response schema"
);
assert.equal(
  createVersionExample.version.label,
  createVersionExample.version.name,
  "POST /api/projects/:projectId/versions docs example must show label as the backward-compatible name alias"
);
assert.ok(
  !apiDesignDocSource.includes("单文件建议限制"),
  "API docs must describe the asset size limit as enforced, not advisory"
);
assert.match(
  apiDesignDocSource,
  /单文件大小上限为 `5MB`，超过时返回 `ASSET_TOO_LARGE`。/,
  "API docs must document the enforced asset size limit and error code"
);

const sourceFilesWithApiErrorCodes = [
  "../apps/api/internal/server/server.go",
  "../apps/api/internal/server/repository_server.go",
  "../apps/api/internal/server/export_processor.go",
  "../apps/web/src/api/assets.ts",
  "../apps/web/src/api/auth.ts",
  "../apps/web/src/api/jobs.ts",
  "../apps/web/src/api/projects.ts"
];
const ignoredUppercaseConstants = new Set([
  "DELETE",
  "GET",
  "LV_EVENT_CANCEL",
  "LV_EVENT_CLICKED",
  "LV_EVENT_READY",
  "LV_EVENT_VALUE_CHANGED",
  "POST",
  "PUT"
]);
const apiErrorCodes = new Set();
for (const sourceFile of sourceFilesWithApiErrorCodes) {
  const source = await readFile(new URL(sourceFile, import.meta.url), "utf8");
  for (const match of source.matchAll(/"([A-Z][A-Z0-9_]{2,})"/g)) {
    if (!ignoredUppercaseConstants.has(match[1])) {
      apiErrorCodes.add(match[1]);
    }
  }
}
assert.ok(apiErrorCodes.has("PROJECT_NOT_FOUND"), "API error code scan must detect server error codes");
const localizedErrorsSource = await readFile(new URL("../apps/web/src/i18n/errors.ts", import.meta.url), "utf8");
const localizedErrorCodes = new Set([...localizedErrorsSource.matchAll(/\b([A-Z][A-Z0-9_]{2,})\s*:/g)].map((match) => match[1]));
assert.ok(localizedErrorCodes.has("PROJECT_NOT_FOUND"), "localized error scan must detect frontend error codes");
const missingLocalizedCodes = [...apiErrorCodes].filter((code) => !localizedErrorCodes.has(code)).sort();
assert.deepEqual(missingLocalizedCodes, [], `API error codes must be localized: ${missingLocalizedCodes.join(", ")}`);

const backendErrorCodeFiles = [
  "../apps/api/internal/server/server.go",
  "../apps/api/internal/server/repository_server.go",
  "../apps/api/internal/server/export_processor.go"
];
const backendErrorCodes = new Set();
for (const sourceFile of backendErrorCodeFiles) {
  const source = await readFile(new URL(sourceFile, import.meta.url), "utf8");
  for (const match of source.matchAll(/"([A-Z][A-Z0-9_]{2,})"/g)) {
    if (!ignoredUppercaseConstants.has(match[1])) {
      backendErrorCodes.add(match[1]);
    }
  }
}
assert.ok(backendErrorCodes.has("ASSET_LOAD_FAILED"), "backend error code scan must detect job failure codes");
const openapiErrorCodes = new Set(openapi.components.schemas.ErrorBody.properties.code.enum ?? []);
const missingOpenapiCodes = [...backendErrorCodes].filter((code) => !openapiErrorCodes.has(code)).sort();
assert.deepEqual(missingOpenapiCodes, [], `backend error codes must be documented in OpenAPI: ${missingOpenapiCodes.join(", ")}`);

function routesFromChiSource(source) {
  return [...source.matchAll(/\b(?:router|protected)\.(Get|Post|Put|Delete)\("([^"]+)"/g)]
    .map((match) => `${match[1].toLowerCase()} ${match[2]}`)
    .sort();
}

const inMemoryServerSource = await readFile(new URL("../apps/api/internal/server/server.go", import.meta.url), "utf8");
const repositoryServerRouteSource = await readFile(new URL("../apps/api/internal/server/repository_server.go", import.meta.url), "utf8");
const inMemoryServerRoutes = routesFromChiSource(inMemoryServerSource);
const repositoryServerRoutes = routesFromChiSource(repositoryServerRouteSource);
assert.deepEqual(repositoryServerRoutes, inMemoryServerRoutes, "repository and in-memory API servers must register the same routes");

const openapiRoutes = Object.entries(openapi.paths)
  .flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method} ${path}`))
  .sort();
assert.deepEqual(openapiRoutes, inMemoryServerRoutes, "OpenAPI paths must match the Go API routes registered under /api");

function normalizeApiClientPath(path) {
  return path
    .replace(/^\/api/, "")
    .replaceAll(/\$\{([^}]+)\}/g, (_match, param) => `{${param}}`);
}

const apiClientFiles = [
  "../apps/web/src/api/assets.ts",
  "../apps/web/src/api/auth.ts",
  "../apps/web/src/api/jobs.ts",
  "../apps/web/src/api/projects.ts"
];
const apiClientRoutes = [];
for (const sourceFile of apiClientFiles) {
  const source = await readFile(new URL(sourceFile, import.meta.url), "utf8");
  for (const match of source.matchAll(/fetch\(([`"])(\/api[^`"]+)\1,\s*\{([\s\S]*?)\n\s*\}\);/g)) {
    const method = match[3].match(/method:\s*"([A-Z]+)"/)?.[1].toLowerCase() ?? "get";
    apiClientRoutes.push(`${method} ${normalizeApiClientPath(match[2])}`);
  }
}
const unknownApiClientRoutes = [...new Set(apiClientRoutes.filter((route) => !openapiRoutes.includes(route)))].sort();
assert.deepEqual(unknownApiClientRoutes, [], `frontend API client routes must exist in OpenAPI: ${unknownApiClientRoutes.join(", ")}`);

const projectDocSchema = JSON.parse(await readFile(new URL("../packages/schema/project-doc.schema.json", import.meta.url), "utf8"));
assert.equal(projectDocSchema.properties.updatedAt.format, "date-time", "ProjectDoc updatedAt JSON Schema must be date-time");
assert.equal(projectDocSchema.$defs.AssetRef.properties.createdAt.format, "date-time", "AssetRef createdAt JSON Schema must be date-time");
const projectDocAssetKinds = projectDocSchema.$defs.AssetRef.properties.kind.enum;
const openapiUploadKinds = openapi.paths["/projects/{projectId}/assets"].post.requestBody.content["multipart/form-data"].schema.properties.kind.enum;
assert.deepEqual(
  [...openapiUploadKinds].sort(),
  [...projectDocAssetKinds].sort(),
  "OpenAPI asset upload kinds must match ProjectDoc asset kinds"
);

const schemaSource = await readFile(new URL("../packages/schema/src/index.ts", import.meta.url), "utf8");
const widgetTypeBlock = schemaSource.match(/export type WidgetType =([\s\S]*?);/)?.[1] ?? "";
const schemaWidgetTypes = [...widgetTypeBlock.matchAll(/\| "([^"]+)"/g)].map((match) => match[1]).filter((type) => type !== "screen").sort();
const widgetCatalogBlock = schemaSource.match(/export const widgetCatalog: WidgetCatalogItem\[] = \[([\s\S]*?)\];/)?.[1] ?? "";
const catalogWidgetTypes = [...widgetCatalogBlock.matchAll(/\{ type: "([^"]+)"/g)].map((match) => match[1]).sort();
assert.deepEqual(catalogWidgetTypes, schemaWidgetTypes, "Widget catalog must expose every non-screen schema widget type");
const catalogWidgetCategories = [...new Set([...widgetCatalogBlock.matchAll(/category: "([^"]+)"/g)].map((match) => match[1]))].sort();

const codegenSource = await readFile(new URL("../apps/api/internal/codegen/codegen.go", import.meta.url), "utf8");
const lvglCreateCallBlock = codegenSource.match(/func lvglCreateCall\([\s\S]*?\n}\n/)?.[0] ?? "";
const codegenWidgetTypes = [...lvglCreateCallBlock.matchAll(/case "([^"]+)":/g)].map((match) => match[1]).sort();
assert.deepEqual(codegenWidgetTypes, schemaWidgetTypes, "Go codegen must create every non-screen schema widget type");

const codegenDocSource = await readFile(new URL("../docs/09-lvgl-codegen.md", import.meta.url), "utf8");
const codegenDocWidgetTypes = [...codegenDocSource.matchAll(/^([a-z]+)\s*-> lv_/gm)]
  .map((match) => match[1])
  .filter((type) => type !== "screen")
  .sort();
assert.deepEqual(codegenDocWidgetTypes, schemaWidgetTypes, "Codegen docs must document every non-screen schema widget type");

function objectKeysFromConst(source, constName) {
  const block = source.match(new RegExp(`const ${constName}[\\s\\S]*?= \\{([\\s\\S]*?)\\n  \\};`))?.[1] ?? "";
  return [...block.matchAll(/^\s*([a-z]+):/gm)].map((match) => match[1]).sort();
}

const widgetPaletteSource = await readFile(new URL("../apps/web/src/editor/WidgetPalette.vue", import.meta.url), "utf8");
const widgetPaletteIconTypes = objectKeysFromConst(widgetPaletteSource, "icons");
assert.deepEqual(widgetPaletteIconTypes, schemaWidgetTypes, "Widget palette icons must cover every non-screen schema widget type");
const widgetPaletteCategoryBlock = widgetPaletteSource.match(/\[([^\]]+)\]\.map\(\(category\)/)?.[1] ?? "";
const widgetPaletteCategories = [...widgetPaletteCategoryBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort();
assert.deepEqual(widgetPaletteCategories, catalogWidgetCategories, "Widget palette categories must cover every widget catalog category");

const layersPanelSource = await readFile(new URL("../apps/web/src/editor/LayersPanel.vue", import.meta.url), "utf8");
const layerIconTypes = objectKeysFromConst(layersPanelSource, "icons");
assert.deepEqual(layerIconTypes, ["screen", ...schemaWidgetTypes].sort(), "Layer icons must cover every schema widget type, including screen");

function widgetTypesReferencedByTemplate(source) {
  return [...new Set([...source.matchAll(/item\.widget\.type === '([^']+)'/g)].map((match) => match[1]))].sort();
}

const widgetRendererTypes = widgetTypesReferencedByTemplate(await readFile(new URL("../apps/web/src/editor/WidgetRenderer.vue", import.meta.url), "utf8"));
assert.deepEqual(widgetRendererTypes, schemaWidgetTypes, "Canvas widget renderer must cover every non-screen schema widget type");

const previewOverlayTypes = widgetTypesReferencedByTemplate(await readFile(new URL("../apps/web/src/editor/PreviewOverlay.vue", import.meta.url), "utf8"));
assert.deepEqual(previewOverlayTypes, schemaWidgetTypes, "Preview overlay renderer must cover every non-screen schema widget type");

const fallbackRuntimeSource = await readFile(new URL("../packages/lvgl-wasm-runtime/src/index.ts", import.meta.url), "utf8");
const supportedWidgetTypeBlock = fallbackRuntimeSource.match(/const supportedWidgetTypes = new Set<WidgetNode\["type"\]>\(\[([\s\S]*?)\]\);/)?.[1] ?? "";
const fallbackRuntimeWidgetTypes = [...supportedWidgetTypeBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort();
assert.deepEqual(fallbackRuntimeWidgetTypes, ["screen", ...schemaWidgetTypes].sort(), "Fallback LVGL runtime must support every schema widget type");

const repositoryServerSource = await readFile(new URL("../apps/api/internal/server/repository_server.go", import.meta.url), "utf8");
const backendAssetMimeTypes = new Set(["image/png", "image/jpeg"]);
for (const match of repositoryServerSource.matchAll(/return "(font\/[^"]+)", true/g)) {
  backendAssetMimeTypes.add(match[1]);
}
const openapiAssetContentMimeTypes = new Set(
  Object.keys(openapi.paths["/projects/{projectId}/assets/{assetId}/content"].get.responses["200"].content)
);
assert.deepEqual(
  [...openapiAssetContentMimeTypes].sort(),
  [...backendAssetMimeTypes].sort(),
  "OpenAPI asset content MIME types must match backend-supported persisted asset MIME types"
);

const backendArchitectureSource = await readFile(new URL("../docs/07-backend-architecture.md", import.meta.url), "utf8");
const documentedInlineErrorCodes = new Set(
  [...backendArchitectureSource.matchAll(/`([A-Z][A-Z0-9_]{2,})`/g)].map((match) => match[1])
);
const staleBackendArchitectureCodes = [...documentedInlineErrorCodes].filter((code) => !openapiErrorCodes.has(code)).sort();
assert.deepEqual(
  staleBackendArchitectureCodes,
  [],
  `backend architecture doc must not mention undocumented error codes: ${staleBackendArchitectureCodes.join(", ")}`
);

console.log("verify script contract ok");
