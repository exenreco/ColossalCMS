import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { localDatabase } from "../scripts/local-database.mjs";
import worker from "../server/worker.mjs";
import { defaultTheme, validateDocument } from "../server/theme-engine.mjs";
import { migrateThemeDocument } from "../server/theme-migrations.mjs";

function legacyBrilliant() {
  const doc = defaultTheme();
  Object.assign(doc.manifest, {
    id: "com.colossal.theme.brilliant",
    name: "Brilliant",
    version: "2.0.14",
    homeTemplate: "home",
    requires: { colossal: ">=2.0.5" },
  });
  doc.templates.home.children.splice(1, 0, {
    id: "brilliant-orbital-model",
    type: "core/gltf",
    settings: {
      source: "url",
      url: "/brilliant/hero.glb",
      alt: "Abstract iridescent orbital sculpture",
      scrollInteractive: true,
      autoRotate: true,
      lazyLoad: false,
    },
  });
  return doc;
}

test("legacy Brilliant can render a thumbnail and signed preview with its bundled model", async () => {
  const DB = localDatabase();
  const owner = {
    "oai-authenticated-user-id": "compatibility-owner",
    "oai-authenticated-user-email": "compatibility@example.test",
  };
  const env = {
    DB,
    ASSETS: {
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (["/brilliant/hero.glb", "/brilliant/hero.svg"].includes(path))
          return new Response(await readFile("public" + path));
        return new Response(
          "<!doctype html><html><head></head><body><cl-frontend></cl-frontend></body></html>",
        );
      },
    },
  };
  const call = (path, method = "GET", body) =>
    worker.fetch(
      new Request("https://cms.test" + path, {
        method,
        headers: {
          ...owner,
          Origin: "https://cms.test",
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
  try {
    assert.equal((await call("/api/admin/setup", "POST", {})).status, 200);
    const doc = legacyBrilliant();
    await DB.prepare(
      "INSERT INTO themes (id,manifest,published,draft,active,is_core,revision,updated_at) VALUES (?,?,?,NULL,0,1,1,?)",
    )
      .bind(
        doc.manifest.id,
        JSON.stringify(doc.manifest),
        JSON.stringify(doc),
        "2026-10-07",
      )
      .run();
    const record = await call("/api/themes/" + doc.manifest.id);
    assert.equal(record.status, 200);
    const { published } = await record.json();
    const thumbnail = await call(
      "/api/themes/" + doc.manifest.id + "/render",
      "POST",
      {
        document: published,
        templateId: "home",
      },
    );
    assert.equal(thumbnail.status, 200, await thumbnail.clone().text());
    const rendered = await thumbnail.json();
    assert.match(rendered.html, /data-model-url="\/brilliant\/hero\.glb"/);
    assert.match(rendered.html, /src="\/brilliant\/hero\.svg"/);
    assert.match(rendered.html, /data-scroll-interactive="true"/);
    assert.equal(rendered.body.themeId, doc.manifest.id);
    const preview = await call(
      "/api/themes/" + doc.manifest.id + "/preview",
      "POST",
      { draft: false },
    );
    const { url } = await preview.json();
    const page = await call(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /data-model-url="\/brilliant\/hero\.glb"/);
    const asset = await call("/brilliant/hero.glb");
    assert.equal(asset.status, 200);
    const model = await new GLTFLoader().parseAsync(
      await asset.arrayBuffer(),
      "",
    );
    let meshes = 0;
    model.scene.traverse((node) => {
      if (node.isMesh) meshes++;
    });
    assert.equal(meshes, 7);
    assert.equal((await call("/brilliant/hero.svg")).status, 200);
  } finally {
    DB.close();
  }
});

test("the bundled model exception still rejects unsafe and arbitrary local URLs", () => {
  for (const url of [
    "/brilliant/missing.glb",
    "/brilliant/hero.glb?redirect=1",
    "/brilliant/../hero.glb",
    "//external.test/model.glb",
    "http://external.test/model.glb",
    "https://user:password@external.test/model.glb",
    "javascript:alert(1)",
    "file:///model.glb",
  ]) {
    const doc = migrateThemeDocument(legacyBrilliant());
    doc.templates.home.children[1].settings.url = url;
    assert.throws(() => validateDocument(doc, true), /HTTPS model URL/);
  }
  const doc = migrateThemeDocument(legacyBrilliant());
  doc.templates.home.children[1].settings.url =
    "https://models.example.test/model.glb";
  assert.doesNotThrow(() => validateDocument(doc, true));
});
