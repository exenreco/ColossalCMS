import {
  ensureThemes,
  activeTheme,
  handleThemes,
  publicThemeRender,
  serveThemeAsset,
  previewAllowsMedia,
  context as themeContext,
} from "./themes.mjs";
import { renderContentCanvas } from "./theme-engine.mjs";
import { readAdSettings, validateAdSettings } from "./google-ads.mjs";
import { handleConnections } from "./production-connections.mjs";
import { handleLoginSecurity, LOGIN_SECURITY_ID } from "./login-security.mjs";
import { handleMedia, serveMedia } from "./media.mjs";
import {
  uploadedPlugins,
  installPlugin,
  changeUploadedPlugin,
  servePlugin,
} from "./plugin-installer.mjs";
import {
  parse,
  mediaIds,
  mediaRecord,
  validateDetails,
  repairRouting,
} from "./v2-utils.mjs";
import { catalog, defaultSettings, sampleContent } from "./catalog.mjs";
const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const hash = async (value) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const rowToContent = (r) => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  slug: r.slug,
  excerpt: r.excerpt,
  body: r.body,
  status: r.status,
  publishAt: r.publish_at,
  updatedAt: r.updated_at,
  author: r.author,
  details: parse(r.details),
  templateId: r.template_id || "",
});
export const isPublished = (c) =>
  c.status === "published" ||
  (c.status === "scheduled" && c.publishAt <= now());
