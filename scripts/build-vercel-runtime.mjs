import { randomUUID } from "node:crypto";
import { build } from "esbuild";

export function buildVercelRuntime(
  outfile = "dist/server/vercel-runtime.mjs",
  cacheBuildId = randomUUID(),
) {
  // Vercel rejects sanitize-html's CommonJS require of an external ESM parser.
  // Keep the sanitizer and parser bundled together at their installed versions.
  return build({
    entryPoints: ["scripts/vercel-handler.mjs"],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node24",
    define: { __CMS_CACHE_BUILD_ID__: JSON.stringify(cacheBuildId) },
    external: [
      "mongodb",
      "@aws-sdk/*",
      "bcryptjs",
      "dotenv",
      "nodemailer",
      "sharp",
    ],
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
    },
  });
}
