import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  defaultTheme,
  renderTheme,
  renderContentCanvas,
  validateDocument,
} from "../server/theme-engine.mjs";
import { migrateThemeDocument } from "../server/theme-migrations.mjs";
import { ensureThemes } from "../server/themes.mjs";
import { validateDetails } from "../server/v2-utils.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { applyOutlineCommand } from "../shared/outline-document.ts";
import {
  canPlacePagination,
  normalizeContextDocument,
} from "../shared/context-blocks.ts";
import worker from "../server/worker.mjs";

const definitions = JSON.parse(
  readFileSync(new URL("../shared/theme-blocks.json", import.meta.url)),
);
const block = (id, type, settings = {}, children) => ({
  id: "blk_" + id,
  type,
  settings,
  ...(children ? { children } : {}),
});
const container = (id, children, settings = {}) =>
  block(id, "core/container", settings, children);
const entry = (id, category = "design") => ({
  id,
  kind: "post",
  title: "Story " + id,
  slug: "story-" + id,
  excerpt: "One two three <unsafe>",
  body: "Full story " + id,
  publishAt: "2026-10-08T12:00:00Z",
  details: { categories: [category], featuredImageId: "image-" + id },
});
const context = (
  allContent = [entry("a"), entry("b"), entry("c"), entry("other", "other")],
) => ({
  kind: "post-index",
  path: "/stories",
  page: 1,
  content: { title: "Outer page", excerpt: "Outer summary", details: {} },
  settings: {
    title: "My <site>",
    logo: "https://example.test/logo.png",
    tagline: "Stories",
  },
  allContent,
  media: allContent.map((item) => ({
    id: "image-" + item.id,
    type: "image",
    url: "/media/" + item.id + ".png",
    altText: "Image " + item.id,
  })),
});
const themeWith = (children) => {
  const document = defaultTheme();
  document.templates["post-archive"].children = children;
  delete document.compiled;
  return document;
};
test("Tagline reads live site settings, escapes markup, ignores content overrides and renders in page/post canvases", async () => {
  const definition = definitions.find((item) => item.type === "core/tagline");
  assert.equal(definition.category, "Dynamic");
  assert.ok(
    !definition.fields.some((field) =>
      ["html", "text", "content", "tagline"].includes(field.key),
    ),
  );
  const tagline = block("site_tagline_native", "core/tagline", {
    text: "Forged text",
    html: "<b>Forged HTML</b>",
    fontSize: 24,
  });
  const document = themeWith([tagline]);
  const ctx = context();
  ctx.settings.tagline = "A <clear> & thoughtful tagline";
  const publicRender = renderTheme(document, ctx);
  assert.match(publicRender.html, /class="theme-site-tagline"/);
  assert.match(publicRender.html, /A &lt;clear&gt; &amp; thoughtful tagline/);
  assert.ok(!publicRender.html.includes("Forged"));
  ctx.settings.tagline = "Updated in Admin Settings";
  assert.match(renderTheme(document, ctx).html, /Updated in Admin Settings/);
  for (const kind of ["page", "post"]) {
    ctx.content = {
      ...entry("tagline"),
      kind,
      details: { contentBlocks: [tagline] },
    };
    ctx.kind = kind;
    assert.match(
      renderContentCanvas(document, ctx, "blk_tagline_main").html,
      /Updated in Admin Settings/,
    );
  }
  ctx.settings.tagline = "";
  assert.ok(
    !renderTheme(document, { ...ctx, kind: "post-index" }).html.includes(
      "theme-site-tagline",
    ),
  );
  const db = localDatabase();
  try {
    assert.equal(
      (await validateDetails(db, { contentBlocks: [tagline] })).contentBlocks[0]
        .type,
      "core/tagline",
    );
  } finally {
    db.close();
  }
});
const nestedList = () =>
  block(
    "result_list",
    "core/post-list",
    { limit: 2, category: "design", orderBy: "title", order: "ascending" },
    [
      container(
        "result_card",
        [
          block("result_image", "core/featured-image", {
            linkToContent: true,
            aspectRatio: "16/9",
          }),
          block("result_title", "core/title", {
            level: "h3",
            linkToContent: true,
            anchor: "story-heading",
            fontSize: 28,
          }),
          block("result_excerpt", "core/excerpt", { excerptLength: 2 }),
        ],
        { classes: "authored-card" },
      ),
      container(
        "pager_layout",
        [block("result_pager", "core/pagination", { style: "numbers" })],
        { classes: "authored-pager" },
      ),
    ],
  );

