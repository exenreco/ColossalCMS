import { themeMediaIds } from "./theme-engine.mjs";
import definitions from "../shared/theme-blocks.json" with { type: "json" };
export const fail = (message, status = 400, extra = {}) => {
  throw Object.assign(new Error(message), { status, ...extra });
};
export const json = (value, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export const now = () => new Date().toISOString();
export const all = async (db, sql, ...args) =>
  (
    await db
      .prepare(sql)
      .bind(...args)
      .all()
  ).results;
export const parse = (value, fallback = {}) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
export async function uploadForm(request, limit) {
  if (Number(request.headers.get("Content-Length")) > limit + 65536)
    fail("The upload exceeds the allowed size.", 413);
  let size = 0;
  const reader = request.body?.getReader();
  if (!reader) fail("Choose a file to upload.");
  const stream = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      size += value.byteLength;
      if (size > limit + 65536) {
        await reader.cancel();
        controller.error(
          Object.assign(new Error("The upload exceeds the allowed size."), {
            status: 413,
          }),
        );
        return;
      }
      controller.enqueue(value);
    },
    cancel() {
      return reader.cancel();
    },
  });
  try {
    return await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: stream,
      duplex: "half",
    }).formData();
  } catch (e) {
    if (size > limit + 65536) fail("The upload exceeds the allowed size.", 413);
    fail("Unable to read this file upload.");
  }
}
export async function readJson(request, limit = 300000) {
  const text = await request.text();
  if (text.length > limit) fail("This entry is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    fail("Invalid JSON.");
  }
}
export const mediaRecord = (r) => ({
  ...r,
  altText: r.alt_text,
  uploadedBy: r.uploaded_by,
  uploadedAt: r.uploaded_at,
  updatedAt: r.updated_at,
  tags: parse(r.tags, []),
  metadata: parse(r.metadata),
  url: "/api/media/" + r.id + "/file",
  thumbnailUrl:
    r.type === "image"
      ? "/api/media/" + r.id + "/file"
      : r.type === "model"
        ? "/api/media/" + r.id + "/poster"
        : undefined,
  storage_key: undefined,
});
export function mediaIds(details) {
  const ids = new Set(
    details?.featuredImageId ? [details.featuredImageId] : [],
  );
  const visit = (node) => {
    if (node?.type === "media" && typeof node.attrs?.mediaId === "string")
      ids.add(node.attrs.mediaId);
    node?.content?.forEach(visit);
  };
  if (!Array.isArray(details?.contentBlocks)) visit(details?.richText);
  const visitBlock = (node) => {
    for (const key of ["mediaId", "poster", "backgroundMediaId"])
      if (typeof node?.settings?.[key] === "string" && node.settings[key])
        ids.add(node.settings[key]);
    node?.children?.forEach(visitBlock);
  };
  details?.contentBlocks?.forEach(visitBlock);
  return [...ids];
}
export const published = (c) =>
  c.status === "published" ||
  (c.status === "scheduled" && (c.publishAt || c.publish_at) <= now());