/** The D1 binding is injected by hosting; local development uses the same prepared-statement interface. */
function database(env) {
  if (!env.DB)
    fail("The database is unavailable. Please try again shortly.", 503);
  return env.DB;
}
async function all(db, sql, ...args) {
  return (
    await db
      .prepare(sql)
      .bind(...args)
      .all()
  ).results;
}
async function log(db, message) {
  return db
    .prepare("INSERT INTO activity (id,message,created_at) VALUES (?,?,?)")
    .bind(uuid(), message, now())
    .run();
}
async function identity(request, db) {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers
    .get("oai-authenticated-user-email")
    ?.toLowerCase();
  if (!id || !email) fail("Sign in to access your workspace.", 401);
  const member = await db
    .prepare("SELECT * FROM members WHERE email=?")
    .bind(email)
    .first();
  if (!member)
    fail("Your account has not been invited to this workspace.", 403);
  return { ...member, authenticatedId: id };
}
export async function initialize(db, user) {
  await ensureThemes(db);
  await db.batch(
    catalog.map((p) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO plugins (id,active,installed) VALUES (?,?,?)",
        )
        .bind(
          p.id,
          p.isCore || p.id === LOGIN_SECURITY_ID ? 1 : 0,
          p.isCore || p.id === LOGIN_SECURITY_ID ? 1 : 0,
        ),
    ),
  );
  if (await db.prepare("SELECT id FROM config WHERE id='site'").first()) return;
  const time = now();
  const statements = [
    db
      .prepare("INSERT OR IGNORE INTO config (id,value) VALUES ('site',?)")
      .bind(JSON.stringify(defaultSettings)),
  ];
  for (const p of catalog)
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO plugins (id,active,installed) VALUES (?,?,?)",
        )
        .bind(
          p.id,
          p.isCore || p.id.endsWith("reading-time") ? 1 : 0,
          p.isCore || p.id.endsWith("reading-time") ? 1 : 0,
        ),
    );
  for (const c of sampleContent)
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO content (id,kind,title,slug,excerpt,body,status,publish_at,updated_at,author) VALUES (?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          c.id,
          c.kind,
          c.title,
          c.slug,
          c.excerpt,
          c.body,
          c.status,
          time,
          time,
          user.email,
        ),
    );
  statements.push(
    db
      .prepare(
        "INSERT OR IGNORE INTO activity (id,message,created_at) VALUES (?,?,?)",
      )
      .bind("welcome", "Workspace created with three sample entries", time),
  );
  await db.batch(statements);
}
async function state(db, user) {
  await repairRouting(db);
  const [rows, pluginRows, settings, activity, members, keys] =
    await Promise.all([
      all(db, "SELECT * FROM content ORDER BY updated_at DESC"),
      all(db, "SELECT * FROM plugins"),
      db.prepare("SELECT value FROM config WHERE id='site'").first(),
      all(db, "SELECT * FROM activity ORDER BY created_at DESC LIMIT 30"),
      user?.role === "admin" ? all(db, "SELECT * FROM members") : [],
      user?.role === "admin"
        ? all(db, "SELECT id,name,created_at FROM api_keys")
        : [],
    ]);
  return {
    user,
    content: rows.map(rowToContent),
    activeTheme: { manifest: (await activeTheme(db)).manifest },
    plugins: [
      ...catalog.map((p) => {
        const r = pluginRows.find((x) => x.id === p.id);
        return { ...p, active: !!r?.active, installed: !!r?.installed };
      }),
      ...(await uploadedPlugins(db)),
    ].sort((a, b) => (a.admin.menu.order || 0) - (b.admin.menu.order || 0)),
    settings: {
      ...defaultSettings,
      siteIconId: "",
      postRouting: "home",
      postsPageId: "",
      homePageId: "",
      ...(settings ? JSON.parse(settings.value) : {}),
    },
    media: (await all(db, "SELECT * FROM media ORDER BY uploaded_at DESC")).map(
      mediaRecord,
    ),
    notices: await all(db, "SELECT * FROM notices ORDER BY created_at DESC"),
    activity: activity.map((a) => ({ ...a, createdAt: a.created_at })),
    members,
    keys: keys.map((k) => ({ ...k, createdAt: k.created_at })),
  };
}
function requireAdmin(user) {
  if (user.role !== "admin") fail("Administrator access is required.", 403);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (!path.startsWith("/api/")) {
        if (path === "/admin")
          return Response.redirect(url.origin + "/admin/", 302);
        const isAdmin = path.startsWith("/admin/");
        if (isAdmin && !request.headers.get("oai-authenticated-user-id"))
          return Response.redirect(
            url.origin +
              "/signin-with-chatgpt?return_to=" +
              encodeURIComponent(path),
            302,
          );
        let assetPath = path;
        if (
          isAdmin &&
          (!/\.[a-z0-9]+$/i.test(path) ||
            /^\/admin\/themes\/edit\/[^/]+$/.test(path))
        )
          assetPath = "/admin/index.html";
        else if (!isAdmin && !/\.[a-z0-9]+$/i.test(path))
          assetPath = "/index.html";
        const response = await env.ASSETS.fetch(
          new Request(new URL(assetPath, url.origin), request),
        );
        const headers = new Headers(response.headers);
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      const db = database(env);
      if (path === "/api/themes/render" && request.method === "GET")
        return await publicThemeRender(request, env);
      const themeAsset = path.match(/^\/api\/themes\/([^/]+)\/assets\/(.+)$/);
      if (themeAsset && request.method === "GET")
        return await serveThemeAsset(
          request,
          env,
          decodeURIComponent(themeAsset[1]),
          decodeURIComponent(themeAsset[2]),
          identity,
        );
      const mediaFile = path.match(/^\/api\/media\/([^/]+)\/(file|poster)$/);
      if (mediaFile && ["GET", "HEAD"].includes(request.method))
        return await serveMedia(
          request,
          env,
          mediaFile[1],
          async (req, db) => {
            const token = new URL(req.url).searchParams.get("themePreview");
            if (token && (await previewAllowsMedia(db, token, mediaFile[1])))
              return { role: "preview" };
            return identity(req, db);
          },
          mediaFile[2] === "poster",
        );
      const pluginFile = path.match(
        /^\/api\/plugins\/([^/]+)\/files\/([^/]+)\/(.+)$/,
      );
      if (pluginFile && request.method === "GET")
        return await servePlugin(
          request,
          env,
          pluginFile[1],
          pluginFile[2],
          decodeURIComponent(pluginFile[3]),
          identity,
        );
      if (path === "/api/public" && request.method === "GET") {
        const s = await state(db, null);
        return json({
          settings: s.settings,
          plugins: s.plugins.filter((p) => p.active),
          content: s.content.filter(isPublished),
          media: s.media.filter(
            (m) =>
              m.id === s.settings.siteIconId ||
              s.content
                .filter(isPublished)
                .some((c) => mediaIds(c.details).includes(m.id)),
          ),
        });
      }
      if (path === "/api/content" && request.method === "GET") {
        const token = request.headers
          .get("Authorization")
          ?.replace(/^Bearer /, "");
        if (!token) fail("A read API key is required.", 401);
        if (
          !(await db
            .prepare("SELECT id FROM api_keys WHERE hash=?")
            .bind(await hash(token))
            .first())
        )
          fail("Invalid API key.", 401);
        const s = await state(db, null);
        return json(s.content.filter(isPublished));
      }
      if (!["GET", "HEAD"].includes(request.method)) {
        if (request.headers.get("Origin") !== url.origin)
          fail("This request must come from your workspace.", 403);
        if (
          !request.headers
            .get("Content-Type")
            ?.startsWith("application/json") &&
          !(
            (path.startsWith("/api/media") ||
              path === "/api/plugins/install" ||
              path === "/api/themes/install") &&
            request.headers
              .get("Content-Type")
              ?.startsWith("multipart/form-data")
          )
        )
          fail("Use a JSON request.", 415);
      }
      // Owner setup is deliberate and only available behind the owner-private Sites access policy.
      if (path === "/api/admin/setup" && request.method === "POST") {
        if (env.PASSWORD_AUTH)
          fail(
            "Use the token-protected administrator setup screen at /setup.",
            409,
          );
        const id = request.headers.get("oai-authenticated-user-id");
        const email = request.headers
          .get("oai-authenticated-user-email")
          ?.toLowerCase();
        if (!id || !email) fail("Sign in before creating a workspace.", 401);
        const existing = await db
          .prepare("SELECT id FROM members WHERE id='owner'")
          .first();
        if (existing) fail("This workspace already has an owner.", 409);
        await db
          .prepare(
            "INSERT INTO members (id,email,role) VALUES ('owner',?,'admin')",
          )
          .bind(email)
          .run();
        await initialize(db, { email });
        return json({ ok: true });
      }
      if (path === "/api/admin/session") {
        const owner = await db
          .prepare("SELECT id FROM members WHERE id='owner'")
          .first();
        if (!request.headers.get("oai-authenticated-user-id"))
          fail("Sign in to continue.", 401);
        if (!owner) return json({ setup: true });
        const user = await identity(request, db);
        await initialize(db, user);
        return json({ user, passwordAuth: env.PASSWORD_AUTH === true });
      }
      const user = await identity(request, db);
      if (path.startsWith("/api/admin/connections"))
        return await handleConnections(request, env, user);
      if (path.startsWith("/api/admin/login-security"))
        return await handleLoginSecurity(request, env, user);
      if (path === "/api/admin/google-ads" && request.method === "GET") {
        requireAdmin(user);
        return json(await readAdSettings(db));
      }
      if (path.startsWith("/api/themes"))
        return await handleThemes(request, env, user, path);
      if (path.startsWith("/api/media"))
        return await handleMedia(request, env, user, path);
      if (path === "/api/plugins/install" && request.method === "POST") {
        requireAdmin(user);
        return await installPlugin(request, env);
      }
      const pluginAction = path.match(
        /^\/api\/plugins\/([^/]+)\/(activate|deactivate|discard|rollback|uninstall)$/,
      );
      if (pluginAction && request.method === "POST") {
        requireAdmin(user);
        return await changeUploadedPlugin(
          request,
          env,
          pluginAction[1],
          pluginAction[2],
        );
      }
      const revisionPath = path.match(
        /^\/api\/admin\/content\/([^/]+)\/revisions$/,
      );
      if (revisionPath && request.method === "GET")
        return json(
          (
            await all(
              db,
              "SELECT * FROM revisions WHERE content_id=? ORDER BY created_at DESC LIMIT 30",
              revisionPath[1],
            )
          ).map((r) => ({ ...r, snapshot: parse(r.snapshot) })),
        );
      if (
        path.startsWith("/api/admin/notices/") &&
        request.method === "DELETE"
      ) {
        await db
          .prepare("DELETE FROM notices WHERE id=?")
          .bind(path.split("/").pop())
          .run();
        return json({ ok: true });
      }
      if (path === "/api/admin/state" && request.method === "GET")
        return json(await state(db, user));
      let body = {};
      if (!["GET", "DELETE"].includes(request.method)) {
        const text = await request.text();
        if (text.length > 500000) fail("This entry is too large.", 413);
        try {
          body = JSON.parse(text);
        } catch {
          fail("Invalid JSON.");
        }
      }
      if (path === "/api/admin/content/render" && request.method === "POST") {
        const draft = body.content || {};
        if (!["post", "page"].includes(draft.kind))
          fail("Choose a post or page to preview.");
        const details = await validateDetails(db, {
          ...(draft.details || {}),
          ...(body.contentBlocks !== undefined
            ? { contentBlocks: body.contentBlocks }
            : {}),
          ...(body.mainSettings !== undefined
            ? { contentMain: body.mainSettings }
            : {}),
        });
        const theme = await activeTheme(db);
        const ctx = await themeContext(db, "/");
        ctx.kind = draft.kind;
        ctx.content = {
          ...draft,
          title: String(draft.title || "Untitled " + draft.kind),
          details,
        };
        return json(renderContentCanvas(theme, ctx, body.mainId));
      }
      if (path === "/api/admin/content" && request.method === "POST") {
        const {
          id,
          kind,
          title,
          slug,
          excerpt = "",
          body: contentBody = "",
          status,
          publishAt,
        } = body;
        if (
          !["page", "post"].includes(kind) ||
          !["draft", "pending", "published", "scheduled"].includes(status)
        )
          fail("Choose a valid content type and status.");
        if (typeof title !== "string" || !title.trim() || title.length > 200)
          fail("Enter a title of 1–200 characters.");
        if (
          typeof slug !== "string" ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
          slug.length > 160 ||
          [
            "admin",
            "api",
            "signin-with-chatgpt",
            "signout-with-chatgpt",
            "callback",
          ].includes(slug)
        )
          fail(
            "Use a unique URL slug with lowercase letters, numbers, and hyphens.",
          );
        if (
          typeof excerpt !== "string" ||
          excerpt.length > 500 ||
          typeof contentBody !== "string" ||
          contentBody.length > 100000
        )
          fail("Content exceeds the allowed length.");
        if (
          status === "scheduled" &&
          (!publishAt ||
            !Number.isFinite(Date.parse(publishAt)) ||
            Date.parse(publishAt) <= Date.now())
        )
          fail("Choose a future publication date.");
        const existing = id
          ? await db
              .prepare("SELECT * FROM content WHERE id=?")
              .bind(id)
              .first()
          : null;
        if (id && !existing) fail("This entry no longer exists.", 404);
        const duplicate = await db
          .prepare("SELECT id FROM content WHERE slug=? AND id!=?")
          .bind(slug, id || "")
          .first();
        if (duplicate) fail("That URL slug is already in use.", 409);
        const details = await validateDetails(
          db,
          body.details || parse(existing?.details),
        );
        const templateId = body.templateId ?? existing?.template_id ?? "";
        if (typeof templateId !== "string" || templateId.length > 100)
          fail("Invalid template ID.");
        if (templateId && templateId !== existing?.template_id) {
          const theme = await activeTheme(db);
          const settings = parse(
            (
              await db
                .prepare("SELECT value FROM config WHERE id='site'")
                .first()
            )?.value,
          );
          const scope =
            kind === "page" && id && id === settings.postsPageId
              ? "post-index"
              : kind === "page" && id && id === settings.notFoundPageId
                ? "404"
                : kind === "page" && id && id === settings.homePageId
                  ? "home"
                  : kind;
          if (
            !theme.manifest.templates.some(
              (t) => t.id === templateId && t.appliesTo.includes(scope),
            )
          )
            fail("Choose a template available for this content type.");
        }
        const contentId = id || uuid();
        const time = now();
        const date =
          status === "scheduled"
            ? new Date(publishAt).toISOString()
            : status === "published" &&
                ["draft", "pending"].includes(existing?.status)
              ? time
              : existing?.publish_at || time;
        const author =
          typeof body.author === "string" && body.author.trim()
            ? body.author.trim()
            : existing?.author || user.email;
        if (
          author !== existing?.author &&
          author !== user.email &&
          !(await db
            .prepare("SELECT id FROM members WHERE email=?")
            .bind(author)
            .first())
        )
          fail("Choose an existing workspace author.");
        const snapshot = {
          ...body,
          id: contentId,
          kind,
          title: title.trim(),
          slug,
          excerpt,
          body: contentBody,
          status,
          publishAt: date,
          updatedAt: time,
          author,
          details,
          templateId,
          _autosave: !!body.autosave,
        };
        if (body.autosave && existing && isPublished(rowToContent(existing))) {
          await db
            .prepare(
              "INSERT INTO revisions (id,content_id,snapshot,created_at,author) VALUES (?,?,?,?,?)",
            )
            .bind(uuid(), contentId, JSON.stringify(snapshot), time, user.email)
            .run();
          return json({
            id: contentId,
            autosaved: true,
            updatedAt: existing.updated_at,
          });
        }
        if (
          existing &&
          body.expectedUpdatedAt &&
          body.expectedUpdatedAt !== existing.updated_at
        )
          fail(
            "This entry was changed elsewhere. Copy your edits and reload before saving.",
            409,
          );
        const statements = [
          db
            .prepare(
              "INSERT INTO content (id,kind,title,slug,excerpt,body,status,publish_at,updated_at,author,details,template_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,slug=excluded.slug,excerpt=excluded.excerpt,body=excluded.body,status=excluded.status,publish_at=excluded.publish_at,updated_at=excluded.updated_at,author=excluded.author,details=excluded.details,template_id=excluded.template_id",
            )
            .bind(
              contentId,
              kind,
              title.trim(),
              slug,
              excerpt,
              contentBody,
              status,
              date,
              time,
              author,
              JSON.stringify(details),
              templateId,
            ),
          db
            .prepare(
              "INSERT INTO revisions (id,content_id,snapshot,created_at,author) VALUES (?,?,?,?,?)",
            )
            .bind(
              uuid(),
              contentId,
              JSON.stringify(snapshot),
              time,
              user.email,
            ),
        ];
        await db.batch(statements);
        await repairRouting(db);
        if (!body.autosave)
          await log(
            db,
            `${status === "published" ? "Published" : status === "scheduled" ? "Scheduled" : "Saved draft"}: ${title.trim()}`,
          );
        return json({ id: contentId, updatedAt: time });
      }
      if (
        path.startsWith("/api/admin/content/") &&
        request.method === "DELETE"
      ) {
        const id = decodeURIComponent(path.split("/").pop());
        const c = await db
          .prepare("SELECT title FROM content WHERE id=?")
          .bind(id)
          .first();
        if (!c) fail("Entry not found.", 404);
        const settingRow = await db
          .prepare("SELECT value FROM config WHERE id='site'")
          .first();
        const settings = parse(settingRow?.value);
        const clearedRoles = [];
        for (const [key, role] of [
          ["homePageId", "Home"],
          ["postsPageId", "Posts"],
          ["notFoundPageId", "404"],
        ])
          if (settings[key] === id) {
            settings[key] = "";
            clearedRoles.push(role);
          }
        if (settings.routingVersion === 2 && !settings.homePageId)
          settings.postsPageId = "";
        if (settings.routingVersion === 2)
          settings.postRouting = settings.homePageId ? "page" : "home";
        const updates = [
          db.prepare("DELETE FROM content WHERE id=?").bind(id),
          db.prepare("DELETE FROM revisions WHERE content_id=?").bind(id),
        ];
        if (clearedRoles.length) {
          updates.push(
            db
              .prepare("UPDATE config SET value=? WHERE id='site'")
              .bind(JSON.stringify(settings)),
          );
          updates.push(
            db
              .prepare(
                "INSERT INTO notices (id,message,created_at) VALUES (?,?,?)",
              )
              .bind(
                crypto.randomUUID(),
                `${c.title} was deleted, so its ${clearedRoles.join(", ")} page assignment was cleared.`,
                now(),
              ),
          );
        }
        await db.batch(updates);
        await repairRouting(db);
        await log(db, "Deleted: " + c.title);
        return json({ ok: true });
      }
      requireAdmin(user);
      if (path === "/api/admin/google-ads" && request.method === "POST") {
        const settings = validateAdSettings(body);
        await db
          .prepare(
            "INSERT INTO config (id,value) VALUES ('google-ads',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
          )
          .bind(JSON.stringify(settings))
          .run();
        await log(db, "Updated Google Ads settings");
        return json({ ok: true });
      }
      if (path === "/api/admin/plugins" && request.method === "POST") {
        const plugin = catalog.find((p) => p.id === body.id);
        if (!plugin) fail("This plugin is not in the bundled catalog.", 404);
        if (plugin.isCore)
          fail("Core plugins are locked and cannot be changed.", 403);
        if (
          !["activate", "deactivate", "install", "uninstall"].includes(
            body.action,
          )
        )
          fail("Unknown plugin action.");
        const installed = body.action !== "uninstall";
        const active = ["activate", "install"].includes(body.action);
        await db
          .prepare(
            "INSERT INTO plugins (id,active,installed) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET active=excluded.active,installed=excluded.installed",
          )
          .bind(plugin.id, +active, +installed)
          .run();
        await log(
          db,
          `${{ install: "Installed", uninstall: "Uninstalled", activate: "Activated", deactivate: "Deactivated" }[body.action]} ${plugin.name}`,
        );
        return json({ ok: true });
      }
      if (path === "/api/admin/settings" && request.method === "POST") {
        const prior = parse(
          (await db.prepare("SELECT value FROM config WHERE id='site'").first())
            ?.value,
        );
        const merged = { ...prior, ...body };
        const { title, tagline, accent, logo, announcement } = merged;
        const {
          siteIconId = "",
          postRouting = "home",
          postsPageId = "",
          homePageId = "",
          notFoundPageId = "",
          routingVersion = 1,
        } = merged;
        if (!["home", "page"].includes(postRouting))
          fail("Choose where posts should appear.");
        if (
          siteIconId &&
          !(await db
            .prepare("SELECT id FROM media WHERE id=? AND type='image'")
            .bind(siteIconId)
            .first())
        )
          fail("Choose a site icon from the image library.");
        if (routingVersion === 2) {
          if (!homePageId && postsPageId)
            fail("Choose a Home page before assigning a Posts page.");
          const assigned = [homePageId, postsPageId, notFoundPageId].filter(
            Boolean,
          );
          if (new Set(assigned).size !== assigned.length)
            fail("A page may hold at most one routing role.");
          for (const id of assigned) {
            const page = await db
              .prepare("SELECT * FROM content WHERE id=? AND kind='page'")
              .bind(id)
              .first();
            if (!page || page.status !== "published")
              fail("Only published pages may be assigned a routing role.");
          }
        }
        if (postRouting === "page" && (routingVersion !== 2 || postsPageId)) {
          const page = await db
            .prepare("SELECT * FROM content WHERE id=? AND kind='page'")
            .bind(postsPageId)
            .first();
          if (!page || !isPublished(rowToContent(page)))
            fail("Choose a published page for your posts.");
          if (homePageId === postsPageId)
            fail("Home and posts must use different pages.");
        }
        if (homePageId) {
          const home = await db
            .prepare("SELECT * FROM content WHERE id=? AND kind='page'")
            .bind(homePageId)
            .first();
          if (!home || !isPublished(rowToContent(home)))
            fail("Choose a published home page.");
        }
        if (
          typeof title !== "string" ||
          !title.trim() ||
          title.length > 80 ||
          typeof tagline !== "string" ||
          tagline.length > 200 ||
          typeof announcement !== "string" ||
          announcement.length > 240 ||
          typeof logo !== "string" ||
          logo.length > 2000 ||
          !/^#[0-9a-fA-F]{6}$/.test(accent)
        )
          fail("Check the site settings and try again.");
        if (logo) {
          try {
            if (new URL(logo).protocol !== "https:")
              fail("The logo must use an HTTPS URL.");
          } catch {
            fail("Enter a valid HTTPS logo URL.");
          }
        }
        await db
          .prepare("UPDATE config SET value=? WHERE id='site'")
          .bind(
            JSON.stringify({
              title: title.trim(),
              tagline,
              accent,
              logo,
              announcement,
              siteIconId,
              postRouting,
              postsPageId: postRouting === "page" ? postsPageId : "",
              homePageId,
              notFoundPageId,
              routingVersion,
            }),
          )
          .run();
        await log(db, "Updated site settings");
        return json({ ok: true });
      }
      if (path === "/api/admin/members" && request.method === "POST") {
        const email =
          typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          !["admin", "editor"].includes(body.role)
        )
          fail("Enter a valid email address and role.");
        const existing = await db
          .prepare("SELECT * FROM members WHERE email=?")
          .bind(email)
          .first();
        if (existing?.id === "owner")
          fail("The workspace owner must remain an administrator.");
        await db
          .prepare(
            "INSERT INTO members (id,email,role) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role",
          )
          .bind(uuid(), email, body.role)
          .run();
        await log(db, "Updated workspace access for " + email);
        return json({ ok: true });
      }
      if (
        path.startsWith("/api/admin/members/") &&
        request.method === "DELETE"
      ) {
        const id = path.split("/").pop();
        if (id === "owner" || id === user.id)
          fail("The owner and your own access cannot be removed.");
        await db.prepare("DELETE FROM members WHERE id=?").bind(id).run();
        return json({ ok: true });
      }
      if (path === "/api/admin/keys" && request.method === "POST") {
        if (
          typeof body.name !== "string" ||
          !body.name.trim() ||
          body.name.length > 80
        )
          fail("Enter a name for this API key.");
        const key =
          "cl_" + uuid().replaceAll("-", "") + uuid().replaceAll("-", "");
        await db
          .prepare(
            "INSERT INTO api_keys (id,name,hash,created_at) VALUES (?,?,?,?)",
          )
          .bind(uuid(), body.name.trim(), await hash(key), now())
          .run();
        return json({ key });
      }
      if (path.startsWith("/api/admin/keys/") && request.method === "DELETE") {
        await db
          .prepare("DELETE FROM api_keys WHERE id=?")
          .bind(path.split("/").pop())
          .run();
        return json({ ok: true });
      }
      return json({ error: "Endpoint not found." }, 404);
    } catch (error) {
      console.error(
        error.status ? error.message : "Request failed",
        error.status ? "" : error,
      );
      return json(
        {
          references: error.references,
          error: error.status
            ? error.message
            : "Unable to save or load data. Please try again.",
        },
        error.status || 500,
      );
    }
  },
};
