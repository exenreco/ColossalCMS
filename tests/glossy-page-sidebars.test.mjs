import test from "node:test";
import assert from "node:assert/strict";
import { colossal2027Theme } from "../server/colossal-2027.mjs";
import { migrateGlasseyDocument } from "../server/glassey-migration.mjs";
import { renderTheme, validateDocument } from "../server/theme-engine.mjs";
const hasSidebar = (node) =>
  node.type === "theme/part-sidebar" || node.children?.some(hasSidebar);

test("Glossy page templates reuse the shared sidebar and its current-content Trivia block", () => {
  const d = colossal2027Theme();
  for (const id of ["default", "full-width"])
    assert.ok(hasSidebar(d.templates[id]));
  assert.equal(
    d.parts.sidebar.children.filter((n) => n.type === "trivia/quiz").length,
    1,
  );
  const rendered = renderTheme(
    d,
    {
      kind: "page",
      content: {
        id: "about",
        title: "About",
        body: "Our authored content",
        details: {},
      },
      settings: {},
      allContent: [],
      media: [],
      plugins: [{ id: "com.colossal.trivia" }],
    },
    "default",
  );
  assert.match(rendered.html, /theme-part-sidebar/);
  assert.match(rendered.html, /Quick trivia/);
  assert.match(rendered.html, /data-trivia-scope="current"/);
  assert.match(rendered.html, /data-trivia-content="about"/);
  assert.match(rendered.html, /Our authored content/);
  assert.match(rendered.css, /c27-single-sidebar\{border-style:solid/);
  const before = structuredClone(d);
  migrateGlasseyDocument(d);
  assert.deepEqual(d, before);
});
test("Existing custom page blocks and other role templates survive the sidebar migration", () => {
  const d = colossal2027Theme();
  d.css = d.css.replace("/* Glossy page templates with shared sidebar */", "");
  d.manifest.templates.push({
    id: "custom-page",
    name: "Custom",
    file: "templates/custom-page.html",
    appliesTo: ["page"],
  });
  const content = {
    id: "authored-paragraph",
    type: "core/paragraph",
    settings: { html: "Preserve this content", color: "#123456" },
  };
  d.templates["custom-page"] = {
    id: "custom-body",
    type: "core/container",
    settings: { classes: "c27-body custom-body", backgroundColor: "#121212" },
    children: [structuredClone(content)],
  };
  const home = structuredClone(d.templates.home),
    search = structuredClone(d.templates.search),
    error = structuredClone(d.templates["not-found"]);
  migrateGlasseyDocument(d);
  const root = d.templates["custom-page"];
  assert.ok(hasSidebar(root));
  assert.deepEqual(root.children[0].children[0].children[0], content);
  assert.equal(root.settings.backgroundColor, "#121212");
  assert.deepEqual(d.templates.home, home);
  assert.deepEqual(d.templates.search, search);
  assert.deepEqual(d.templates["not-found"], error);
  validateDocument(d, false);
});
