import { build } from "esbuild";

export function buildVercelRuntime(outfile = "dist/server/vercel-runtime.mjs") {
  // Vercel rejects sanitize-html's CommonJS require of an external ESM parser.
  // Keep the sanitizer and parser bundled together at their installed versions.
  return build({
    entryPoints: ["scripts/vercel-handler.mjs"],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node24",
    external: ["mongodb", "@aws-sdk/*", "bcryptjs", "dotenv"],
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
    },
  });
}
