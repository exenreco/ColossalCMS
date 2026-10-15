import test from "node:test";
import assert from "node:assert/strict";
import { colossal2027Theme } from "../server/colossal-2027.mjs";
import { renderTheme, validateDocument } from "../server/theme-engine.mjs";
import { migrateGlasseyDocument } from "../server/glassey-migration.mjs";

test("Glossy 404 renders full viewport particle markup and native editable message and home button", () => {
  const document = validateDocument(colossal2027Theme(), false);
  const root = document.templates["not-found"];
  assert.match(root.settings.classes, /c27-not-found/);
  assert.equal(root.children[0].type, "glossy/particle-text");
  const result = renderTheme(document, {
    kind: "404",
    settings: { title: "My Portfolio" },
    content: null,
    allContent: [],
    media: [],
  });
  assert.match(result.html, /data-particle-text="404"/);
  assert.match(result.html, /data-particle-color="#c5e5ff"/);
  assert.match(result.html, /data-particle-radius="130"/);
  assert.match(result.html, /glossy-particle-fallback">404<\/h1>/);
  assert.match(result.html, /My Portfolio/);
  assert.match(result.html, /A little off the map/);
  assert.match(result.html, /href="\/"/);
  assert.match(result.css, /min-height:100vh/);
  assert.doesNotMatch(result.html, /<script|theme-part-footer/);
  root.children[2].children[0].settings.text = "Custom error message";
  const before = structuredClone(document);
  migrateGlasseyDocument(document);
  assert.deepEqual(document, before);
});
