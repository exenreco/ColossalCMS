import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
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
});
console.log("Both Angular applications and Worker API built successfully.");
