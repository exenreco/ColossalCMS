import test from "node:test";
import assert from "node:assert/strict";
import { parseDocument } from "htmlparser2";
import { textContent } from "domutils";
import definitions from "../shared/theme-blocks.json" with { type: "json" };
import {
  highlightHtml,
  indentHtml,
  normalizeFormattedHtmlNames,
  normalizeFormattedHtmlBlocks,
} from "../shared/formatted-html.ts";
import { defaultTheme, renderTheme } from "../server/theme-engine.mjs";
import { ensureThemes, ensureFormattedHtmlContent } from "../server/themes.mjs";
import { localDatabase } from "../scripts/local-database.mjs";

const source =
  "<h2>A new perspective</h2>\n<p>Built with <strong>care</strong>.</p>";
const htmlBlock = (label = "Rich text") => ({
  id: "blk_formatted_html",
  type: "core/rich-text",
  settings: { html: source },
  editor: { label },
});
const context = {
  kind: "home",
  settings: { title: "HTML test" },
  allContent: [],
  media: [],
};

test("Formatted HTML retains its storage identifier and renders normal HTML publicly", () => {
  const definition = definitions.find(
    (entry) => entry.type === "core/rich-text",
  );
  assert.equal(definition.label, "Formatted HTML");
  assert.equal(definition.icon, "fas fa-code");
  const document = defaultTheme();
  document.templates.home.children = [htmlBlock()];
  const before = renderTheme(document, context).html;
  normalizeFormattedHtmlNames(document);
  assert.equal(
    document.templates.home.children[0].editor.label,
    "Formatted HTML",
  );
  assert.equal(document.templates.home.children[0].settings.html, source);
  assert.equal(renderTheme(document, context).html, before);
  assert.doesNotMatch(before, /data-html-editor|cl-html-editor|textarea/);
});

test("legacy fragments consolidate across templates and parts without changing markup, IDs or custom labels", () => {
  const document = defaultTheme();
  document.templates.home.children = [
    { ...htmlBlock("HTML fragment"), type: "core/html" },
  ];
  document.parts.header.children = [
    {
      ...htmlBlock("Custom source"),
      type: "core/html",
      id: "blk_custom_fragment",
    },
  ];
  document.blocks.push({
    type: "core/html",
    label: "HTML fragment",
    fields: [],
    icon: "fas fa-code",
  });
  const before = renderTheme(document, context).html;
  normalizeFormattedHtmlNames(document);
  assert.equal(document.templates.home.children[0].type, "core/rich-text");
  assert.equal(document.templates.home.children[0].id, "blk_formatted_html");
  assert.equal(
    document.templates.home.children[0].editor.label,
    "Formatted HTML",
  );
  assert.equal(document.parts.header.children[0].type, "core/rich-text");
  assert.equal(document.parts.header.children[0].editor.label, "Custom source");
  assert.equal(
    document.blocks.some((entry) => entry.type === "core/html"),
    false,
  );
  assert.equal(renderTheme(document, context).html, before);
  const once = JSON.stringify(document);
  normalizeFormattedHtmlNames(document);
  assert.equal(JSON.stringify(document), once);
});

test("post and page fragments migrate persistently and nested blocks retain source", async () => {
  const db = localDatabase();
  try {
    for (const kind of ["post", "page"]) {
      const details = {
        contentBlocks: [
          {
            id: "layout",
            type: "core/container",
            settings: {},
            children: [{ ...htmlBlock("HTML fragment"), type: "core/html" }],
          },
        ],
      };
      await db
        .prepare(
          "INSERT INTO content (id,kind,title,slug,excerpt,body,status,publish_at,updated_at,author,details) VALUES (?,?,?,?,?,'','draft','','','owner',?)",
        )
        .bind(
          kind,
          kind,
          "Source",
          kind,
          "Excerpt preserved",
          JSON.stringify(details),
        )
        .run();
    }
    assert.equal(await ensureFormattedHtmlContent(db), true);
    for (const kind of ["post", "page"]) {
      const row = await db
        .prepare("SELECT * FROM content WHERE id=?")
        .bind(kind)
        .first();
      const details = JSON.parse(row.details);
      const node = details.contentBlocks[0].children[0];
      assert.equal(node.type, "core/rich-text");
      assert.equal(node.id, "blk_formatted_html");
      assert.equal(node.settings.html, source);
      assert.equal(row.excerpt, "Excerpt preserved");
      const once = JSON.stringify(details);
      normalizeFormattedHtmlBlocks(details.contentBlocks);
      assert.equal(JSON.stringify(details), once);
    }
    assert.equal(await ensureFormattedHtmlContent(db), true);
  } finally {
    db.close();
  }
});

