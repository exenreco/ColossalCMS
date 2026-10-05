import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8, zipSync } from "fflate";
import { inspectModel } from "../server/gltf.mjs";
import {
  defaultTheme,
  validateDocument,
  compileDocument,
} from "../server/theme-engine.mjs";
import { migrateThemeDocument } from "../server/theme-migrations.mjs";
import definitions from "../shared/theme-blocks.json" with { type: "json" };

test("every core block has a unique icon and mapped toolbar tools", () => {
  const catalog = definitions.filter(
    (b) => !b.legacy && b.type.startsWith("core/"),
  );
  assert.equal(catalog.length, 21);
  assert.equal(new Set(catalog.map((b) => b.icon)).size, 21);
  const actions = new Set([
    "bold",
    "italic",
    "underline",
    "strike",
    "inlineCode",
    "replace",
    "addColumn",
    "removeColumn",
  ]);
  for (const block of catalog) {
    assert.ok(block.toolbar?.length, block.type);
    const fields = new Set(block.fields.map((f) => f.key));
    for (const tool of block.toolbar)
      assert.ok(fields.has(tool) || actions.has(tool), block.type + " " + tool);
  }
});

test("legacy column migration preserves content and is stable on repeat", () => {
  const doc = defaultTheme();
  const child = {
    id: "old-text",
    type: "core/rich-text",
    settings: { html: "<p>Keep me</p>" },
  };
  doc.templates.default.children[1].children = [
    {
      id: "columns",
      type: "core/columns",
      settings: { columns: 2 },
      children: [child],
    },
  ];
  delete doc.parts.content;
  delete doc.manifest.parts.content;
  const migrated = migrateThemeDocument(doc);
  const column = migrated.templates.default.children[1].children[0].children[0];
  assert.equal(column.type, "core/column");
  assert.deepEqual(column.children, [child]);
  assert.deepEqual(
    migrateThemeDocument(migrated).templates,
    migrated.templates,
  );
  assert.equal(migrated.parts.content.children[0].type, "core/content");
  assert.equal(
    doc.templates.default.children[1].children[0].children[0].type,
    "core/rich-text",
  );
});

test("layout validator rejects malformed columns and part cycles", () => {
  const doc = defaultTheme();
  doc.templates.default.children[1].children = [
    { id: "bad-column", type: "core/column", settings: {}, children: [] },
  ];
  assert.throws(() => validateDocument(doc, true), /only be placed inside/);
  doc.templates.default.children[1].children = [
    {
      id: "bad-columns",
      type: "core/columns",
      settings: {},
      children: [{ id: "text", type: "core/rich-text", settings: {} }],
    },
  ];
  assert.throws(() => validateDocument(doc, true), /Column blocks only/);
  const cyclic = defaultTheme();
  cyclic.parts.content.children.push({
    id: "self",
    type: "theme/part-content",
    settings: {},
  });
  assert.throws(() => validateDocument(cyclic, true), /circular/);
});

test("default theme shares Content and renders Row and Columns layout settings", () => {
  const doc = defaultTheme();
  doc.parts.content.children.push({
    id: "row",
    type: "core/row",
    settings: { gap: 19, justify: "space-between" },
    children: [],
  });
  const compiled = compileDocument(doc);
  assert.match(compiled.compiled.default, /theme-part-content/);
  assert.match(compiled.compiled["full-width"], /data-block-id="row"/);
  assert.match(compiled.generatedCss, /gap:19px/);
  assert.match(compiled.generatedCss, /justify-content:space-between/);
});

test("glTF accepts self-contained and bundled assets and strips unsupported extensions", () => {
  const model = {
    asset: { version: "2.0" },
    buffers: [
      { byteLength: 4, uri: "data:application/octet-stream;base64,AAAAAA==" },
    ],
    extensions: { UNTRUSTED: { tint: 1 } },
  };
  const result = inspectModel(strToU8(JSON.stringify(model)), "scene.gltf");
  assert.equal(result.type, "model");
  assert.equal(result.metadata.warnings.length, 1);
  model.buffers[0].uri = "mesh.bin";
  const zipped = zipSync({
    "scene.gltf": strToU8(JSON.stringify(model)),
    "mesh.bin": new Uint8Array(4),
  });
  assert.equal(inspectModel(zipped, "scene.zip").type, "model");
});

test("glTF rejects remote resources, traversal, malformed GLB and excess geometry", () => {
  const bytes = (model) => strToU8(JSON.stringify(model));
  assert.throws(
    () =>
      inspectModel(
        bytes({
          asset: { version: "2.0" },
          buffers: [{ byteLength: 4, uri: "https://evil.test/mesh.bin" }],
        }),
        "scene.gltf",
      ),
    /remote references/,
  );
  assert.throws(
    () =>
      inspectModel(
        bytes({
          asset: { version: "2.0" },
          extensions: { UNKNOWN: { uri: "https://evil.test/a" } },
        }),
        "scene.gltf",
      ),
    /External model references/,
  );
  assert.throws(() => inspectModel(new Uint8Array(24), "scene.glb"), /GLB/);
  const model = {
    asset: { version: "2.0" },
    accessors: [{ count: 3000003, type: "VEC3", componentType: 5126 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
  };
  assert.throws(() => inspectModel(bytes(model), "scene.gltf"), /budget/);
});
