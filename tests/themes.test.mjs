import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { zipSync, unzipSync, strToU8 } from "fflate";
import semver from "semver";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import {
  defaultTheme,
  validateDocument,
  validateThemeManifest,
  resolveTemplateForContent,
  sanitizeTemplate,
  sanitizeCss,
  renderTheme,
  minHeightCss,
  CORE_THEME_ID,
} from "../server/theme-engine.mjs";
const DB = localDatabase(),
  blobs = new Map();
const env = {
  DB,
  STORAGE: {
    put: async (k, b) => blobs.set(k, new Uint8Array(b)),
    get: async (k) =>
      blobs.has(k)
        ? {
            body: blobs.get(k),
            arrayBuffer: async () => blobs.get(k).slice().buffer,
          }
        : null,
    delete: async (keys) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) blobs.delete(k);
    },
  },
  ASSETS: { fetch: async () => new Response("asset") },
};
const owner = {
  "oai-authenticated-user-id": "theme-owner",
  "oai-authenticated-user-email": "themes@example.test",
};
async function request(path, method = "GET", body, headers = owner) {
  return worker.fetch(
    new Request("https://cms.test/api" + path, {
      method,
      headers: {
        ...headers,
        Origin: "https://cms.test",
        ...(body && !(body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    }),
    env,
  );
}
async function call(...args) {
  const r = await request(...args);
  return { status: r.status, data: await r.json() };
}
function archive(id = "test.colossal.theme", modify = () => {}) {
  const d = defaultTheme();
  d.manifest.id = id;
  d.manifest.isCore = false;
  d.manifest.name = "Theme integration";
  modify(d);
  const files = {
    "theme.manifest.json": strToU8(JSON.stringify(d.manifest)),
    "theme.draft.json": strToU8(JSON.stringify(d)),
  };
  for (const t of d.manifest.templates)
    files[t.file] = strToU8("<h1>Imported</h1>");
  for (const p of Object.values(d.manifest.parts))
    files[p] = strToU8("<p>Shared</p>");
  for (const b of d.manifest.blocks) files[b.file] = strToU8("<div></div>");
  for (const p of d.manifest.assets.styles) files[p] = strToU8(d.css);
  for (const p of d.manifest.assets.scripts)
    files[p] = strToU8('throw new Error("never run")');
  return { d, files };
}
function upload(files) {
  const f = new FormData();
  f.set(
    "file",
    new File([zipSync(files)], "theme.zip", { type: "application/zip" }),
  );
  return f;
}
before(async () =>
  assert.equal((await call("/admin/setup", "POST", {})).status, 200),
);
after(() => DB.close());

test("theme resolution uses explicit, type, global, then safe core fallback", () => {
  const d = defaultTheme();
  assert.equal(
    resolveTemplateForContent(d, "page", "full-width").source,
    "content",
  );
  assert.equal(
    resolveTemplateForContent(d, "post", "full-width").template.id,
    "post-single",
  );
  assert.equal(
    resolveTemplateForContent(d, "page", "missing").template.id,
    "default",
  );
  assert.match(
    resolveTemplateForContent(d, "page", "missing").warning,
    /unavailable/,
  );
  d.templates = {};
  assert.equal(resolveTemplateForContent(d, "page", "").source, "core");
  const rendered = renderTheme(d, {
    kind: "page",
    content: { title: "Fallback", body: "Still visible" },
    settings: {},
    allContent: [],
    media: [],
  });
  assert.match(rendered.html, /Still visible/);
});
test("manifest validation rejects missing defaults, duplicate types, invalid assets, paths and versions", () => {
  for (const mutate of [
    (d) => d.templates.forEach((t) => (t.isDefault = false)),
    (d) => (d.templates.find((t) => !t.isDefault).isDefault = true),
    (d) => (d.assets.styles = "bad"),
    (d) => (d.templates[0].file = "../escape.html"),
    (d) => (d.requires.colossal = ">=99"),
    (d) => (d.parts.bad = "bad.html"),
  ]) {
    const m = structuredClone(defaultTheme().manifest);
    mutate(m);
    assert.throws(() => validateThemeManifest(m, null, true));
  }
});
test("sanitization removes executable HTML and external CSS while retaining content", () => {
  const html = sanitizeTemplate(
    '<h1 onclick="alert(1)">Hello</h1><script>bad()</script><iframe src="https://bad.test"></iframe><a href="javascript:bad()">link</a><img src="x" onerror="bad()">',
  );
  assert.match(html, /Hello/);
  assert.doesNotMatch(html, /onclick|onerror|javascript:|<script|<iframe/);
  const css = sanitizeCss(
    '@import "https://bad.test/x";body{color:#123456;background:url(https://bad.test/track);position:fixed}',
  );
  assert.match(css, /.theme-root/);
  assert.match(css, /color:#123456/);
  assert.doesNotMatch(css, /bad.test|position|@import/);
});
test("tree validation rejects excessive nesting but accepts reordered shared parts", () => {
  const d = defaultTheme();
  let node = d.templates.default.children[1];
  for (let i = 0; i < 9; i++) {
    const child = {
      id: crypto.randomUUID(),
      type: "core/container",
      settings: {},
      children: [],
    };
    node.children = [child];
    node = child;
  }
  assert.throws(() => validateDocument(d, true), /depth/);
  const moved = defaultTheme();
  moved.templates.default.children.reverse();
  const reordered = validateDocument(moved, true);
  assert.equal(
    reordered.templates.default.children[0].type,
    "theme/part-footer",
  );
  assert.equal(
    reordered.templates.default.children.at(-1).type,
    "theme/part-header",
  );
  const bad = defaultTheme();
  bad.templates.default.children[1].children.push({
    id: "unknown",
    type: "bad/code",
    settings: {},
  });
  assert.throws(() => validateDocument(bad, true), /Invalid block/);
});
test("grouped navigation includes the locked Themes plugin in system", async () => {
  const state = (await call("/admin/state")).data;
  const main = state.plugins
    .filter((p) => p.isCore && p.admin.menu.group === "main")
    .map((p) => p.admin.menu.label);
  assert.deepEqual(main, ["Dashboard", "Media", "Posts", "Pages", "Settings"]);
  assert.deepEqual(
    state.plugins
      .filter((p) => p.isCore && p.admin.menu.group === "system")
      .map((p) => p.admin.menu.label),
    ["Themes", "Plugins", "Connections"],
  );
  assert.equal(
    (await call("/themes/" + CORE_THEME_ID, "DELETE", {})).status,
    403,
  );
});
test("ZIP themes install inactive, sanitize scripts, and reject invalid archives", async () => {
  const { files } = archive(
    undefined,
    (d) => (d.manifest.assets.scripts = ["assets/main.js"]),
  );
  files["templates/default.html"] = strToU8(
    '<script>bad()</script><h1 onclick="bad()">Kept</h1>',
  );
  const installed = await call("/themes/install", "POST", upload(files));
  assert.equal(installed.status, 201, JSON.stringify(installed.data));
  assert.ok(installed.data.report.some((x) => x.includes("scripts removed")));
  const record = (await call("/themes/test.colossal.theme")).data;
  assert.equal(record.active, false);
  assert.deepEqual(record.published.manifest.assets.scripts, []);
  assert.equal(
    (await call("/themes/install", "POST", upload(files))).status,
    409,
  );
  const broken = archive("test.colossal.broken").files;
  delete broken["templates/default.html"];
  assert.equal(
    (await call("/themes/install", "POST", upload(broken))).status,
    400,
  );
  const unsafe = archive("test.colossal.unsafe").files;
  unsafe["../escape"] = strToU8("x");
  assert.equal(
    (await call("/themes/install", "POST", upload(unsafe))).status,
    400,
  );
});
test("drafts stay private, tokens bind revision, publishing bumps version, and restore/export round trip", async () => {
  const id = "test.colossal.theme",
    url = "/themes/" + id;
  let r = (await call(url)).data;
  const d = structuredClone(r.published);
  d.templates["post-archive"].children[1].children[0].settings.text =
    "Theme draft headline";
  assert.equal(
    (await call(url + "/draft", "PUT", { document: d, revision: r.revision }))
      .status,
    200,
  );
  assert.equal(
    (await call(url + "/draft", "PUT", { document: d, revision: r.revision }))
      .status,
    409,
  );
  assert.doesNotMatch(
    (await call("/themes/render?path=/", "GET", undefined, {})).data.html,
    /Theme draft headline/,
  );
  let link = (await call(url + "/preview", "POST", {})).data.url;
  let token = new URL(link, "https://cms.test").searchParams.get(
    "themePreview",
  );
  assert.match(
    (
      await call(
        "/themes/render?path=/&themePreview=" + token,
        "GET",
        undefined,
        {},
      )
    ).data.html,
    /Theme draft headline/,
  );
  assert.equal(
    (
      await call(
        "/themes/render?themePreview=" + token + "x",
        "GET",
        undefined,
        {},
      )
    ).status,
    401,
  );
  r = (await call(url)).data;
  assert.equal(
    (await call(url + "/publish", "POST", { revision: r.revision })).data
      .version,
    semver.inc(r.version, "patch"),
  );
  assert.equal(
    (await call("/themes/render?themePreview=" + token, "GET", undefined, {}))
      .status,
    410,
  );
  r = (await call(url)).data;
  assert.equal(r.history.length, 1);
  assert.equal(
    (await call(url + "/activate", "POST", { revision: r.revision })).status,
    200,
  );
  assert.match(
    (await call("/themes/render?path=/", "GET", undefined, {})).data.html,
    /Theme draft headline/,
  );
  assert.equal(
    (
      await call(url + "/restore", "POST", {
        revision: r.revision,
        historyId: r.history[0].id,
      })
    ).status,
    200,
  );
  r = (await call(url)).data;
  assert.ok(r.draft);
  assert.doesNotMatch(r.draft.compiled["post-archive"], /Theme draft headline/);
  assert.match(
    (await call("/themes/render?path=/", "GET", undefined, {})).data.html,
    /Theme draft headline/,
  );
  const exported = await request("/themes/" + CORE_THEME_ID + "/export");
  assert.equal(exported.status, 200);
  const files = unzipSync(new Uint8Array(await exported.arrayBuffer()));
  assert.ok(files["theme.draft.json"]);
  assert.equal(
    (await call("/themes/install", "POST", upload(files))).status,
    201,
  );
});
test("content template overrides persist and switching reports non-destructive fallbacks", async () => {
  const entry = {
    kind: "page",
    title: "Template choice",
    slug: "template-choice",
    body: "Visible text",
    excerpt: "",
    status: "published",
    templateId: "full-width",
  };
  const saved = await call("/admin/content", "POST", entry);
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  assert.equal(
    (await call("/themes/render?path=/template-choice", "GET", undefined, {}))
      .data.templateId,
    "full-width",
  );
  const { files } = archive("test.colossal.minimal", (d) => {
    d.manifest.templates = d.manifest.templates.filter(
      (t) => t.id === "default",
    );
    d.templates = { default: d.templates.default };
  });
  assert.equal(
    (await call("/themes/install", "POST", upload(files))).status,
    201,
  );
  const active = await call("/themes/test.colossal.minimal/activate", "POST", {
    revision: 1,
  });
  assert.ok(active.data.fallbacks.some((c) => c.id === saved.data.id));
  assert.equal(
    (await call("/themes/render?path=/template-choice", "GET", undefined, {}))
      .data.templateId,
    "default",
  );
  const persisted = (await call("/admin/state")).data.content.find(
    (c) => c.id === saved.data.id,
  );
  assert.equal(persisted.templateId, "full-width");
  assert.equal(
    (
      await call("/admin/content", "POST", {
        ...persisted,
        title: "Still editable",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/admin/content", "POST", {
        ...entry,
        slug: "invalid-template",
        templateId: "absent",
      })
    ).status,
    400,
  );
});
test("theme media references protect files and previews authorize only referenced media", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=",
    "base64",
  );
  const form = new FormData();
  form.set("file", new File([png], "pixel.png", { type: "image/png" }));
  form.set("altText", "Theme pixel");
  const media = (await call("/media", "POST", form)).data;
  assert.ok(media.id, JSON.stringify(media));
  const url = "/themes/" + CORE_THEME_ID;
  const record = (await call(url)).data;
  record.published.templates.default.children[1].children.push({
    id: "image-test",
    type: "core/image",
    settings: { mediaId: media.id },
  });
  assert.equal(
    (
      await call(url + "/draft", "PUT", {
        revision: record.revision,
        document: record.published,
      })
    ).status,
    200,
  );
  assert.equal((await call("/media/" + media.id, "DELETE", {})).status, 409);
  assert.equal(
    (await request("/media/" + media.id + "/file", "GET", undefined, {}))
      .status,
    401,
  );
  const link = (await call(url + "/preview", "POST", {})).data.url;
  const token = new URL(link, "https://cms.test").searchParams.get(
    "themePreview",
  );
  assert.equal(
    (
      await request(
        "/media/" + media.id + "/file?themePreview=" + token,
        "GET",
        undefined,
        {},
      )
    ).status,
    200,
  );
});
test("editors and anonymous callers cannot mutate themes", async () => {
  await DB.prepare(
    "INSERT INTO members (email,role,id) VALUES ('editor@themes.test','editor',?)",
  )
    .bind(new Date().toISOString())
    .run();
  const editor = {
    "oai-authenticated-user-id": "ed",
    "oai-authenticated-user-email": "editor@themes.test",
  };
  assert.equal((await call("/themes", "GET", undefined, editor)).status, 200);
  assert.equal(
    (
      await call(
        "/themes/" + CORE_THEME_ID + "/activate",
        "POST",
        { revision: 1 },
        editor,
      )
    ).status,
    403,
  );
  assert.equal((await call("/themes", "GET", undefined, {})).status, 401);
});

test("shared parts and declarative custom block fields compile safely in every template", () => {
  const d = defaultTheme();
  d.parts.header.children = [
    {
      id: "shared-title",
      type: "core/heading",
      settings: { text: "Shared header" },
    },
  ];
  d.blocks.push({
    type: "example/callout",
    label: "Callout",
    category: "Plugin",
    fields: [{ key: "message", type: "text" }],
    template: '<aside onclick="bad()">{{setting.message}}</aside>',
  });
  d.templates.default.children[1].children.push({
    id: "callout",
    type: "example/callout",
    settings: { message: "<script>bad()</script>" },
  });
  const compiled = validateDocument(d, true);
  assert.match(compiled.compiled.default, /Shared header/);
  assert.match(compiled.compiled["post-single"], /Shared header/);
  assert.doesNotMatch(compiled.compiled.default, /<script|onclick/);
  assert.match(compiled.compiled.default, /&lt;script&gt;/);
});
test("theme archive compression bombs are rejected before registration", async () => {
  const { files } = archive("test.colossal.bomb");
  files["assets/bomb.txt"] = strToU8("x".repeat(2 * 1024 * 1024));
  assert.equal(
    (await call("/themes/install", "POST", upload(files))).status,
    400,
  );
  assert.equal((await call("/themes/test.colossal.bomb")).status, 404);
});
test("cloning and exporting preserve independent ownership of theme assets", async () => {
  const { files } = archive("test.colossal.assets");
  delete files["theme.draft.json"];
  files["templates/default.html"] = strToU8(
    '<h1>Asset theme</h1><img src="assets/pixel.png" alt="Portable pixel">',
  );
  files["assets/pixel.png"] = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=",
    "base64",
  );
  assert.equal(
    (await call("/themes/install", "POST", upload(files))).status,
    201,
  );
  const clone = (
    await call("/themes/test.colossal.assets/clone", "POST", {
      revision: 1,
      name: "Independent",
    })
  ).data;
  assert.ok(clone.id);
  const source = (await call("/themes/test.colossal.assets")).data,
    copy = (await call("/themes/" + clone.id)).data;
  assert.notEqual(
    source.published.assets["assets/pixel.png"].key,
    copy.published.assets["assets/pixel.png"].key,
  );
  const preview = (await call("/themes/" + clone.id + "/preview", "POST", {}))
    .data.url;
  const token = new URL(preview, "https://cms.test").searchParams.get(
    "themePreview",
  );
  const r = (
    await call(
      "/themes/render?path=/about&themePreview=" + token,
      "GET",
      undefined,
      {},
    )
  ).data;
  assert.ok(
    r.html.includes(
      "/api/themes/" + clone.id + "/assets/assets/pixel.png?themePreview=",
    ),
  );
  assert.equal(
    (
      await request(
        "/themes/" +
          clone.id +
          "/assets/assets/pixel.png?themePreview=" +
          token,
        "GET",
        undefined,
        {},
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("/themes/test.colossal.assets", "DELETE", {})).status,
    200,
  );
  assert.equal(
    (await request("/themes/" + clone.id + "/assets/assets/pixel.png", "GET"))
      .status,
    200,
  );
  const exportFiles = unzipSync(
    new Uint8Array(
      await (await request("/themes/" + clone.id + "/export")).arrayBuffer(),
    ),
  );
  const m = JSON.parse(
    new TextDecoder().decode(exportFiles["theme.manifest.json"]),
  );
  m.id = "test.colossal.reimport";
  exportFiles["theme.manifest.json"] = strToU8(JSON.stringify(m));
  assert.equal(
    (await call("/themes/install", "POST", upload(exportFiles))).status,
    201,
  );
  const link = (
    await call("/themes/test.colossal.reimport/preview", "POST", {})
  ).data.url;
  const reToken = new URL(link, "https://cms.test").searchParams.get(
    "themePreview",
  );
  assert.ok(
    (
      await call(
        "/themes/render?path=/about&themePreview=" + reToken,
        "GET",
        undefined,
        {},
      )
    ).data.html.includes("/api/themes/test.colossal.reimport/assets/"),
  );
});
test("expired preview tokens are rejected and simultaneous draft writes cannot overwrite", async () => {
  const id = "test.colossal.minimal",
    row = (await call("/themes/" + id)).data;
  const token = new URL(
    (await call("/themes/" + id + "/preview", "POST", {})).data.url,
    "https://cms.test",
  ).searchParams.get("themePreview");
  const original = Date.now;
  try {
    Date.now = () => original() + 16 * 60000;
    assert.equal(
      (await call("/themes/render?themePreview=" + token, "GET", undefined, {}))
        .status,
      401,
    );
  } finally {
    Date.now = original;
  }
  const results = await Promise.all([
    call("/themes/" + id + "/draft", "PUT", {
      revision: row.revision,
      document: row.published,
    }),
    call("/themes/" + id + "/draft", "PUT", {
      revision: row.revision,
      document: row.published,
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});

test("manifest validation requires a unique icon on every block", () => {
  const missing = structuredClone(defaultTheme().manifest);
  delete missing.blocks[0].icon;
  assert.throws(() => validateThemeManifest(missing, null, true), /icon/);
  const duplicate = structuredClone(defaultTheme().manifest);
  duplicate.blocks[1].icon = duplicate.blocks[0].icon;
  assert.throws(() => validateThemeManifest(duplicate, null, true), /unique/);
});

test("container min height compiles to breakpoint-aware CSS", () => {
  const css = minHeightCss("blk_hero", {
    minHeightEnabled: true,
    minHeight: 480,
    minHeightUnit: "px",
    verticalAlign: "center",
    minHeightByBreakpoint: { desktop: 480, tablet: 360, mobile: null },
  });
  assert.match(css, /\[data-block-id="blk_hero"\]/);
  assert.match(css, /min-height:480px/);
  assert.match(css, /justify-content:center/);
  assert.match(css, /min-width:641px.*min-height:360px/s);
  assert.match(css, /max-width:640px.*min-height:auto/s);
  assert.equal(
    minHeightCss("blk_other", { minHeightEnabled: false, minHeight: 100 }),
    "",
  );
  const d = defaultTheme();
  d.templates.default.children[1].settings.minHeightEnabled = true;
  d.templates.default.children[1].settings.minHeight = 480;
  const rendered = renderTheme(validateDocument(d, true), {
    kind: "page",
    content: { title: "Hero", body: "" },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media: [],
  });
  assert.match(rendered.css, /min-height:480px/);
});

test("core plugins declare admin and frontend skeleton compositions", async () => {
  const state = (await call("/admin/state")).data;
  const posts = state.plugins.find((p) => p.id === "com.colossal.posts");
  assert.equal(posts.admin.skeleton.variant, "table");
  assert.equal(posts.admin.skeleton.component, "PostsListSkeletonComponent");
  assert.equal(posts.frontend.skeleton.variant, "grid");
  const media = state.plugins.find((p) => p.id === "com.colossal.media");
  assert.equal(media.admin.skeleton.component, "MediaLibrarySkeletonComponent");
});

test("direct navigation to a dotted theme ID serves the admin application shell", async () => {
  const r = await worker.fetch(
    new Request(
      "https://cms.test/admin/themes/edit/com.colossal.theme.default",
      { headers: owner },
    ),
    {
      ...env,
      ASSETS: {
        fetch: async (request) =>
          Response.json({ path: new URL(request.url).pathname }),
      },
    },
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).path, "/admin/index.html");
});

test("an editor opened before icon migration can render and save its unsaved core-block edits", async () => {
  const source = (await call("/themes/" + CORE_THEME_ID)).data;
  const cloned = (
    await call("/themes/" + CORE_THEME_ID + "/clone", "POST", {
      revision: source.revision,
      name: "Legacy editor",
    })
  ).data;
  const url = "/themes/" + cloned.id;
  const record = (await call(url)).data;
  const document = structuredClone(record.published);
  for (const b of document.manifest.blocks) delete b.icon;
  document.templates.default.children[1].settings.padding = { top: 73 };
  const render = await call(url + "/render", "POST", {
    document,
    templateId: "default",
  });
  assert.equal(render.status, 200);
  assert.match(render.data.html, /73px/);
  const save = await call(url + "/draft", "PUT", {
    document,
    revision: record.revision,
  });
  assert.equal(save.status, 200);
  const saved = (await call(url)).data;
  assert.equal(
    saved.draft.templates.default.children[1].settings.padding.top,
    73,
  );
  assert.ok(saved.draft.manifest.blocks.every((b) => b.icon));
  assert.deepEqual(saved.published, record.published);
  const bad = structuredClone(saved.draft);
  bad.manifest.blocks.push({
    type: "custom/missing",
    file: "blocks/missing.html",
  });
  assert.equal(
    (
      await call(url + "/draft", "PUT", {
        document: bad,
        revision: saved.revision,
      })
    ).status,
    400,
  );
});
