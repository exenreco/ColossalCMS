import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";
import cypress from "cypress";
const data = await mkdtemp(join(tmpdir(), "colossal-e2e-"));
const manifest = {
  id: "test.colossal.e2e",
  name: "E2E archive",
  version: "1.0.0",
  description: "Inactive test package",
  author: "Tests",
  license: "MIT",
  isCore: false,
  requires: { colossal: ">=0.0.1", plugins: [] },
  admin: {
    entryComponent: "TestComponent",
    menu: { path: "/admin/e2e", label: "E2E", order: 99 },
  },
  frontend: { routes: [] },
  runtime: { entry: "index.mjs" },
};
await writeFile(
  "tests/fixtures/plugin-sample.zip",
  zipSync({
    "plugin.manifest.json": strToU8(JSON.stringify(manifest)),
    "index.mjs": strToU8('export const name="Inactive test package";'),
  }),
);
const theme = {
  id: "test.colossal.browser",
  name: "Meadow",
  version: "1.0.0",
  author: "Colossal tests",
  description: "An open space for a new story.",
  license: "MIT",
  isCore: false,
  requires: { colossal: ">=0.0.1" },
  templates: [
    {
      id: "default",
      name: "Meadow default",
      file: "templates/default.html",
      isDefault: true,
      appliesTo: ["page", "post", "post-index", "search", "404"],
    },
  ],
  parts: {},
  blocks: [],
  assets: { styles: ["assets/theme.css"], scripts: [] },
  palette: ["#264c36", "#ffffff", "#f6f8f1"],
};
await writeFile(
  "tests/fixtures/theme-sample.zip",
  zipSync({
    "theme.manifest.json": strToU8(JSON.stringify(theme)),
    "templates/default.html": strToU8(
      "<main><h1>Meadow stories</h1><p>{{content.title}}</p></main>",
    ),
    "assets/theme.css": strToU8(
      "h1{color:#264c36;font-family:Georgia;font-size:48px}",
    ),
  }),
);
const server = spawn(process.execPath, ["scripts/dev-server.mjs"], {
  env: {
    ...process.env,
    CMS_DATA_DIR: data,
    CMS_PORT: "4201",
    CMS_DEV_AUTH_BYPASS: "true",
  },
  stdio: "inherit",
  windowsHide: true,
});
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (server.exitCode !== null) throw new Error("Test server exited");
    try {
      const r = await fetch("http://127.0.0.1:4201/api/admin/session");
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw new Error("Test server did not become ready");
  const result = await cypress.run({
    configFile: "cypress.config.mjs",
    browser: "electron",
    headless: true,
    ...(process.env.CMS_E2E_SPEC ? { spec: process.env.CMS_E2E_SPEC } : {}),
  });
  process.exitCode = result.failures || result.totalFailed || 0;
  if (result.failures)
    console.error(
      result.message || "Browser runner failed before completing tests.",
    );
} finally {
  server.kill();
  console.log("Isolated test data retained at " + data);
}
