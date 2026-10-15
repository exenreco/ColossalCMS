import test from "node:test";
import assert from "node:assert/strict";
import { colossal2027Theme } from "../server/colossal-2027.mjs";
import { alignGlossyTemplateHeadings } from "../server/glossy-template-headings.mjs";

function headingPair(node) {
  if (node.type === "core/post-list") return;
  const children = node.children || [];
  const index = children.findIndex(
    (child) =>
      child.type === "core/title" ||
      (child.type === "core/heading" && child.settings?.level === "h1"),
  );
  if (index >= 0) return children.slice(index, index + 2);
  for (const child of children) {
    const pair = headingPair(child);
    if (pair) return pair;
  }
}

test("Glossy standard templates share Posts heading typography and native divider", () => {
  const document = colossal2027Theme();
  const [reference, divider] = headingPair(document.templates["post-archive"]);
  for (const id of [
    "default",
    "full-width",
    "post-single",
    "search",
    "contact",
  ]) {
    const [heading, next] = headingPair(document.templates[id]);
    assert.equal(heading.settings.fontSize, reference.settings.fontSize, id);
    assert.equal(
      heading.settings.lineHeight,
      reference.settings.lineHeight,
      id,
    );
    assert.equal(next.type, "core/divider", id);
    assert.deepEqual(next.settings, divider.settings, id);
  }
  assert.match(
    headingPair(document.templates.home)[0].settings.text,
    /Ideas into/,
  );
});

test("installed heading migration preserves content, existing divider identities, hero and card titles", () => {
  const heading = {
    id: "title",
    type: "core/title",
    settings: { classes: "authored", fontSize: 70 },
  };
  const divider = {
    id: "divider",
    type: "core/divider",
    settings: { thickness: 4 },
  };
  const content = { id: "content", type: "core/post-content", settings: {} };
  const card = {
    type: "core/post-list",
    children: [{ type: "core/title", settings: { fontSize: 20 } }],
  };
  const document = {
    templates: {
      "post-archive": {
        children: [
          { type: "core/title", settings: { fontSize: 36, lineHeight: 44 } },
          { type: "core/divider", settings: { thickness: 1, spacing: 16 } },
        ],
      },
      default: { children: [heading, divider, content, card] },
      home: {
        children: [
          { type: "core/heading", settings: { level: "h1", text: "Hero" } },
        ],
      },
      "not-found": { children: [] },
      custom: { children: [structuredClone(card)] },
    },
    compiled: { stale: true },
  };
  const preserved = structuredClone({
    home: document.templates.home,
    custom: document.templates.custom,
    card,
  });
  alignGlossyTemplateHeadings(document);
  assert.equal(heading.id, "title");
  assert.match(heading.settings.classes, /authored/);
  assert.equal(divider.id, "divider");
  assert.equal(document.templates.default.children[2], content);
  assert.deepEqual(
    { home: document.templates.home, custom: document.templates.custom, card },
    preserved,
  );
  assert.equal(document.compiled, undefined);
  const once = structuredClone(document);
  alignGlossyTemplateHeadings(document);
  assert.deepEqual(document, once);
});
