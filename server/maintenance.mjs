import {
  defaultTheme,
  validateDocument,
  renderTheme,
  themeMediaIds,
  esc,
} from "./theme-engine.mjs";
import {
  all,
  parse,
  fail,
  json,
  now,
  readJson,
  mediaRecord,
} from "./v2-utils.mjs";

export const MAINTENANCE_ID = "com.colossal.maintenance";
const key = "maintenance";
const node = (type, settings = {}, children) => ({
  id: "blk_" + crypto.randomUUID(),
  type,
  settings,
  ...(children ? { children } : {}),
});
function starter(
  name,
  variant = "blank",
  id = "com.colossal.maintenance.layout-" + crypto.randomUUID(),
) {
  const d = defaultTheme();
  Object.assign(d.manifest, {
    id,
    name,
    isCore: false,
    description: "An editable maintenance layout.",
  });
  d.manifest.templates = [
    {
      id: "home",
      name: "Maintenance",
      file: "templates/home.html",
      isDefault: true,
      appliesTo: ["home"],
    },
  ];
  for (const part of Object.keys(d.parts))
    d.parts[part] = node("core/container", {}, []);
  const text =
    variant === "midnight"
      ? "Something brilliant is on its way."
      : variant === "studio"
        ? "Making room for what’s next."
        : "We’ll be back shortly.";
  const card = node(
    "core/container",
    { classes: "maintenance-card", maxWidth: 760, padding: 48 },
    [
      node("core/rich-text", {
        html: '<p class="maintenance-eyebrow">{{site.title}} · UNDER MAINTENANCE</p>',
      }),
      node("core/heading", { text, level: "h1" }),
      node("core/rich-text", {
        html: "<p>We’re updating our website. Thank you for your patience while we put the finishing touches on it.</p>",
      }),
      node("core/rich-text", {
        html: '<p class="maintenance-note">Please check back soon.</p>',
      }),
    ],
  );
  d.templates = {
    home: node(
      "core/container",
      { classes: "maintenance-body" },
      variant === "blank" ? [] : [card],
    ),
  };
  const dark = variant === "midnight",
    studio = variant === "studio";
  d.css = `.theme-root{margin:0;font-family:system-ui,sans-serif;line-height:1.7;background-color:${dark ? "#101426" : studio ? "#faf3e8" : "#f2f6f4"};color:${dark ? "#f0f3ff" : "#203d34"}}.theme-root.maintenance-body{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.theme-root h1{font-size:clamp(36px,7vw,76px);line-height:1.06;letter-spacing:-2px;margin:24px 0}.theme-root .maintenance-card{width:100%;border-radius:28px;${dark ? "background-image:linear-gradient(135deg,#252845,#151b32);border:1px solid #4a4d70" : studio ? "box-shadow:inset 8px 0 0 #db6d43;background-color:#fffaf3" : "background-color:#ffffff;border:1px solid #dbe5df"}}.theme-root .maintenance-eyebrow{font-size:12px;font-weight:700;letter-spacing:2px}.theme-root .maintenance-note{margin-top:36px;font-size:13px;opacity:.7}@media(max-width:600px){.theme-root .maintenance-card{padding:28px!important}}`;
  return validateDocument(d);
}
function layout(document) {
  return {
    id: document.manifest.id,
    name: document.manifest.name,
    published: document,
    draft: null,
    revision: 1,
    history: [],
  };
}
async function store(db, seed = false) {
  let row = await db
    .prepare("SELECT value FROM config WHERE id=?")
    .bind(key)
    .first();
  if (!row && seed) {
    const layouts = [
      layout(starter("Quiet", "quiet", "com.colossal.maintenance.quiet")),
      layout(
        starter("Midnight", "midnight", "com.colossal.maintenance.midnight"),
      ),
      layout(starter("Studio", "studio", "com.colossal.maintenance.studio")),
    ];
    await db
      .prepare("INSERT OR IGNORE INTO config (id,value) VALUES (?,?)")
      .bind(
        key,
        JSON.stringify({
          settings: {
            enabled: false,
            layoutId: layouts[0].id,
            templateId: "home",
            retryAfter: 3600,
          },
          layouts,
          revision: 1,
        }),
      )
      .run();
    row = await db
      .prepare("SELECT value FROM config WHERE id=?")
      .bind(key)
      .first();
  }
  return { raw: row?.value, data: parse(row?.value, null) };
}
async function persist(db, state) {
  state.data.revision++;
  const serialized = JSON.stringify(state.data);
  if (new TextEncoder().encode(serialized).length > 8 * 1024 * 1024)
    fail(
      "Maintenance layouts and history exceed 8 MB. Reduce layout content or remove unused layouts before saving.",
      413,
    );
  const result = await db
    .prepare("UPDATE config SET value=? WHERE id=? AND value=?")
    .bind(serialized, key, state.raw)
    .run();
  if (Number(result.meta?.changes ?? result.changes) !== 1)
    fail("Maintenance settings changed elsewhere. Reload before saving.", 409);
}
export async function maintenanceState(db, request) {
  const plugin = await db
    .prepare("SELECT active FROM plugins WHERE id=?")
    .bind(MAINTENANCE_ID)
    .first();
  if (!plugin?.active) return null;
  const { data } = await store(db);
  if (!data?.settings.enabled) return null;
  const email = request.headers.get("oai-authenticated-user-email");
  if (
    email &&
    (
      await db
        .prepare("SELECT role FROM members WHERE email=?")
        .bind(email.toLowerCase())
        .first()
    )?.role === "admin"
  )
    return null;
  const record = data.layouts.find((l) => l.id === data.settings.layoutId);
  return record
    ? { settings: data.settings, document: record.published }
    : null;
}
async function render(db, document, templateId, part) {
  const settings = parse(
    (await db.prepare("SELECT value FROM config WHERE id='site'").first())
      ?.value,
  );
  const ctx = {
    settings,
    kind: "home",
    path: "/",
    content: { title: "Under maintenance", body: "", excerpt: "", details: {} },
    allContent: [],
    plugins: [],
    adsPreview: true,
    media: (await all(db, "SELECT * FROM media")).map(mediaRecord),
  };
  return renderTheme(document, ctx, templateId, { part });
}
export async function maintenanceRender(db, state) {
  return {
    ...(await render(db, state.document, state.settings.templateId)),
    title: state.document.manifest.name + " · Under maintenance",
    description:
      "Our website is temporarily under maintenance. Please check back soon.",
    maintenance: true,
    status: 503,
    adsEnabled: false,
    preview: false,
  };
}
export function maintenanceHtml(shell, rendered) {
  const body = rendered.body;
  // Hand the sanitized render to Angular before it replaces the server markup.
  const initial = JSON.stringify({ ...rendered, maintenance: true }).replace(
    /</g,
    "\\u003c",
  );
  return shell
    .replace(/<title>[^<]*<\/title>/i, `<title>${esc(rendered.title)}</title>`)
    .replace(
      /<\/head>/i,
      `<meta name="robots" content="noindex"><style>${rendered.css.replace(/</g, "\\3c ")}</style><script type="application/json" id="maintenance-render">${initial}</script></head>`,
    )
    .replace(
      /<body[^>]*>/i,
      `<body class="theme-root ${esc(body.className)}" style="${esc(body.style)}">`,
    )
    .replace(
      /<cl-frontend[^>]*>[\s\S]*?<\/cl-frontend>/i,
      `<cl-frontend>${rendered.html}</cl-frontend>`,
    );
}
async function validate(db, document, id) {
  const d = structuredClone(document);
  if (!d?.manifest) fail("A maintenance layout document is required.");
  d.manifest.id = id;
  d.manifest.isCore = false;
  d.assets = {};
  const validated = validateDocument(d);
  for (const mediaId of themeMediaIds(validated))
    if (
      !(await db
        .prepare("SELECT id FROM media WHERE id=?")
        .bind(mediaId)
        .first())
    )
      fail("A layout media item no longer exists.");
  return validated;
}
function summary(l, settings) {
  return {
    ...l.published.manifest,
    name: l.name,
    revision: l.revision,
    hasDraft: !!l.draft,
    active: settings.layoutId === l.id,
    isCore: false,
  };
}
export async function handleMaintenance(request, env, user, path) {
  if (user.role !== "admin") fail("Administrator access is required.", 403);
  if (
    !(
      await env.DB.prepare("SELECT active FROM plugins WHERE id=?")
        .bind(MAINTENANCE_ID)
        .first()
    )?.active
  )
    fail("Activate the Maintenance plugin first.", 409);
  const state = await store(env.DB, true),
    data = state.data;
  if (path === "/api/maintenance" && request.method === "GET")
    return json({
      settings: data.settings,
      revision: data.revision,
      layouts: data.layouts.map((l) => summary(l, data.settings)),
    });
  const body = ["GET", "HEAD", "DELETE"].includes(request.method)
    ? {}
    : await readJson(request, 3000000);
  if (path === "/api/maintenance/settings" && request.method === "POST") {
    if (body.revision !== data.revision)
      fail(
        "Maintenance settings changed elsewhere. Reload before saving.",
        409,
      );
    const selected = data.layouts.find((l) => l.id === body.layoutId);
    if (
      typeof body.enabled !== "boolean" ||
      !selected ||
      !selected.published.manifest.templates.some(
        (t) => t.id === body.templateId,
      ) ||
      !Number.isInteger(body.retryAfter) ||
      body.retryAfter < 60 ||
      body.retryAfter > 86400
    )
      fail(
        "Choose a published layout/template and a retry interval between 60 and 86,400 seconds.",
      );
    data.settings = {
      enabled: body.enabled,
      layoutId: body.layoutId,
      templateId: body.templateId,
      retryAfter: body.retryAfter,
    };
    await persist(env.DB, state);
    return json({ ok: true });
  }
  if (path === "/api/maintenance" && request.method === "POST") {
    if (
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.length > 100 ||
      data.layouts.length >= 30
    )
      fail(
        "Use a name up to 100 characters; at most 30 layouts are supported.",
      );
    const created = layout(starter(body.name.trim()));
    data.layouts.push(created);
    await persist(env.DB, state);
    return json({ id: created.id }, 201);
  }
  const match = path.match(/^\/api\/maintenance\/([^/]+)(?:\/(.+))?$/);
  if (!match) fail("Maintenance endpoint not found.", 404);
  const id = decodeURIComponent(match[1]),
    action = match[2] || "",
    record = data.layouts.find((l) => l.id === id);
  if (!record) fail("Maintenance layout not found.", 404);
  if (!action && request.method === "GET")
    return json({
      ...summary(record, data.settings),
      published: record.published,
      draft: record.draft,
      history: record.history.map(({ snapshot, ...h }) => h),
    });
  if (!action && request.method === "DELETE") {
    if (data.settings.layoutId === id)
      fail("Select another layout before deleting this one.", 409);
    data.layouts = data.layouts.filter((l) => l.id !== id);
    await persist(env.DB, state);
    return json({ ok: true });
  }
  if (action === "render" && request.method === "POST")
    return json(
      await render(
        env.DB,
        await validate(env.DB, body.document, id),
        body.templateId,
        body.part,
      ),
    );
  if (action === "preview" && request.method === "POST")
    return json({
      url:
        "/api/maintenance/" +
        encodeURIComponent(id) +
        "/preview" +
        (typeof body.templateId === "string"
          ? "?templateId=" + encodeURIComponent(body.templateId)
          : ""),
    });
  if (action === "preview" && request.method === "GET") {
    const rendered = await render(
      env.DB,
      record.draft || record.published,
      new URL(request.url).searchParams.get("templateId") ||
        (data.settings.layoutId === id ? data.settings.templateId : "home"),
    );
    const shell = await env.ASSETS.fetch(
      new Request(new URL("/index.html", request.url)),
    );
    // Preview is administrator-only; no shareable public bypass token is issued.
    return new Response(
      maintenanceHtml(await shell.text(), {
        ...rendered,
        title: record.name + " · Preview",
        preview: true,
        maintenancePreview: true,
      }).replace(
        /<\/head>/i,
        `<meta name="colossal-maintenance-preview" content="${esc(id)}"></head>`,
      ),
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  }
  if (action === "preview-render" && request.method === "GET")
    return json({
      ...(await maintenanceRender(env.DB, {
        document: record.draft || record.published,
        settings: {
          templateId:
            new URL(request.url).searchParams.get("templateId") ||
            (data.settings.layoutId === id
              ? data.settings.templateId
              : record.published.manifest.templates[0].id),
        },
      })),
      preview: true,
      maintenancePreview: true,
    });
  if (body.revision !== record.revision)
    fail(
      "This maintenance layout changed elsewhere. Reload before saving.",
      409,
    );
  if (action === "draft" && request.method === "PUT")
    record.draft = await validate(env.DB, body.document, id);
  else if (action === "publish" && request.method === "POST") {
    if (!record.draft) fail("Save a draft before publishing.");
    record.history.unshift({
      id: crypto.randomUUID(),
      version: record.published.manifest.version,
      created_at: now(),
      snapshot: record.published,
    });
    record.history = record.history.slice(0, 20);
    record.published = await validate(env.DB, record.draft, id);
    record.published.manifest.version = "0.0." + (record.revision + 1);
    record.name = record.published.manifest.name;
    record.draft = null;
    if (
      data.settings.layoutId === id &&
      !record.published.templates[data.settings.templateId]
    )
      data.settings.templateId = record.published.manifest.templates.find(
        (t) => t.isDefault,
      ).id;
  } else if (action === "revert" && request.method === "POST")
    record.draft = null;
  else if (action === "restore" && request.method === "POST") {
    const history = record.history.find((h) => h.id === body.historyId);
    if (!history) fail("Layout version not found.", 404);
    record.draft = await validate(env.DB, history.snapshot, id);
  } else if (action === "clone" && request.method === "POST") {
    if (
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.length > 100 ||
      data.layouts.length >= 30
    )
      fail("Choose a layout name; at most 30 layouts are supported.");
    const cloneId = "com.colossal.maintenance.layout-" + crypto.randomUUID(),
      d = await validate(env.DB, record.draft || record.published, cloneId);
    d.manifest.name = body.name.trim();
    data.layouts.push(layout(d));
    await persist(env.DB, state);
    return json({ id: cloneId });
  } else fail("Maintenance endpoint not found.", 404);
  record.revision++;
  await persist(env.DB, state);
  return json({ ok: true, revision: record.revision });
}
