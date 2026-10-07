import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import {
  defaultTheme,
  validateDocument,
  renderTheme,
  CORE_THEME_ID,
} from "../server/theme-engine.mjs";
import { publicHtml } from "../server/public-html.mjs";
import { initialPublicRender } from "../shared/public-render.ts";
import { DEFAULT_THEME_LOADING } from "../shared/theme-loading.ts";
import { colossal2027Theme } from "../server/colossal-2027.mjs";
import { migrateThemeDocument } from "../server/theme-migrations.mjs";

const shell =
  '<!doctype html><html><head><title>Static title</title><meta name="description" content="Static description"><link rel="icon" href="/favicon.svg"></head><body><cl-frontend></cl-frontend><script type="module" src="/main.js"></script></body></html>';
const owner = {
  "oai-authenticated-user-id": "loading-owner",
  "oai-authenticated-user-email": "loading@example.test",
};
const payload = (html) =>
  JSON.parse(
    html.match(
      /<script type="application\/json" id="theme-render">([\s\S]*?)<\/script>/,
    )[1],
  );
async function fixture() {
  const DB = localDatabase();
  const env = {
    DB,
    ASSETS: {
      fetch: async (request) =>
        new Response(
          new URL(request.url).pathname.endsWith("index.html")
            ? shell
            : "Static asset",
          {
            headers: {
              "Content-Type": "text/html",
              ETag: "static",
              "Content-Length": "123",
            },
          },
        ),
    },
  };
  const call = (path, method = "GET", body, identity = {}) =>
    worker.fetch(
      new Request("https://cms.test" + path, {
        method,
        headers: {
          Origin: "https://cms.test",
          "Content-Type": "application/json",
          ...identity,
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
  assert.equal((await call("/api/admin/setup", "POST", {}, owner)).status, 200);
  return { DB, env, call };
}

test("loading appearance accepts safe presentation values, rejects executable values, and supports old themes", () => {
  const doc = defaultTheme();
  for (const invalid of [
    null,
    [],
    "dark",
    { background: "url(javascript:alert(1))" },
    { color: "#12345" },
    { animation: "spin" },
    { script: "alert(1)" },
  ]) {
    doc.manifest.loading = invalid;
    assert.throws(() => validateDocument(doc, true), /loading settings/);
  }
  delete doc.manifest.loading;
  validateDocument(doc, true);
  const ctx = {
    kind: "home",
    settings: { title: "Site", tagline: "Hello" },
    media: [],
    plugins: [],
    allContent: [],
  };
  assert.deepEqual(renderTheme(doc, ctx).loading, DEFAULT_THEME_LOADING);
  doc.templates.home.settings.background = "#101426";
  doc.templates.home.settings.color = "#ffffff";
  assert.equal(renderTheme(doc, ctx).loading.background, "#101426");
  doc.manifest.loading = {
    background: "#17191bc9",
    accent: "#abc",
    animation: "none",
  };
  assert.equal(
    renderTheme(validateDocument(doc, true), ctx).loading.background,
    "#17191bc9",
  );
});

test("public documents render published content, theme styles, metadata and announcements before JavaScript", async () => {
  const { DB, call } = await fixture();
  try {
    const created = await (
      await call(
        "/api/admin/content",
        "POST",
        {
          kind: "page",
          title: "Server rendered page",
          slug: "rendered",
          body: "Visible before JavaScript",
          status: "published",
          excerpt: "Description before JavaScript",
        },
        owner,
      )
    ).json();
    await call(
      "/api/admin/content",
      "POST",
      {
        kind: "page",
        title: "PRIVATE DRAFT MARKER",
        slug: "private-draft",
        body: "PRIVATE BODY MARKER",
        status: "draft",
      },
      owner,
    );
    const config = JSON.parse(
      (await DB.prepare("SELECT value FROM config WHERE id='site'").first())
        .value,
    );
    config.announcement = "An announcement <script>bad()</script>";
    config.siteIconId = "published-icon";
    await DB.prepare("UPDATE config SET value=? WHERE id='site'")
      .bind(JSON.stringify(config))
      .run();
    await DB.prepare(
      "UPDATE plugins SET active=1 WHERE id='com.colossal.announcement'",
    ).run();
    const response = await call("/rendered?path=/private-draft");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("ETag"), null);
    assert.equal(response.headers.get("Content-Length"), null);
    const html = await response.text();
    const initial = payload(html);
    assert.match(initial.html, /Visible before JavaScript/);
    assert.match(
      html,
      /<cl-frontend>[\s\S]*Visible before JavaScript[\s\S]*<\/cl-frontend>/,
    );
    assert.match(html, /id="theme-styles"/);
    assert.match(
      html,
      /<title>Server rendered page · Colossal Journal<\/title>/,
    );
    assert.match(html, /--cl-loading-background:#f7f9f3/);
    assert.match(html, /data-theme-template="default"/);
    assert.match(
      html,
      /<meta name="description" content="Description before JavaScript">/,
    );
    assert.match(html, /rel="icon" href="\/api\/media\/published-icon\/file"/);
    assert.match(html, /An announcement &lt;script&gt;bad\(\)&lt;\/script&gt;/);
    assert.doesNotMatch(
      html,
      /<script>bad\(\)<\/script>|PRIVATE DRAFT MARKER|PRIVATE BODY MARKER/,
    );
    assert.ok(created.id);
  } finally {
    DB.close();
  }
});

test("initial document and render API share search, route resolution and 404 semantics; HEAD has no body", async () => {
  const { DB, call } = await fixture();
  try {
    for (const path of [
      "/",
      "/index.html",
      "/search?q=curiosity&page=2",
      "/missing-page",
    ]) {
      const response = await call(path);
      const rendered = payload(await response.text());
      const url = new URL(path, "https://cms.test");
      url.searchParams.set(
        "path",
        url.pathname === "/index.html" ? "/" : url.pathname,
      );
      const api = await (
        await call("/api/themes/render?" + url.searchParams)
      ).json();
      assert.equal(rendered.html, api.html);
      assert.equal(rendered.css, api.css);
      assert.equal(response.status, api.status);
      const head = await call(path, "HEAD");
      assert.equal(head.status, response.status);
      assert.equal(await head.text(), "");
      assert.equal(head.headers.get("Cache-Control"), "no-store");
    }
    assert.equal((await call("/?themePreview=forged")).status, 401);
    const admin = await call("/admin/", "GET", undefined, owner);
    assert.equal(await admin.text(), shell);
    assert.equal(await (await call("/main.js")).text(), "Static asset");
  } finally {
    DB.close();
  }
});

test("signed previews embed the selected draft while ordinary documents never expose it", async () => {
  const { DB, call } = await fixture();
  try {
    const record = await DB.prepare("SELECT * FROM themes WHERE id=?")
      .bind(CORE_THEME_ID)
      .first();
    const draft = JSON.parse(record.published);
    draft.templates["post-archive"].children[1].children.unshift({
      id: "preview-marker",
      type: "core/heading",
      settings: { text: "PRIVATE THEME DRAFT", level: "h2" },
    });
    await DB.prepare("UPDATE themes SET draft=? WHERE id=?")
      .bind(JSON.stringify(draft), CORE_THEME_ID)
      .run();
    assert.doesNotMatch(await (await call("/")).text(), /PRIVATE THEME DRAFT/);
    const preview = await (
      await call("/api/themes/" + CORE_THEME_ID + "/preview", "POST", {}, owner)
    ).json();
    const response = await call(preview.url);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    const html = await response.text();
    assert.match(html, /PRIVATE THEME DRAFT/);
    assert.match(html, /Theme preview ·/);
    assert.equal(payload(html).preview, true);
    assert.equal(payload(html).adsEnabled, false);
    await DB.prepare("UPDATE themes SET revision=revision+1 WHERE id=?")
      .bind(CORE_THEME_ID)
      .run();
    assert.equal((await call(preview.url)).status, 410);
  } finally {
    DB.close();
  }
});

test("a provider failure returns a usable CMS retry page without credentials or a stuck skeleton", async () => {
  const { DB, env } = await fixture();
  try {
    env.DB = {
      prepare: () => {
        throw new Error("SECRET mongodb://password@private-host");
      },
    };
    const response = await worker.fetch(new Request("https://cms.test/"), env);
    assert.equal(response.status, 503);
    assert.match(response.headers.get("Content-Type"), /text\/html/);
    const html = await response.text();
    assert.match(html, /We’ll be right back/);
    assert.match(html, /Try again/);
    assert.doesNotMatch(
      html,
      /SECRET|password|private-host|class="public-skeleton"/,
    );
    assert.equal(payload(html).status, 503);
  } finally {
    DB.close();
  }
});

test("startup payload cannot break out of JSON, CSS, metadata, or body attributes", () => {
  const render = {
    html: "<h1>Safe markup</h1>",
    css: "/* </style><script>bad()</script> */",
    title: "</title><script>bad()</script>",
    description: '" onload="bad()',
    body: { className: '" onload="bad()', style: "", themeId: "test.theme" },
  };
  const html = publicHtml(shell, render);
  const data = payload(html);
  assert.deepEqual(data, render);
  assert.doesNotMatch(html, /<script>bad\(\)<\/script>/);
  assert.doesNotMatch(html, /class="" onload="bad\(\)"/);
  assert.equal((html.match(/name="description"/g) || []).length, 1);
  const doc = {
    getElementById: (id) =>
      id === "theme-render" ? { textContent: JSON.stringify(data) } : null,
  };
  assert.deepEqual(initialPublicRender(doc), render);
  assert.equal(
    initialPublicRender({
      getElementById: () => ({ textContent: "bad JSON" }),
    }),
    null,
  );
  assert.equal(
    initialPublicRender({
      getElementById: () => ({ textContent: '{"html":"<p>incomplete</p>"}' }),
    }),
    null,
  );
  assert.match(html, /<noscript><style>[\s\S]*opacity:1/);
});

test("Colossal 2027 receives a dark loading profile while revision-7 artwork settings and custom profiles survive", () => {
  const doc = colossal2027Theme();
  doc.manifest.bundledRevision = 7;
  delete doc.manifest.loading;
  const scene = doc.templates.home.children
    .find((b) => b.settings?.classes?.includes("c27-hero"))
    .children.find((b) => b.settings?.classes?.includes("c27-hero-art"))
    .children[0];
  scene.settings.sceneRainWidth = 0.75;
  const before = structuredClone(doc.templates);
  const upgraded = migrateThemeDocument(doc);
  assert.equal(upgraded.manifest.bundledRevision, 8);
  assert.equal(upgraded.manifest.loading.background, "#0c0d10");
  assert.deepEqual(upgraded.templates, before);
  doc.manifest.loading = { background: "#123456", animation: "none" };
  assert.deepEqual(
    migrateThemeDocument(doc).manifest.loading,
    doc.manifest.loading,
  );
  assert.deepEqual(migrateThemeDocument(upgraded), upgraded);
});
