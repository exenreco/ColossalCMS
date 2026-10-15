import test from "node:test";
import assert from "node:assert/strict";
import { colossal2027Theme } from "../server/colossal-2027.mjs";
import { migrateGlasseyDocument } from "../server/glassey-migration.mjs";
import { resolveTemplateForContent } from "../server/theme-engine.mjs";

test("Glossy removes Projects and Resume from new and installed documents without changing post templates", () => {
  const document = colossal2027Theme();
  const posts = structuredClone(document.templates["post-archive"]);
  const single = structuredClone(document.templates["post-single"]);
  for (const id of ["projects", "resume"]) {
    assert.equal(document.templates[id], undefined);
    document.manifest.templates.push({
      id,
      name: id,
      file: `templates/${id}.html`,
      appliesTo: ["page"],
    });
    document.templates[id] = structuredClone(document.templates.default);
    document.html[`templates/${id}.html`] = "old template";
  }
  migrateGlasseyDocument(document);
  for (const id of ["projects", "resume"]) {
    assert.equal(document.templates[id], undefined);
    assert.equal(document.html[`templates/${id}.html`], undefined);
    assert.ok(
      !document.manifest.templates.some((template) => template.id === id),
    );
    assert.equal(
      resolveTemplateForContent(document, "page", id).template.id,
      "default",
    );
  }
  assert.deepEqual(document.templates["post-archive"], posts);
  assert.deepEqual(document.templates["post-single"], single);
  const once = structuredClone(document);
  migrateGlasseyDocument(document);
  assert.deepEqual(document, once);
});
