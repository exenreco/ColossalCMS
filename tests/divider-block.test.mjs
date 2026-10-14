import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultTheme,
  validateDocument,
  renderTheme,
} from "../server/theme-engine.mjs";
import { colossal2027Theme } from "../server/colossal-2027.mjs";
const ctx = {
  kind: "home",
  settings: {},
  allContent: [],
  media: [],
  content: { title: "Projects", details: {} },
};
test("Divider renders a semantic separator and safe configurable line geometry", () => {
  const d = defaultTheme();
  const id = d.manifest.templates[0].id;
  d.templates[id].children = [
    {
      id: "divider-example",
      type: "core/divider",
      settings: {
        lineColor: "#123456",
        thickness: 3,
        lineStyle: "dashed",
        dividerWidth: 60,
        align: "right",
        spacing: 12,
      },
    },
  ];
  const r = renderTheme(validateDocument(d, true), ctx, id);
  assert.match(r.html, /<hr class="theme-divider"/);
  assert.match(r.css, /border-top:3px dashed #123456/);
  assert.match(r.css, /width:60%/);
  assert.match(r.css, /margin:12px 0px 12px auto/);
  const node = d.templates[id].children[0];
  node.settings.lineColor = "url(https://bad.test/track)";
  node.settings.thickness = 100;
  const safe = renderTheme(validateDocument(d, true), ctx, id);
  assert.doesNotMatch(safe.css, /bad.test/);
  assert.match(safe.css, /border-top:12px dashed #74846a/);
});
test("Glossy Projects has a reasonable heading and an editable divider directly below it", () => {
  const d = colossal2027Theme();
  const children = d.templates.projects.children;
  const index = children.findIndex((n) => n.type === "core/title");
  assert.ok(index >= 0);
  assert.equal(children[index].settings.fontSize, 36);
  assert.equal(children[index].settings.lineHeight, 44);
  assert.equal(children[index + 1].type, "core/divider");
  const r = renderTheme(
    validateDocument(d, false),
    { ...ctx, kind: "page" },
    "projects",
  );
  assert.match(r.html, />Projects<\/h1>/);
  assert.match(r.html, /<hr class="theme-divider"/);
});
