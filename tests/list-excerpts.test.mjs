import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultTheme, renderTheme } from "../server/theme-engine.mjs";
import { migrateThemeDocument } from "../server/theme-migrations.mjs";
import { ensureThemes } from "../server/themes.mjs";
import { localDatabase } from "../scripts/local-database.mjs";

const entry = {
  id: "excerpt-entry",
  kind: "post",
  title: "A searchable story",
  slug: "searchable-story",
  publishAt: "2026-10-08T12:00:00Z",
  excerpt: 'One two three four <script>alert("excerpt")</script>',
  body: "Full body content",
  details: {},
};
const context = (kind = "post-index", content = entry) => ({
  kind,
  path: kind === "search" ? "/search" : "/",
  query: "searchable",
  settings: { title: "Excerpt tests", tagline: "Journal" },
  content,
  allContent: [content],
  media: [],
});
const list = (settings = {}) => ({
  id: "blk_excerpt_list",
  type: "core/post-list",
  settings: {},
  children: [{ id: "blk_excerpt_child", type: "core/excerpt", settings }],
});
const resultExcerpt = (document, id) =>
  document.templates[id].children[0].children[0];
const excerptBlock = (id) => ({
  id,
  type: "core/rich-text",
  settings: { html: "<p>{{content.excerpt}}</p>" },
});

test("full-content default templates render the body without injecting excerpts", () => {
  const document = defaultTheme();
  for (const [id, kind] of [
    ["home", "home"],
    ["default", "page"],
    ["full-width", "page"],
    ["post-single", "post"],
  ]) {
    assert.doesNotMatch(
      JSON.stringify(document.templates[id]),
      /content\.excerpt/,
    );
    const rendered = renderTheme(document, context(kind), id);
    assert.match(rendered.html, /Full body content/);
    assert.doesNotMatch(rendered.html, /One two three four/);
  }
});

test("post lists and search results independently hide, shorten, or show escaped saved excerpts", () => {
  for (const [id, kind] of [
    ["post-archive", "post-index"],
    ["search", "search"],
  ]) {
    const document = defaultTheme();
    document.templates[id].children = [list({ excerptLength: 3 })];
    delete document.compiled;
    assert.match(
      renderTheme(document, context(kind), id).html,
      /One two three…/,
    );
    resultExcerpt(document, id).settings.showExcerpt = false;
    assert.doesNotMatch(
      renderTheme(document, context(kind), id).html,
      /theme-post-excerpt|One two/,
    );
    resultExcerpt(document, id).settings = {
      excerptLength: 0,
      showDate: false,
    };
    const full = renderTheme(document, context(kind), id).html;
    assert.match(full, /One two three four &lt;script&gt;/);
    assert.doesNotMatch(full, /<script>|…/);
    assert.doesNotMatch(
      renderTheme(document, context(kind, { ...entry, excerpt: "  " }), id)
        .html,
      /theme-post-excerpt/,
    );
    resultExcerpt(document, id).settings.excerptLength = -1;
    assert.match(
      renderTheme(document, context(kind), id).html,
      /One two three four/,
    );
  }
});

test("excerpt cleanup removes only standalone placeholder blocks and is idempotent", () => {
  const document = defaultTheme();
  document.templates.home.children = [
    excerptBlock("blk_old_excerpt"),
    {
      id: "blk_authored_html",
      type: "core/rich-text",
      settings: { html: "<p>My introduction: {{content.excerpt}}</p>" },
    },
    {
      id: "blk_real_paragraph",
      type: "core/paragraph",
      settings: { html: "My authored summary" },
    },
    {
      id: "blk_excerpt_list",
      type: "core/post-list",
      settings: { showExcerpt: false, excerptLength: 12 },
    },
  ];
  document.parts.header.children.push(excerptBlock("blk_shared_excerpt"));
  const migrated = migrateThemeDocument(document);
  assert.deepEqual(
    migrated.templates.home.children.map((node) => node.id),
    ["blk_authored_html", "blk_real_paragraph", "blk_excerpt_list"],
  );
  const migratedExcerpt = migrated.templates.home.children[2].children.find(
    (node) => node.type === "core/excerpt",
  );
  assert.equal(migratedExcerpt.settings.excerptLength, 12);
  assert.equal(migratedExcerpt.settings.showExcerpt, false);
  assert.doesNotMatch(
    JSON.stringify(migrated.parts.header),
    /content\.excerpt/,
  );
  assert.equal(migrated.compiled, undefined);
  assert.match(JSON.stringify(document.templates.home), /blk_old_excerpt/);
  assert.deepEqual(migrateThemeDocument(migrated), migrated);
});

test("existing published and draft themes persist the excerpt cleanup once and recompile layouts", async () => {
  const db = localDatabase();
  try {
    await ensureThemes(db);
    const document = defaultTheme();
    document.manifest.id = "test.excerpts.migration";
    document.manifest.isCore = false;
    document.templates.home.children.push(excerptBlock("blk_old_excerpt"));
    const draft = structuredClone(document);
    draft.parts.header.children.push(excerptBlock("blk_draft_excerpt"));
    draft.css += ".theme-root{border-color:#123456}";
    await db
      .prepare(
        "INSERT INTO themes (id,manifest,published,draft,active,is_core,revision,updated_at) VALUES (?,?,?,?,0,0,7,?)",
      )
      .bind(
        document.manifest.id,
        JSON.stringify(document.manifest),
        JSON.stringify(document),
        JSON.stringify(draft),
        "2026-10-08",
      )
      .run();
    await db
      .prepare("DELETE FROM config WHERE id='theme-list-excerpts-v1'")
      .run();
    await ensureThemes(db);
    const row = await db
      .prepare("SELECT * FROM themes WHERE id=?")
      .bind(document.manifest.id)
      .first();
    assert.equal(row.revision, 8);
    for (const snapshot of [row.published, row.draft]) {
      const saved = JSON.parse(snapshot);
      assert.doesNotMatch(JSON.stringify(saved.templates), /content\.excerpt/);
      assert.doesNotMatch(JSON.stringify(saved.parts), /content\.excerpt/);
      assert.doesNotMatch(saved.compiled.home, /content\.excerpt/);
    }
    assert.match(JSON.parse(row.draft).css, /border-color:#123456/);
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