test("context blocks are discoverable and have no editable title, identity, excerpt, or image override", () => {
  for (const type of [
    "core/title",
    "core/excerpt",
    "core/featured-image",
    "core/site-brand",
  ]) {
    const definition = definitions.find((item) => item.type === type);
    assert.ok(definition && !definition.legacy);
    assert.ok(
      !definition.fields.some((field) =>
        ["text", "html", "mediaId"].includes(field.key),
      ),
    );
  }
  assert.equal(
    definitions.find((item) => item.type === "core/post-list").container,
    true,
  );
  const document = defaultTheme();
  assert.doesNotMatch(
    JSON.stringify([document.templates, document.parts]),
    /\{\{(?:site\.title|content\.title|content\.excerpt)\}\}/,
  );
  assert.doesNotThrow(() => validateDocument(document, true));
});

test("Title, Excerpt and Featured image resolve current content in both page and post canvases", () => {
  for (const kind of ["post", "page"]) {
    const ctx = context();
    ctx.kind = kind;
    ctx.content = {
      ...entry("current"),
      kind,
      title: "Current <title>",
      details: {
        featuredImageId: "image-a",
        contentBlocks: [
          block("current_title", "core/title", {
            level: "h1",
            text: "Forged title",
            html: "Forged HTML",
          }),
          block("current_image", "core/featured-image", { mediaId: "image-b" }),
          block("current_excerpt", "core/excerpt", { excerptLength: 2 }),
        ],
      },
    };
    const rendered = renderContentCanvas(
      defaultTheme(),
      ctx,
      "blk_canvas-main",
    );
    assert.match(
      rendered.html,
      /<h1 class="theme-content-title">Current &lt;title&gt;<\/h1>/,
    );
    assert.match(rendered.html, /One two…/);
    assert.match(rendered.html, /src="\/media\/a.png"/);
    assert.doesNotMatch(rendered.html, /Forged|\/media\/b.png|My &lt;site&gt;/);
    ctx.content.details.featuredImageId = "";
    assert.doesNotMatch(renderContentCanvas(defaultTheme(), ctx).html, /<img/);
  }
});

test("Site identity displays the admin logo, name, both, or the automatic fallback with appearance controls", () => {
  const identity = block("site_identity", "core/site-brand", {
    display: "logo-and-name",
    level: "span",
    logoHeight: 80,
    orientation: "vertical",
    gap: 16,
    linkHome: false,
    fontSize: 25,
  });
  const document = themeWith([identity]);
  const ctx = context();
  let rendered = renderTheme(document, ctx, "post-archive").html;
  assert.match(rendered, /theme-site-logo/);
  assert.match(rendered, /height:80px/);
  assert.match(rendered, /flex-direction:column;gap:16px/);
  assert.match(
    rendered,
    /<span class="theme-site-name"[^>]*>My &lt;site&gt;<\/span>/,
  );
  assert.match(rendered, /font-size:25px/);
  assert.doesNotMatch(rendered, /href="\/"/);
  identity.settings.display = "name";
  assert.doesNotMatch(renderTheme(document, ctx, "post-archive").html, /<img/);
  identity.settings.display = "logo";
  assert.doesNotMatch(
    renderTheme(document, ctx, "post-archive").html,
    /theme-site-name/,
  );
  identity.settings.display = "auto";
  ctx.settings.logo = "";
  assert.match(
    renderTheme(document, ctx, "post-archive").html,
    /theme-site-name/,
  );
});

test("Site Identity falls back to the admin site icon in public and content canvases, while honoring logo and name modes", () => {
  const identity = block("site_icon_identity", "core/site-brand", {
    display: "logo",
  });
  const document = themeWith([identity]);
  const ctx = context();
  ctx.settings.logo = "";
  ctx.settings.siteIconId = "icon with spaces";
  ctx.content.details.contentBlocks = [identity];
  for (const html of [
    renderTheme(document, ctx, "post-archive").html,
    renderContentCanvas(defaultTheme(), ctx).html,
  ]) {
    assert.match(
      html,
      /class="theme-site-logo" src="\/api\/media\/icon%20with%20spaces\/file"/,
    );
    assert.doesNotMatch(html, /theme-site-name/);
  }
  ctx.settings.logo = "https://example.test/preferred.svg";
  assert.match(
    renderTheme(document, ctx, "post-archive").html,
    /src="https:\/\/example.test\/preferred.svg"/,
  );
  ctx.settings.logo = "";
  identity.settings.display = "name";
  assert.doesNotMatch(
    renderTheme(document, ctx, "post-archive").html,
    /theme-site-logo/,
  );
  identity.settings.display = "auto";
  assert.match(
    renderTheme(document, ctx, "post-archive").html,
    /theme-site-logo/,
  );
  ctx.settings.siteIconId = "";
  assert.match(
    renderTheme(document, ctx, "post-archive").html,
    /theme-site-name/,
  );
  identity.settings.display = "logo";
  assert.doesNotMatch(
    renderTheme(document, ctx, "post-archive").html,
    /theme-site-logo|cl-editor-block-placeholder/,
  );
});

