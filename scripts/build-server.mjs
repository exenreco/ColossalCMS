import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { buildVercelRuntime } from "./build-vercel-runtime.mjs";
const cacheBuildId = randomUUID();
const clientRoot = resolve("dist/client");
if (dirname(clientRoot) !== resolve("dist"))
  throw new Error("Unexpected build output path.");
await rm(clientRoot, { recursive: true, force: true });
await mkdir("dist/client/admin", { recursive: true });
await cp("dist/frontend/browser", "dist/client", { recursive: true });
await cp("dist/admin/browser", "dist/client/admin", { recursive: true });
await build({
  entryPoints: ["server/worker.mjs"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  define: { __CMS_CACHE_BUILD_ID__: JSON.stringify(cacheBuildId) },
});
await buildVercelRuntime(undefined, cacheBuildId);
console.log("Both Angular applications and Worker API built successfully.");
