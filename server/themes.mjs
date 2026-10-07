import { zipSync, strToU8 } from "fflate";
import semver from "semver";
import { migrateThemeDocument } from "./theme-migrations.mjs";
import { COLOSSAL_2027_ID, colossal2027Theme } from "./colossal-2027.mjs";
import {
  isGlasseyTheme,
  migrateGlasseyManifest,
  migrateGlasseyDocument,
} from "./glassey-migration.mjs";
import { readAdSettings } from "./google-ads.mjs";
import definitions from "../shared/theme-blocks.json" with { type: "json" };
import { inspectZip } from "./plugin-installer.mjs";
import { inspectMedia } from "./media.mjs";
import {
  fail,
  json,
  now,
  all,
  parse,
  readJson,
  uploadForm,
  mediaRecord,
  published,
} from "./v2-utils.mjs";
import {
  CORE_THEME_ID,
  CMS_VERSION,
  defaultTheme,
  validateThemeManifest,
  validateDocument,
  sanitizeTemplate,
  sanitizeCss,
  htmlToTree,
  compileBlock,
  compileDocument,
  renderTheme,
  resolveTemplateForContent,
  themeMediaIds,
  contentPath,
  safePath,
} from "./theme-engine.mjs";
const dec = new TextDecoder();
const rowDoc = (r) => compileDocument(migrateThemeDocument(parse(r.published)));
async function ensureGlassey(db) {
  if (
    await db
      .prepare("SELECT id FROM config WHERE id='glassey-theme-v1'")
      .first()
  )
    return true;
  // Seed once so deleting the regular theme does not reinstall it on startup.
  if (
    !(await db
      .prepare("SELECT id FROM themes WHERE id=?")
      .bind(COLOSSAL_2027_ID)
      .first())
  ) {
    const d = colossal2027Theme();
    await db
      .prepare(
        "INSERT OR IGNORE INTO themes (id,manifest,published,draft,active,is_core,revision,updated_at) VALUES (?,?,?,NULL,0,0,1,?)",
      )
      .bind(d.manifest.id, JSON.stringify(d.manifest), JSON.stringify(d), now())
      .run();
  }
  const changes = [];
  for (const row of await all(db, "SELECT * FROM themes")) {
    if (!isGlasseyTheme(row.id)) continue;
    const manifest = migrateGlasseyManifest(parse(row.manifest));
    const published = parse(row.published);
    const draft = parse(row.draft, null);
    migrateGlasseyDocument(published);
    if (draft) migrateGlasseyDocument(draft);
    const values = [
      JSON.stringify(manifest),
      JSON.stringify(published),
      draft ? JSON.stringify(draft) : null,
    ];
    if (
      !row.is_core &&
      values[0] === row.manifest &&
      values[1] === row.published &&
      values[2] === row.draft
    )
      continue;
    changes.push(
      db
        .prepare(
          "UPDATE themes SET manifest=?,published=?,draft=?,is_core=0,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
        )
        .bind(...values, now(), row.id, row.revision),
    );
  }
  if (changes.length) {
    const results = await db.batch(changes);
    if (
      results.some(
        (result) => Number(result.meta?.changes ?? result.changes) !== 1,
      )
    )
      return false;
  }
  await db
    .prepare(
      "INSERT OR IGNORE INTO config (id,value) VALUES ('glassey-theme-v1','1')",
    )
    .run();
  return true;
}
export async function ensureThemes(db) {
  if (!(await ensureGlassey(db))) return;
  if (
    !(await db
      .prepare("SELECT id FROM themes WHERE id=?")
      .bind(CORE_THEME_ID)
      .first())
  ) {
    const d = defaultTheme();
    await db
      .prepare(
        "INSERT OR IGNORE INTO themes (id,manifest,published,draft,active,is_core,revision,updated_at) VALUES (?,?,?,NULL,1,1,1,?)",
      )
      .bind(d.manifest.id, JSON.stringify(d.manifest), JSON.stringify(d), now())
      .run();
  }
  if (
    await db
      .prepare("SELECT id FROM config WHERE id='theme-role-templates-v2'")
      .first()
  )
    return;
  const changes = [];
  for (const row of await all(db, "SELECT * FROM themes")) {
    const published = parse(row.published);
    const draft = parse(row.draft, null);
    const upgraded = migrateThemeDocument(published);
    const upgradedDraft = draft ? migrateThemeDocument(draft) : null;
    const changed = (before, after) =>
      JSON.stringify(before?.manifest) !== JSON.stringify(after?.manifest) ||
      JSON.stringify(before?.templates) !== JSON.stringify(after?.templates) ||
      JSON.stringify(before?.parts) !== JSON.stringify(after?.parts);
    if (!changed(published, upgraded) && !changed(draft, upgradedDraft))
      continue;
    compileDocument(upgraded);
    if (upgradedDraft) compileDocument(upgradedDraft);
    changes.push(
      db
        .prepare(
          "UPDATE themes SET manifest=?,published=?,draft=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
        )
        .bind(
          JSON.stringify(upgraded.manifest),
          JSON.stringify(upgraded),
          upgradedDraft ? JSON.stringify(upgradedDraft) : null,
          now(),
          row.id,
          row.revision,
        ),
    );
  }
  if (changes.length) {
    const results = await db.batch(changes);
    if (
      results.some(
        (result) => Number(result.meta?.changes ?? result.changes) !== 1,
      )
    )
      return;
  }
  await db
    .prepare(
      "INSERT OR IGNORE INTO config (id,value) VALUES ('theme-role-templates-v2','1')",
    )
    .run();
}
export async function listThemes(db) {
  await ensureThemes(db);
  return (
    await all(db, "SELECT * FROM themes ORDER BY is_core DESC,updated_at DESC")
  ).map((r) => ({
    ...parse(r.manifest),
    active: !!r.active,
    isCore: !!r.is_core,
    revision: r.revision,
    hasDraft: !!r.draft,
  }));
}
export async function activeTheme(db) {
  await ensureThemes(db);
  const row = await db.prepare("SELECT * FROM themes WHERE active=1").first();
  return row ? rowDoc(row) : defaultTheme();
}
const requireChange = (r) => {
  if (Number(r.meta?.changes ?? r.changes) !== 1)
    fail("This theme changed elsewhere. Reload before saving.", 409);
};
const conflict = (r, expected) => {
  if (expected !== r.revision)
    fail("This theme changed elsewhere. Reload before saving.", 409);
};
async function record(db, id) {
  const r = await db
    .prepare("SELECT * FROM themes WHERE id=?")
    .bind(id)
    .first();
  if (!r) fail("Theme not found.", 404);
  return r;
}
export async function themeReferences(db, id) {
  const refs = [];
  for (const row of await all(db, "SELECT * FROM themes")) {
    for (const mode of ["published", "draft"]) {
      const d = parse(row[mode]);
      if (themeMediaIds(d).includes(id))
        refs.push({
          id: row.id,
          title: d.manifest?.name + " (" + mode + " theme)",
          kind: "theme",
          published: mode === "published" && !!row.active,
        });
    }
  }
  for (const r of await all(
    db,
    "SELECT theme_id,snapshot FROM theme_history",
  )) {
    const d = parse(r.snapshot);
    if (themeMediaIds(d).includes(id))
      refs.push({
        id: r.theme_id,
        title: d.manifest.name + " (theme history)",
        kind: "theme-history",
        published: false,
      });
  }
  return refs;
}
async function previewKey(db) {
  let row = await db
    .prepare("SELECT value FROM config WHERE id='theme-preview-secret'")
    .first();
  if (!row) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO config (id,value) VALUES ('theme-preview-secret',?)",
      )
      .bind(crypto.randomUUID() + crypto.randomUUID())
      .run();
    row = await db
      .prepare("SELECT value FROM config WHERE id='theme-preview-secret'")
      .first();
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(row.value),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
const b64 = (b) =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const un64 = (s) =>
  Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