export async function references(db, id) {
  const refs = [];
  const rows = await all(
    db,
    "SELECT id,title,kind,details,status,publish_at FROM content",
  );
  for (const r of rows)
    if (mediaIds(parse(r.details)).includes(id))
      refs.push({
        id: r.id,
        title: r.title,
        kind: r.kind,
        published: published(r),
      });
  const settings = parse(
    (await db.prepare("SELECT value FROM config WHERE id='site'").first())
      ?.value,
  );
  if (settings.siteIconId === id)
    refs.push({
      id: "site-icon",
      title: "Site icon",
      kind: "settings",
      published: true,
    });
  const revisions = await all(
    db,
    "SELECT id,content_id,snapshot FROM revisions",
  );
  for (const r of revisions) {
    const c = parse(r.snapshot);
    if (mediaIds(c.details).includes(id))
      refs.push({
        id: r.content_id,
        title: (c.title || "Content") + " (revision)",
        kind: "revision",
        published: false,
      });
  }
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
  for (const row of await all(
    db,
    "SELECT theme_id,snapshot FROM theme_history",
  )) {
    const d = parse(row.snapshot);
    if (themeMediaIds(d).includes(id))
      refs.push({
        id: row.theme_id,
        title: d.manifest.name + " (theme history)",
        kind: "theme-history",
        published: false,
      });
  }
  return refs;
}
export async function validateDetails(db, details = {}) {
  if (typeof details !== "object" || Array.isArray(details) || details === null)
    fail("Invalid editor options.");
  const clean = {
    featuredImageId: details.featuredImageId || "",
    categories: details.categories || [],
    tags: details.tags || [],
    metaTitle: details.metaTitle || "",
    metaDescription: details.metaDescription || "",
    panelData: details.panelData || {},
  };
  for (const key of ["categories", "tags"])
    if (
      !Array.isArray(clean[key]) ||
      clean[key].length > 30 ||
      clean[key].some((x) => typeof x !== "string" || x.length > 80)
    )
      fail("Use up to 30 short categories or tags.");
  if (
    typeof clean.metaTitle !== "string" ||
    clean.metaTitle.length > 200 ||
    typeof clean.metaDescription !== "string" ||
    clean.metaDescription.length > 500
  )
    fail("Check the SEO title and description.");
  if (JSON.stringify(clean.panelData).length > 10000)
    fail("Extra editor options are too large.");
  if (details.contentMain !== undefined) {
    if (
      !details.contentMain ||
      typeof details.contentMain !== "object" ||
      Array.isArray(details.contentMain) ||
      JSON.stringify(details.contentMain).length > 100000 ||
      Object.keys(details.contentMain).some(
        (key) => !/^[a-zA-Z][\w-]{0,60}$/.test(key),
      )
    )
      fail("Invalid Main settings.");
    clean.contentMain = JSON.parse(JSON.stringify(details.contentMain));
  }
  let count = 0;
  function check(node, depth = 0) {
    if (++count > 6000 || depth > 25) fail("This document is too complex.");
    if (
      !node ||
      typeof node !== "object" ||
      ![
        "doc",
        "paragraph",
        "text",
        "heading",
        "bulletList",
        "orderedList",
        "listItem",
        "blockquote",
        "codeBlock",
        "hardBreak",
        "horizontalRule",
        "media",
      ].includes(node.type)
    )
      fail("Unsupported rich-text content.");
    const result = { type: node.type };
    if (node.type === "text") {
      if (typeof node.text !== "string") fail("Invalid text.");
      result.text = node.text;
    }
    if (node.type === "heading")
      result.attrs = {
        level: [1, 2, 3, 4, 5, 6].includes(node.attrs?.level)
          ? node.attrs.level
          : 2,
      };
    if (node.type === "orderedList")
      result.attrs = {
        start: Math.max(1, Math.min(1000, Number(node.attrs?.start) || 1)),
      };
    if (node.type === "media") {
      if (typeof node.attrs?.mediaId !== "string")
        fail("Choose an item from the media library.");
      result.attrs = { mediaId: node.attrs.mediaId, type: node.attrs.type };
    }
    if (node.marks) {
      if (!Array.isArray(node.marks)) fail("Invalid text formatting.");
      result.marks = node.marks.map((m) => {
        if (
          !["bold", "italic", "strike", "code", "underline", "link"].includes(
            m.type,
          )
        )
          fail("Unsupported text formatting.");
        if (m.type === "link") {
          const href = m.attrs?.href;
          if (
            typeof href !== "string" ||
            !/^(https?:\/\/|mailto:|\/(?!\/))/.test(href) ||
            /[\x00-\x20]/.test(href)
          )
            fail("Links must use http, https, mailto, or a local path.");
          return {
            type: "link",
            attrs: { href, target: "_blank", rel: "noopener noreferrer" },
          };
        }
        return { type: m.type };
      });
    }
    if (node.content) {
      if (!Array.isArray(node.content)) fail("Invalid document content.");
      result.content = node.content.map((n) => check(n, depth + 1));
    }
    return result;
  }
  if (details.richText) {
    if (details.richText.type !== "doc")
      fail("The editor document must have a document root.");
    clean.richText = check(details.richText);
  }
  if (details.contentBlocks !== undefined) {
    if (!Array.isArray(details.contentBlocks)) fail("Invalid content blocks.");
    const allowed = new Set(
      definitions.filter((d) => !d.legacy).map((d) => d.type),
    );
    const active = await db
      .prepare("SELECT published FROM themes WHERE active=1")
      .first();
    const customDefinitions = active?.published
      ? JSON.parse(active.published).blocks || []
      : [];
    for (const definition of customDefinitions)
      if (definition?.type && !definition.legacy) allowed.add(definition.type);
    allowed.add("core/html");
    let blockCount = 0;
    const ids = new Set();
    const checkBlock = (block, depth = 0, parent = "root") => {
      if (
        ++blockCount > 500 ||
        depth > 8 ||
        !block ||
        typeof block !== "object"
      )
        fail("This block layout is too complex.");
      if (
        !allowed.has(block.type) &&
        !(
          typeof block.type === "string" &&
          !block.type.startsWith("core/") &&
          /^[a-z][\w.-]*\/[a-z][\w-]*$/.test(block.type)
        )
      )
        fail("Unsupported content block.");
      if (block.type === "core/column" && parent !== "core/columns")
        fail("A Column must be inside Columns.");
      if (parent === "core/columns" && block.type !== "core/column")
        fail("Columns may contain Column blocks only.");
      if (block.type === "core/slide" && parent !== "core/slider")
        fail("A Slide must be inside a Slider.");
      if (parent === "core/slider" && block.type !== "core/slide")
        fail("Sliders may contain Slide blocks only.");
      if (
        block.type === "core/overlay" &&
        !["core/slide", "core/gltf"].includes(parent)
      )
        fail("An Overlay must be inside a Slide or 3D model.");
      if (parent === "core/gltf" && block.type !== "core/overlay")
        fail("3D models may contain Overlay blocks only.");
      if (
        typeof block.id !== "string" ||
        !/^blk_[\w-]{8,80}$/.test(block.id) ||
        ids.has(block.id)
      )
        fail("Content blocks need unique IDs.");
      ids.add(block.id);
      const definition = [...definitions, ...customDefinitions].find(
        (d) => d.type === block.type,
      );
      const container = definition
        ? !!definition.container
        : Array.isArray(block.children);
      if (container !== Array.isArray(block.children))
        fail("Check the content block structure.");
      if (
        !block.settings ||
        typeof block.settings !== "object" ||
        Array.isArray(block.settings) ||
        JSON.stringify(block.settings).length > 100000
      )
        fail("Invalid block settings.");
      const settings = JSON.parse(JSON.stringify(block.settings));
      for (const key of Object.keys(settings))
        if (!/^[a-zA-Z][\w-]{0,60}$/.test(key)) fail("Invalid block setting.");
      return {
        id: block.id,
        type: block.type,
        settings,
        ...(container
          ? {
              children: block.children.map((child) =>
                checkBlock(child, depth + 1, block.type),
              ),
            }
          : {}),
      };
    };
    clean.contentBlocks = details.contentBlocks.map((block) =>
      checkBlock(block),
    );
  }
  for (const id of mediaIds(clean)) {
    const item = await db
      .prepare("SELECT type FROM media WHERE id=?")
      .bind(id)
      .first();
    if (!item) fail("A selected media item no longer exists.");
    if (id === clean.featuredImageId && item.type !== "image")
      fail("Featured media must be an image.");
  }
  return clean;
}
export async function repairRouting(db) {
  const row = await db
    .prepare("SELECT value FROM config WHERE id='site'")
    .first();
  if (!row) return;
  const settings = parse(row.value);
  if (settings.routingVersion === 2) {
    const statements = [];
    for (const [key, label] of [
      ["homePageId", "Home"],
      ["postsPageId", "Posts"],
      ["notFoundPageId", "404"],
    ]) {
      if (!settings[key]) continue;
      const page = await db
        .prepare("SELECT * FROM content WHERE id=? AND kind='page'")
        .bind(settings[key])
        .first();
      if (!page || page.status !== "published") {
        settings[key] = "";
        statements.push(
          db
            .prepare(
              "INSERT INTO notices (id,message,created_at) VALUES (?,?,?)",
            )
            .bind(
              crypto.randomUUID(),
              `The ${label} page assignment was cleared because '${page?.title || label}' was deleted or unpublished.`,
              now(),
            ),
        );
      }
    }
    if (!settings.homePageId) settings.postsPageId = "";
    settings.postRouting = settings.homePageId ? "page" : "home";
    if (JSON.stringify(settings) !== row.value) {
      statements.unshift(
        db
          .prepare("UPDATE config SET value=? WHERE id='site'")
          .bind(JSON.stringify(settings)),
      );
      await db.batch(statements);
    }
    return;
  }
  if (settings.postRouting === "page") {
    const page = await db
      .prepare("SELECT * FROM content WHERE id=? AND kind='page'")
      .bind(settings.postsPageId || "")
      .first();
    if (!page || !published(page)) {
      settings.postRouting = "home";
      settings.postsPageId = "";
      await db.batch([
        db
          .prepare("UPDATE config SET value=? WHERE id='site'")
          .bind(JSON.stringify(settings)),
        db
          .prepare("INSERT INTO notices (id,message,created_at) VALUES (?,?,?)")
          .bind(
            crypto.randomUUID(),
            "Posts are back on the home page because the selected posts page was deleted or unpublished.",
            now(),
          ),
      ]);
    }
  }
}
