import test from "node:test";
import assert from "node:assert/strict";
import { colossal2027Theme } from "../server/colossal-2027.mjs";
import { migrateGlasseyDocument } from "../server/glassey-migration.mjs";
import {
  renderTheme,
  resolveTemplateForContent,
} from "../server/theme-engine.mjs";

test("Imported Glossy pages regain shared chrome while preserving their title, content and post templates", () => {
  const d = colossal2027Theme();
  d.css = d.css.replace("/* Glossy restored page template chrome */", "");
  const posts = structuredClone(d.templates["post-single"]);
  for (const id of ["default", "full-width"])
    d.templates[id] = {
      id: "blk_portfolio_" + id,
      type: "core/container",
      settings: { classes: "c27-body c27-section" },
      children: [
        { id: id + "-title", type: "core/title", settings: { level: "h1" } },
        { id: id + "-excerpt", type: "core/excerpt", settings: {} },
        { id: id + "-content", type: "core/post-content", settings: {} },
      ],
    };
  migrateGlasseyDocument(d);
  for (const id of ["default", "full-width"]) {
    const root = d.templates[id];
    assert.deepEqual(
      root.children.map((n) => n.type),
      ["theme/part-header", "core/container", "theme/part-footer"],
    );
    assert.equal(root.children[1].children[0].id, id + "-title");
    assert.equal(root.children[1].children[1].id, id + "-content");
    const result = renderTheme(
      d,
      {
        kind: "page",
        content: {
          title: "About",
          body: "Authored page content",
          excerpt: "Not a page heading",
          details: {},
        },
        settings: {},
        allContent: [],
        media: [],
      },
      id,
    );
    assert.match(result.html, /theme-part-header/);
    assert.match(result.html, /theme-part-footer/);
    assert.match(result.html, /Authored page content/);
    assert.doesNotMatch(result.html, /Not a page heading/);
  }
  assert.equal(resolveTemplateForContent(d, "page", "").template.id, "default");
  assert.deepEqual(d.templates["post-single"], posts);
  const once = structuredClone(d);
  migrateGlasseyDocument(d);
  assert.deepEqual(d, once);
});
