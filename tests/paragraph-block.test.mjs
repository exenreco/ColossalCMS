import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultTheme,
  renderTheme,
  validateDocument,
  sanitizeParagraph,
  renderContentCanvas,
} from "../server/theme-engine.mjs";
import { validateDetails } from "../server/v2-utils.mjs";

const context = {
  kind: "home",
  settings: { title: "Paragraph test" },
  allContent: [],
  media: [],
};
const paragraph = (html = "") => ({
  id: "blk_paragraph001",
  type: "core/paragraph",
  settings: {
    html,
    fontFamily: "Georgia",
    fontSize: "24px",
    align: "center",
    lineHeight: "36px",
  },
});

test("paragraphs render semantic text and shared Typography settings without editor affordances", () => {
  const document = defaultTheme();
  document.templates.home.children = [
    paragraph("Hello <strong>world</strong><br>Next line"),
  ];
  const rendered = renderTheme(validateDocument(document, true), context);
  assert.match(
    rendered.html,
    /<p>Hello <strong>world<\/strong><br\s*\/?>Next line<\/p>/,
  );
  assert.match(rendered.html, /font-family:'Georgia'/);
  assert.match(rendered.html, /font-size:24px/);
  assert.match(rendered.html, /line-height:36px/);
  assert.match(rendered.html, /text-align:center/);
  assert.doesNotMatch(
    rendered.html,
    /contenteditable|Start writing|data-paragraph-editor/,
  );
});

test("paragraph inline HTML keeps formatting and safe links while removing nested blocks and scripts", () => {
  const html = sanitizeParagraph(
    '<p>Hello <em>reader</em></p><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">Bad link</a><a href="https://example.com">Good link</a>',
  );
  assert.match(html, /Hello <em>reader<\/em>/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.doesNotMatch(html, /<p>|script|alert|onerror|<img|javascript:/);
  const document = defaultTheme();
  document.templates.home.children = [
    paragraph('<div>Inline text</div><strong onclick="alert(1)">safe</strong>'),
  ];
  assert.equal(
    validateDocument(document, true).templates.home.children[0].settings.html,
    "Inline text<strong>safe</strong>",
  );
});

test("blank paragraphs render empty public text rather than the editor placeholder", () => {
  const document = defaultTheme();
  document.templates.home.children = [paragraph()];
  assert.match(renderTheme(document, context).html, /<p><\/p>/);
});

test("post and page paragraphs validate, persist inline formatting, and render in their own canvas", async () => {
  const db = { prepare: () => ({ first: async () => null }) };
  const details = await validateDetails(db, {
    contentBlocks: [paragraph("<strong>Saved</strong><script>bad()</script>")],
  });
  assert.equal(
    details.contentBlocks[0].settings.html,
    "<strong>Saved</strong>",
  );
  for (const kind of ["page", "post"]) {
    const rendered = renderContentCanvas(
      defaultTheme(),
      { ...context, kind, content: { title: "Content", body: "", details } },
      "blk_main001",
    );
    assert.match(rendered.html, /<p><strong>Saved<\/strong><\/p>/);
    assert.doesNotMatch(rendered.html, /contenteditable|bad\(\)/);
  }
});
