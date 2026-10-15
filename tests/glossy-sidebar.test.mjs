import test from "node:test";
import assert from "node:assert/strict";
import { colossal2027Theme } from "../server/colossal-2027.mjs";
import { renderTheme } from "../server/theme-engine.mjs";
import { migrateGlasseyDocument } from "../server/glassey-migration.mjs";

test("Glossy sidebar uses an inline dark search and is pinned only on desktop", () => {
  const d = colossal2027Theme();
  const search = d.parts.sidebar.children.find((n) => n.type === "core/search");
  assert.equal(search.settings.searchStyle, "dark");
  assert.equal(search.settings.presentation, "inline");
  const result = renderTheme(d, {
    kind: "post",
    content: { title: "Example", body: "Post content", details: {} },
    settings: {},
    allContent: [],
    media: [],
  });
  assert.match(result.html, /theme-search-dark/);
  assert.match(result.html, /data-search-mode="inline"/);
  assert.match(result.css, /@media\(min-width:1025px\)/);
  assert.match(result.css, /position:sticky;top:120px/);
  assert.match(
    result.css,
    /theme-part-sidebar\{max-height:none;overflow:visible\}/,
  );
  search.settings.searchStyle = "light-outline";
  const before = structuredClone(d);
  migrateGlasseyDocument(d);
  assert.deepEqual(d, before);
});
