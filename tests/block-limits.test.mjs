import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  defaultTheme,
  validateDocument,
  compileBlock,
} from "../server/theme-engine.mjs";
import { applyOutlineCommand } from "../shared/outline-document.ts";
import { MAX_BLOCK_DEPTH } from "../shared/block-limits.ts";
import { normalizeFormattedHtmlBlocks } from "../shared/formatted-html.ts";
const definitions = JSON.parse(
  readFileSync(new URL("../shared/theme-blocks.json", import.meta.url)),
);
function tree(depth, leafType = "core/paragraph") {
  let node = { id: "leaf", type: leafType, settings: { html: "Deep content" } };
  for (let level = depth - 1; level >= 0; level--)
    node = {
      id: "level-" + level,
      type: "core/container",
      settings: {},
      children: [node],
    };
  return node;
}
test("deep layout trees can be edited, saved and rendered at the shared depth limit", () => {
  const d = defaultTheme();
  d.templates.default = tree(MAX_BLOCK_DEPTH);
  applyOutlineCommand(
    d.templates.default,
    { type: "update", id: "leaf", settings: { html: "Edited deep content" } },
    definitions,
  );
  const validated = validateDocument(d, true);
  assert.match(
    compileBlock(validated.templates.default, validated),
    /Edited deep content/,
  );
  const legacy = tree(MAX_BLOCK_DEPTH, "core/html");
  normalizeFormattedHtmlBlocks([legacy]);
  let leaf = legacy;
  while (leaf.children) leaf = leaf.children[0];
  assert.equal(leaf.type, "core/rich-text");
});
test("depth and total block failures are distinct and stay bounded", () => {
  const d = defaultTheme();
  d.templates.default = tree(MAX_BLOCK_DEPTH + 1);
  assert.throws(() => validateDocument(d, true), /maximum nesting depth of 16/);
  assert.throws(
    () =>
      applyOutlineCommand(
        d.templates.default,
        { type: "update", id: "leaf", settings: { html: "too deep" } },
        definitions,
      ),
    /nesting depth of 16/,
  );
  d.templates.default = {
    id: "root",
    type: "core/container",
    settings: {},
    children: Array.from({ length: 2001 }, (_, i) => ({
      id: "p-" + i,
      type: "core/paragraph",
      settings: { html: "Text" },
    })),
  };
  assert.throws(() => validateDocument(d, true), /total block limit of 2,000/);
});
test("nested shared-part instances render past the old renderer cutoff", () => {
  const d = defaultTheme();
  d.parts.content = tree(12);
  d.templates.default = tree(10);
  let parent = d.templates.default;
  while (parent.children[0].children) parent = parent.children[0];
  parent.children = [
    { id: "shared-content", type: "theme/part-content", settings: {} },
  ];
  const validated = validateDocument(d, true);
  assert.match(
    compileBlock(validated.templates.default, validated),
    /Deep content/,
  );
});