export async function verifyThemePreview(db, token) {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig || token.length > 2000) throw Error();
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        await previewKey(db),
        un64(sig),
        new TextEncoder().encode(payload),
      ))
    )
      throw Error();
    const p = JSON.parse(new TextDecoder().decode(un64(payload)));
    if (p.expires < Date.now()) throw Error();
    const row = await record(db, p.id);
    if (row.revision !== p.revision)
      fail("This preview is outdated. Generate a new preview link.", 410);
    return {
      document: p.draft
        ? compileDocument(migrateThemeDocument(parse(row.draft)))
        : rowDoc(row),
      row,
    };
  } catch (e) {
    if (e.status === 410) throw e;
    fail("This preview link is invalid or expired.", 401);
  }
}
export async function previewAllowsMedia(db, token, id) {
  const p = await verifyThemePreview(db, token);
  return themeMediaIds(p.document).includes(id);
}
export async function context(db, path, query = "", page = 1) {
  const rows = await all(db, "SELECT * FROM content ORDER BY publish_at DESC");
  const content = rows
    .map((r) => ({
      ...r,
      publishAt: r.publish_at,
      details: parse(r.details),
      templateId: r.template_id,
    }))
    .filter(published);
  const settings = parse(
    (await db.prepare("SELECT value FROM config WHERE id='site'").first())
      ?.value,
  );
  const indexPage = content.find((c) => c.id === settings.postsPageId);
  const modern = settings.routingVersion === 2;
  const indexPath = modern
    ? settings.homePageId
      ? indexPage
        ? "/" + indexPage.slug
        : null
      : "/"
    : settings.postRouting === "page" && indexPage
      ? "/" + indexPage.slug
      : "/";
  let entry = content.find(
      (c) => c.id !== settings.notFoundPageId && contentPath(c) === path,
    ),
    kind = entry?.kind || "404";
  if (path === indexPath) {
    kind = "post-index";
    entry = indexPage;
  } else if (path === "/search") {
    kind = "search";
    entry = undefined;
  } else if (path === "/" && indexPath !== "/") {
    entry = content.find(
      (c) =>
        c.id === settings.homePageId ||
        (!settings.homePageId && c.kind === "page" && c.slug === "home"),
    );
    kind = entry?.id === settings.homePageId ? "home" : "page";
    if (!entry)
      entry = {
        title: settings.title,
        excerpt: settings.tagline,
        body: "",
        details: {},
      };
  }
  if (kind === "404" && settings.notFoundPageId)
    entry = content.find((c) => c.id === settings.notFoundPageId);
  const plugins = await all(db, "SELECT id FROM plugins WHERE active=1");
  return {
    content: entry,
    kind,
    settings,
    allContent: content,
    media: (await all(db, "SELECT * FROM media")).map(mediaRecord),
    plugins,
    adSettings: await readAdSettings(db),
    path,
    query,
    page,
  };
}
async function validateForDb(db, doc, core) {
  doc = migrateThemeDocument(doc);
  // An editor opened before the metadata migration can still submit its unsaved tree.
  // Built-in icons are canonical metadata; archive manifests remain strictly validated at install.
  const compatible = structuredClone(doc);
  for (const block of compatible?.manifest?.blocks || []) {
    if (
      block.icon == null ||
      (typeof block.icon === "string" && !block.icon.trim())
    ) {
      const builtin = definitions.find((d) => d.type === block.type);
      if (builtin) block.icon = builtin.icon;
    }
  }
  const d = validateDocument(compatible, core);
  for (const id of themeMediaIds(d))
    if (!(await db.prepare("SELECT id FROM media WHERE id=?").bind(id).first()))
      fail("A theme media item no longer exists.");
  return d;
}
export async function publicThemeRenderData(request, env) {
  const u = new URL(request.url);
  const token = u.searchParams.get("themePreview");
  const d = token
    ? (await verifyThemePreview(env.DB, token)).document
    : await activeTheme(env.DB);
  const ctx = await context(
    env.DB,
    u.searchParams.get("path") || "/",
    u.searchParams.get("q") || "",
    Number(u.searchParams.get("page")) || 1,
  );
  ctx.previewToken = token;
  // Portfolio themes may opt into their Home template when the journal normally occupies /.
  const landingTemplate =
    ctx.path === "/" && ctx.kind === "post-index"
      ? d.manifest.homeTemplate
      : undefined;
  const entryTitle = ctx.content?.id
    ? ctx.content.details?.metaTitle || ctx.content.title
    : "";
  const metadata = {
    title: entryTitle
      ? entryTitle + " · " + ctx.settings.title
      : ctx.settings.title,
    description:
      ctx.content?.details?.metaDescription ||
      ctx.content?.excerpt ||
      ctx.settings.tagline,
    announcement: ctx.plugins.some((p) => p.id === "com.colossal.announcement")
      ? ctx.settings.announcement || ""
      : "",
    siteIcon: ctx.settings.siteIconId
      ? "/api/media/" + encodeURIComponent(ctx.settings.siteIconId) + "/file"
      : "/favicon.svg",
  };
  try {
    return {
      ...renderTheme(
        d,
        landingTemplate ? { ...ctx, kind: "home" } : ctx,
        landingTemplate,
      ),
      adsEnabled:
        !token &&
        ctx.adSettings?.liveAds === true &&
        ctx.plugins.some((p) => p.id === "com.colossal.google-ads"),
      preview: !!token,
      theme: d.manifest.name,
      ...metadata,
      status: ctx.kind === "404" ? 404 : 200,
    };
  } catch (e) {
    if (token) throw e;
    return {
      ...renderTheme(defaultTheme(), ctx),
      ...metadata,
      fallback: true,
      status: ctx.kind === "404" ? 404 : 200,
    };
  }
}
export async function publicThemeRender(request, env) {
  return json(await publicThemeRenderData(request, env));
}
export async function serveThemeAsset(request, env, id, file, userIdentity) {
  if (!safePath(file)) fail("Invalid theme asset path.");
  const row = await record(env.DB, id),
    token = new URL(request.url).searchParams.get("themePreview");
  let d = rowDoc(row);
  if (token) {
    const p = await verifyThemePreview(env.DB, token);
    if (p.row.id !== id) fail("Preview does not match this theme.", 403);
    d = p.document;
  } else if (!row.active) await userIdentity(request, env.DB);
  const asset = d.assets?.[file];
  if (!asset) fail("Asset not found.", 404);
  const object = await env.STORAGE?.get(asset.key);
  if (!object) fail("Asset not found.", 404);
  return new Response(object.body, {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
async function install(request, env) {
  const form = await uploadForm(request, 25 * 1024 * 1024),
    file = form.get("file");
  if (
    !file?.name?.toLowerCase().endsWith(".zip") ||
    ![
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
      "",
    ].includes(file.type)
  )
    fail("Choose a theme ZIP file.");
  if (file.size > 25 * 1024 * 1024)
    fail("Theme ZIP must be 25 MB or smaller.", 413);
  const { files, manifest } = inspectZip(
    new Uint8Array(await file.arrayBuffer()),
    "theme.manifest.json",
  );
  validateThemeManifest(manifest, files);
  if (
    await env.DB.prepare("SELECT id FROM themes WHERE id=?")
      .bind(manifest.id)
      .first()
  )
    fail("This theme ID is installed. Edit it or use a different ID.", 409);
  if (!env.STORAGE) fail("Theme storage is unavailable.", 503);
  const report = [];
  const html = {};
  for (const name of [
    ...manifest.templates.map((t) => t.file),
    ...Object.values(manifest.parts),
    ...manifest.blocks.map((b) => b.file),
  ]) {
    if (files[name].length > 500000) fail("Theme HTML file is too large.");
    html[name] = sanitizeTemplate(dec.decode(files[name]), report, name);
  }
  let doc = {
    manifest,
    templates: Object.fromEntries(
      manifest.templates.map((t) => [t.id, htmlToTree(html[t.file])]),
    ),
    parts: Object.fromEntries(
      Object.entries(manifest.parts).map(([k, v]) => [k, htmlToTree(html[v])]),
    ),
    blocks: manifest.blocks
      .filter((b) => !b.type.startsWith("core/"))
      .map((b) => ({
        type: b.type,
        label: b.type.split("/")[1],
        category: "Theme",
        icon: b.icon,
        fields: [],
        template: html[b.file],
      })),
    html,
    css: (manifest.assets?.styles || [])
      .map((p) => sanitizeCss(dec.decode(files[p]), report))
      .join("\n"),
    assets: {},
  };
  if (files["theme.draft.json"]) {
    let draft;
    try {
      draft = JSON.parse(dec.decode(files["theme.draft.json"]));
    } catch {
      fail("theme.draft.json is not valid JSON.");
    }
    doc = { ...draft, manifest, css: doc.css, assets: {} };
    doc.blocks = (draft.blocks || doc.blocks).map((b) => ({
      ...b,
      template: sanitizeTemplate(b.template || "", report, b.type),
    }));
  }
  if (manifest.assets?.scripts?.length)
    report.push(
      "Theme scripts removed: themes are declarative and do not execute JavaScript.",
    );
  doc.manifest.assets = { styles: manifest.assets?.styles || [], scripts: [] };
  const prefix = "themes/" + manifest.id + "/" + crypto.randomUUID() + "/",
    keys = [];
  try {
    for (const [name, bytes] of Object.entries(files)) {
      if (!/\.(png|jpe?g|webp|gif|svg|mp3|wav|ogg|mp4|webm)$/i.test(name))
        continue;
      const info = inspectMedia(bytes, name, "");
      const key = prefix + name;
      await env.STORAGE.put(key, bytes);
      keys.push(key);
      doc.assets[name] = { key, mime: info.mime };
    }
    // Relative image references become theme asset URLs before tree compilation.
    const rewrite = (b) => {
      if (b.settings?.html)
        b.settings.html = b.settings.html.replace(
          /(src|poster)="([^"]+)"/g,
          (full, attr, url) =>
            doc.assets[url]
              ? attr + '="/api/themes/' + manifest.id + "/assets/" + url + '"'
              : full,
        );
      b.children?.forEach(rewrite);
    };
    Object.values(doc.templates).forEach(rewrite);
    Object.values(doc.parts).forEach(rewrite);
    doc = await validateForDb(env.DB, doc, false);
    await env.DB.prepare(
      "INSERT INTO themes (id,manifest,published,draft,active,is_core,revision,updated_at) VALUES (?,?,?,NULL,0,0,1,?)",
    )
      .bind(
        manifest.id,
        JSON.stringify(doc.manifest),
        JSON.stringify(doc),
        now(),
      )
      .run();
  } catch (e) {
    await env.STORAGE.delete(keys);
    throw e;
  }
  return json(
    {
      id: manifest.id,
      report: [...new Set(report)],
      message: "Theme installed inactive.",
    },
    201,
  );
}
export async function handleThemes(request, env, user, path) {
  const db = env.DB;
  await ensureThemes(db);
  if (path === "/api/themes" && request.method === "GET")
    return json(await listThemes(db));
  if (path === "/api/themes/active" && request.method === "GET") {
    const d = await activeTheme(db);
    return json({ manifest: d.manifest });
  }
  if (user.role !== "admin") fail("Administrator access is required.", 403);
  if (path === "/api/themes/install" && request.method === "POST")
    return install(request, env);
  const match = path.match(/^\/api\/themes\/([^/]+)(?:\/(.+))?$/);
  if (!match) fail("Theme endpoint not found.", 404);
  const id = decodeURIComponent(match[1]),
    action = match[2] || "",
    row = await record(db, id);
  if (!action && request.method === "GET")
    return json({
      ...parse(row.manifest),
      active: !!row.active,
      isCore: !!row.is_core,
      revision: row.revision,
      hasDraft: !!row.draft,
      published: rowDoc(row),
      draft: migrateThemeDocument(parse(row.draft, null)),
      history: await all(
        db,
        "SELECT id,version,created_at FROM theme_history WHERE theme_id=? ORDER BY created_at DESC",
        id,
      ),
    });
  if (!action && request.method === "DELETE") {
    if (row.is_core) fail("The core theme cannot be deleted.", 403);
    if (row.active)
      fail("Activate another theme before deleting this one.", 409);
    const history = await all(
      db,
      "SELECT snapshot FROM theme_history WHERE theme_id=?",
      id,
    );
    const keys = [
      ...new Set(
        [
          rowDoc(row),
          parse(row.draft),
          ...history.map((h) => parse(h.snapshot)),
        ].flatMap((d) => Object.values(d?.assets || {}).map((a) => a.key)),
      ),
    ];
    await env.STORAGE?.delete(keys);
    await db.batch([
      db.prepare("DELETE FROM theme_history WHERE theme_id=?").bind(id),
      db.prepare("DELETE FROM themes WHERE id=?").bind(id),
    ]);
    return json({ ok: true });
  }
  if (action === "export" && request.method === "GET") {
    const d = compileDocument(
      migrateThemeDocument(parse(row.draft, null) || rowDoc(row)),
    );
    if (d.manifest.isCore) {
      d.manifest.id += "." + "export";
      d.manifest.isCore = false;
    }
    const files = {
      "theme.manifest.json": strToU8(JSON.stringify(d.manifest, null, 2)),
      "theme.draft.json": strToU8(
        JSON.stringify({ ...d, assets: {}, compiled: undefined }, null, 2),
      ),
    };
    for (const t of d.manifest.templates)
      files[t.file] = strToU8(d.compiled?.[t.id] || "");
    for (const [name, path] of Object.entries(d.manifest.parts))
      files[path] = strToU8(compileBlock(d.parts[name], d));
    for (const b of d.manifest.blocks)
      files[b.file] = strToU8(
        d.blocks.find((x) => x.type === b.type)?.template || "<div></div>",
      );
    for (const name of d.manifest.assets.styles) files[name] = strToU8(d.css);
    for (const [name, a] of Object.entries(d.assets)) {
      const o = await env.STORAGE?.get(a.key);
      if (!o) fail("An export asset is missing.", 409);
      files[name] = new Uint8Array(await o.arrayBuffer());
    }
    return new Response(zipSync(files), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="' + id + '.zip"',
        "Cache-Control": "no-store",
      },
    });
  }
  const body = await readJson(request, 3000000);
  if (action === "render" && request.method === "POST") {
    const d = await validateForDb(db, body.document, !!row.is_core);
    const t =
      d.manifest.templates.find((t) => t.id === body.templateId) ||
      d.manifest.templates[0];
    const ctx = await context(db, "/");
    ctx.adsPreview = true;
    ctx.kind = t.appliesTo[0];
    ctx.content = ctx.allContent.find((c) => c.kind === ctx.kind) || {
      title: "A new perspective",
      excerpt: "A little room for your next big idea.",
      body: "Your content appears here.",
      details: {},
    };
    return json(renderTheme(d, ctx, t.id, { part: body.part }));
  }
  if (action === "activate" && request.method === "POST") {
    conflict(row, body.revision);
    const d = await validateForDb(db, rowDoc(row), !!row.is_core);
    const fallbacks = (
      await all(
        db,
        "SELECT id,title,kind,template_id FROM content WHERE template_id!=''",
      )
    )
      .filter(
        (c) => resolveTemplateForContent(d, c.kind, c.template_id).warning,
      )
      .map((c) => ({
        id: c.id,
        title: c.title,
        templateId: c.template_id,
        fallback:
          resolveTemplateForContent(d, c.kind, c.template_id).template?.name ||
          "Core fallback",
      }));
    await db.batch([
      db.prepare("UPDATE themes SET active=0"),
      db.prepare("UPDATE themes SET active=1 WHERE id=?").bind(id),
    ]);
    return json({ ok: true, fallbacks });
  }
  if (action === "preview" && request.method === "POST") {
    const p = b64(
      new TextEncoder().encode(
        JSON.stringify({
          id,
          revision: row.revision,
          draft: body.draft !== false && !!row.draft,
          expires: Date.now() + 15 * 60000,
        }),
      ),
    );
    const signature = b64(
      await crypto.subtle.sign(
        "HMAC",
        await previewKey(db),
        new TextEncoder().encode(p),
      ),
    );
    return json({
      url: "/?themePreview=" + p + "." + signature,
      expiresIn: 900,
    });
  }
  conflict(row, body.revision);
  if (
    (action === "draft" || action.startsWith("templates/")) &&
    ["PUT", "POST"].includes(request.method)
  ) {
    let d;
    if (action.startsWith("templates/")) {
      d = parse(row.draft, null) || rowDoc(row);
      const templateId = decodeURIComponent(action.slice(10));
      if (!d.templates[templateId]) fail("Template not found.", 404);
      d.templates[templateId] = body.root;
    } else d = body.document;
    if (!d?.manifest) fail("A theme document is required.");
    // Asset identities are immutable and cannot be forged through draft writes.
    d.assets = rowDoc(row).assets;
    d.manifest.id = id;
    d.manifest.isCore = !!row.is_core;
    d.manifest.version = parse(row.manifest).version;
    d = await validateForDb(db, d, !!row.is_core);
    await db
      .prepare(
        "UPDATE themes SET draft=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
      )
      .bind(JSON.stringify(d), now(), id, row.revision)
      .run()
      .then(requireChange);
    return json({ ok: true, revision: row.revision + 1 });
  }
  if (action === "publish" && request.method === "POST") {
    if (!row.draft) fail("Save a draft before publishing.");
    const d = await validateForDb(db, parse(row.draft), !!row.is_core);
    d.manifest.version = semver.inc(parse(row.manifest).version, "patch");
    compileDocument(d);
    const publishedResults = await db.batch([
      db
        .prepare(
          "INSERT INTO theme_history (id,theme_id,version,snapshot,created_at) SELECT ?,?,?,?,? FROM themes WHERE id=? AND revision=?",
        )
        .bind(
          crypto.randomUUID(),
          id,
          parse(row.manifest).version,
          row.published,
          now(),
          id,
          row.revision,
        ),
      db
        .prepare(
          "UPDATE themes SET published=?,manifest=?,draft=NULL,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
        )
        .bind(
          JSON.stringify(d),
          JSON.stringify(d.manifest),
          now(),
          id,
          row.revision,
        ),
    ]);
    requireChange(publishedResults[1]);
    return json({
      ok: true,
      version: d.manifest.version,
      revision: row.revision + 1,
    });
  }
  if (action === "revert" && request.method === "POST") {
    await db
      .prepare(
        "UPDATE themes SET draft=NULL,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
      )
      .bind(now(), id, row.revision)
      .run()
      .then(requireChange);
    return json({ ok: true });
  }
  if (action === "restore" && request.method === "POST") {
    const h = await db
      .prepare("SELECT snapshot FROM theme_history WHERE id=? AND theme_id=?")
      .bind(body.historyId, id)
      .first();
    if (!h) fail("History version not found.", 404);
    const d = migrateThemeDocument(parse(h.snapshot));
    d.manifest.version = parse(row.manifest).version;
    await db
      .prepare(
        "UPDATE themes SET draft=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?",
      )
      .bind(JSON.stringify(d), now(), id, row.revision)
      .run()
      .then(requireChange);
    return json({ ok: true });
  }
  if (action === "clone" && request.method === "POST") {
    const d = migrateThemeDocument(parse(row.draft, null) || rowDoc(row));
    const name = String(body.name || "").trim();
    if (!name || name.length > 100)
      fail("Name your new theme (up to 100 characters).");
    d.manifest.id =
      "com.colossal.theme.copy-" +
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 55) +
      "-" +
      crypto.randomUUID().slice(0, 8);
    d.manifest.name = name;
    d.manifest.isCore = false;
    d.manifest.version = "1.0.0";
    const keys = [];
    try {
      for (const [path, a] of Object.entries(d.assets)) {
        const object = await env.STORAGE.get(a.key);
        if (!object) fail("A source asset is missing.");
        const key =
          "themes/" + d.manifest.id + "/" + crypto.randomUUID() + "/" + path;
        await env.STORAGE.put(key, new Uint8Array(await object.arrayBuffer()));
        keys.push(key);
        a.key = key;
      }
      compileDocument(d);
      await db
        .prepare(
          "INSERT INTO themes (id,manifest,published,draft,active,is_core,revision,updated_at) VALUES (?,?,?,NULL,0,0,1,?)",
        )
        .bind(
          d.manifest.id,
          JSON.stringify(d.manifest),
          JSON.stringify(d),
          now(),
        )
        .run();
    } catch (e) {
      await env.STORAGE?.delete(keys);
      throw e;
    }
    return json({ id: d.manifest.id }, 201);
  }
  fail("Theme operation not found.", 404);
}
