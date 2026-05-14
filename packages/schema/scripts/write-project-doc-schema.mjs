import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { projectDocJsonSchema } from "../dist/index.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDir, "../project-doc.schema.json");

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(projectDocJsonSchema, null, 2)}\n`);
console.log(`wrote ${outputPath}`);