test("post lists repeat authored layouts with each result's data, unique DOM identities and a single nested pager", () => {
  const document = themeWith([nestedList()]);
  const ctx = context();
  const rendered = renderTheme(document, ctx, "post-archive");
  assert.equal(
    (rendered.html.match(/class="theme-content-title"/g) || []).length,
    2,
  );
  for (const id of ["a", "b"]) {
    assert.match(rendered.html, new RegExp("Story " + id));
    assert.match(rendered.html, new RegExp("/media/" + id + ".png"));
    assert.match(rendered.html, new RegExp("/2026/10/story-" + id));
  }
  assert.doesNotMatch(
    rendered.html,
    /Outer page|Outer summary|Story c|Story other/,
  );
  assert.equal((rendered.html.match(/One two…/g) || []).length, 2);
  assert.equal(
    (rendered.html.match(/class="theme-pagination"/g) || []).length,
    1,
  );
  assert.match(rendered.html, /Page 1 of 2/);
  assert.match(rendered.html, /href="\/stories\?page=2"/);
  assert.match(rendered.html, /authored-pager/);
  const ids = [...rendered.html.matchAll(/ data-block-id="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(new Set(ids).size, ids.length);
  const anchors = [...rendered.html.matchAll(/ id="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(new Set(anchors).size, anchors.length);
  assert.equal(
    (rendered.html.match(/data-source-block-id="blk_result_title"/g) || [])
      .length,
    2,
  );
  ctx.page = 2;
  const second = renderTheme(document, ctx, "post-archive").html;
  assert.match(second, /Story c|Page 2 of 2/);
  assert.doesNotMatch(second, /Story a|Story b/);
});

test("search pagination uses the search query and each list owns its own page count", () => {
  const first = nestedList();
  const second = structuredClone(first);
  const rename = (node) => {
    node.id += "_other";
    node.children?.forEach(rename);
  };
  rename(second);
  second.settings.category = "other";
  const document = themeWith([first, second]);
  const html = renderTheme(document, context(), "post-archive").html;
  assert.equal((html.match(/class="theme-pagination"/g) || []).length, 1);
  const ctx = context();
  ctx.kind = "search";
  ctx.query = "Story";
  ctx.path = "/search";
  document.templates.search.children = [first];
  const search = renderTheme(document, ctx, "search").html;
  assert.match(search, /\/search\?q=Story&amp;page=2/);
  assert.match(search, /Page 1 of 2/);
});

test("pagination placement is enforced in tree commands, theme validation and content validation", async () => {
  const pager = block("restricted_pager", "core/pagination");
  const list = nestedList();
  const root = container("restricted_root", [
    list,
    container("outside_group", []),
  ]);
  assert.equal(canPlacePagination(root, root, pager), false);
  assert.equal(canPlacePagination(root, list.children[0], pager), true);
  assert.equal(canPlacePagination(root, root, list), true);
  assert.throws(
    () =>
      applyOutlineCommand(
        structuredClone(root),
        { type: "move", id: "blk_pager_layout", parentId: root.id, index: 1 },
        definitions,
      ),
    /destination|Pagination/,
  );
  assert.throws(
    () =>
      applyOutlineCommand(
        structuredClone(root),
        {
          type: "insert",
          parentId: root.id,
          index: 0,
          blockType: "core/pagination",
        },
        definitions,
      ),
    /Pagination/,
  );
  const valid = structuredClone(root);
  applyOutlineCommand(
    valid,
    {
      type: "insert",
      parentId: "blk_result_card",
      index: 0,
      blockType: "core/pagination",
    },
    definitions,
  );
  assert.equal(
    valid.children[0].children[0].children[0].type,
    "core/pagination",
  );
  assert.throws(
    () => validateDocument(themeWith([container("bad_group", [pager])]), true),
    /Pagination/,
  );
  const db = { prepare: () => ({ first: async () => null }) };
  await assert.rejects(
    validateDetails(db, { contentBlocks: [container("bad_group", [pager])] }),
    /Pagination/,
  );
  await validateDetails(db, { contentBlocks: [list] });
});

test("old placeholders, flat result settings and sibling pagination migrate without replacing authored blocks", () => {
  const document = defaultTheme();
  document.templates.home.children = [
    block("old_title", "core/heading", {
      text: "{{content.title}}",
      level: "h1",
      fontSize: 41,
    }),
    block("old_list", "core/post-list", {
      showExcerpt: false,
      excerptLength: 7,
      showFeaturedImage: false,
      showDate: false,
      columns: 2,
    }),
    block("old_pager", "core/pagination", { style: "prev-next" }),
    block("authored_html", "core/rich-text", {
      html: "<p>Authored {{site.title}} story</p>",
    }),
  ];
  document.parts.header.children = [
    block("old_name", "core/heading", {
      text: "{{site.title}}",
      level: "h2",
      fontSize: 23,
    }),
  ];
  const migrated = migrateThemeDocument(document);
  const [title, list, authored] = migrated.templates.home.children;
  assert.equal(title.id, "blk_old_title");
  assert.equal(title.type, "core/title");
  assert.equal(title.settings.fontSize, 41);
  assert.equal(title.settings.text, undefined);
  assert.equal(list.id, "blk_old_list");
  assert.equal(list.settings.columns, 2);
  const excerpt = list.children.find((node) => node.type === "core/excerpt");
  assert.deepEqual(excerpt.settings, { showExcerpt: false, excerptLength: 7 });
  assert.equal(
    list.children.find((node) => node.type === "core/featured-image").settings
      .showImage,
    false,
  );
  assert.equal(list.children.at(-1).id, "blk_old_pager");
  assert.equal(authored.id, "blk_authored_html");
  assert.equal(migrated.parts.header.children[0].type, "core/site-brand");
  assert.equal(migrated.parts.header.children[0].settings.fontSize, 23);
  assert.equal(migrated.compiled, undefined);
  assert.equal(normalizeContextDocument(migrated), false);
  assert.doesNotThrow(() => validateDocument(migrated, true));
  assert.equal(document.templates.home.children[0].type, "core/heading");
});

test("the context-block upgrade persists published and draft layouts once with a fresh revision", async () => {
  const DB = localDatabase();
  try {
    await ensureThemes(DB);
    const document = defaultTheme();
    document.manifest.id = "test.context.migration";
    document.manifest.isCore = false;
    document.templates.home.children = [
      block("old_title", "core/heading", {
        text: "{{content.title}}",
        level: "h1",
      }),
    ];
    const draft = structuredClone(document);
    draft.css += ".custom-author-style{color:#123456}";
    draft.templates.home.children.push(
      block("old_list", "core/post-list", { excerptLength: 9 }),
    );
    await DB.prepare(
      "INSERT INTO themes(id,manifest,published,draft,active,is_core,revision,updated_at) VALUES(?,?,?,?,0,0,4,?)",
    )
      .bind(
        document.manifest.id,
        JSON.stringify(document.manifest),
        JSON.stringify(document),
        JSON.stringify(draft),
        "2026-10-08",
      )
      .run();
    await DB.prepare(
      "DELETE FROM config WHERE id='theme-context-blocks-v1'",
    ).run();
    await ensureThemes(DB);
    const saved = await DB.prepare("SELECT * FROM themes WHERE id=?")
      .bind(document.manifest.id)
      .first();
    assert.equal(saved.revision, 5);
    for (const value of [saved.published, saved.draft]) {
      const snapshot = JSON.parse(value);
      assert.equal(snapshot.templates.home.children[0].type, "core/title");
      assert.doesNotMatch(snapshot.compiled.home, /content.title/);
    }
    assert.match(JSON.parse(saved.draft).css, /custom-author-style/);
    await ensureThemes(DB);
    assert.equal(
      (
        await DB.prepare("SELECT revision FROM themes WHERE id=?")
          .bind(document.manifest.id)
          .first()
      ).revision,
      5,
    );
  } finally {
    DB.close();
  }
});

test("new invalid pagination is rejected by draft HTTP saves instead of being silently migrated", async () => {
  const DB = localDatabase();
  const call = (path, method = "GET", body) =>
    worker.fetch(
      new Request("https://cms.test/api" + path, {
        method,
        headers: {
          Origin: "https://cms.test",
          "Content-Type": "application/json",
          "oai-authenticated-user-id": "context-owner",
          "oai-authenticated-user-email": "context@example.test",
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      { DB },
    );
  try {
    await call("/admin/setup", "POST", {});
    const core = await (
      await call("/themes/com.colossal.theme.default")
    ).json();
    const clone = await (
      await call("/themes/" + core.id + "/clone", "POST", {
        revision: core.revision,
        name: "Context HTTP fixture",
      })
    ).json();
    const record = await (await call("/themes/" + clone.id)).json();
    const document = defaultTheme();
    document.manifest.id = clone.id;
    document.manifest.isCore = false;
    document.templates.home.children.push(
      block("bad_pager", "core/pagination"),
    );
    const response = await call("/themes/" + clone.id + "/draft", "PUT", {
      revision: record.revision,
      document,
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Pagination/);
    assert.equal(
      (await (await call("/themes/" + clone.id)).json()).draft,
      null,
    );
  } finally {
    DB.close();
  }
});