test("syntax highlighting displays source exactly and never executes source markup", () => {
  const raw =
    '<!-- note -->\n<a href="https://example.test">{{content.title}} &amp;</a>\n<script>bad()</script></textarea><img src=x onerror=bad()>';
  const decorated = highlightHtml(raw);
  assert.equal(textContent(parseDocument(decorated)), raw);
  assert.match(decorated, /cl-html-tag/);
  assert.match(decorated, /cl-html-string/);
  assert.match(decorated, /cl-html-comment/);
  assert.doesNotMatch(decorated, /<script|<img|<\/textarea>/);
});

test("source indentation preserves selections and supports multiple lines and outdent", () => {
  assert.deepEqual(indentHtml("<p></p>", 3, 3), {
    value: "<p>  </p>",
    start: 5,
    end: 5,
  });
  const original = "<div>\n  <p>Text</p>\n</div>";
  const indented = indentHtml(original, 0, original.length);
  assert.equal(indented.value, "  <div>\n    <p>Text</p>\n  </div>");
  const restored = indentHtml(
    indented.value,
    indented.start,
    indented.end,
    true,
  );
  assert.equal(restored.value, original);
  assert.equal(restored.start, 0);
  assert.equal(restored.end, original.length);
  assert.equal(indentHtml("\n<p>", 0, 0).value, "  \n<p>");
});

test("existing theme drafts and published snapshots migrate labels once without changing block IDs, HTML, or custom names", async () => {
  const db = localDatabase();
  try {
    await ensureThemes(db);
    const document = defaultTheme();
    document.manifest.id = "test.formatted.html";
    document.manifest.isCore = false;
    document.templates.home.children = [
      htmlBlock(),
      { ...htmlBlock("Introduction"), id: "blk_custom_name" },
    ];
    document.parts.header.children = [
      { ...htmlBlock(), id: "blk_shared_html" },
    ];
    document.blocks = [
      {
        type: "core/rich-text",
        label: "Rich text",
        icon: "fas fa-align-left",
        category: "Content",
        fields: [],
      },
    ];
    await db
      .prepare(
        "INSERT INTO themes (id,manifest,published,draft,active,is_core,revision,updated_at) VALUES (?,?,?,?,0,0,7,?)",
      )
      .bind(
        document.manifest.id,
        JSON.stringify(document.manifest),
        JSON.stringify(document),
        JSON.stringify(document),
        new Date().toISOString(),
      )
      .run();
    await db
      .prepare("DELETE FROM config WHERE id='formatted-html-labels-v1'")
      .run();
    await ensureThemes(db);
    const row = await db
      .prepare("SELECT * FROM themes WHERE id=?")
      .bind(document.manifest.id)
      .first();
    assert.equal(row.revision, 8);
    for (const snapshot of [row.published, row.draft]) {
      const upgraded = JSON.parse(snapshot);
      assert.equal(
        upgraded.templates.home.children[0].id,
        "blk_formatted_html",
      );
      assert.equal(
        upgraded.templates.home.children[0].editor.label,
        "Formatted HTML",
      );
      assert.equal(upgraded.templates.home.children[0].settings.html, source);
      assert.equal(
        upgraded.templates.home.children[1].editor.label,
        "Introduction",
      );
      assert.equal(
        upgraded.parts.header.children[0].editor.label,
        "Formatted HTML",
      );
      assert.equal(upgraded.blocks[0].label, "Formatted HTML");
      assert.equal(upgraded.blocks[0].icon, "fas fa-code");
    }
    await ensureThemes(db);
    assert.equal(
      (
        await db
          .prepare("SELECT revision FROM themes WHERE id=?")
          .bind(document.manifest.id)
          .first()
      ).revision,
      8,
    );
  } finally {
    db.close();
  }
});
