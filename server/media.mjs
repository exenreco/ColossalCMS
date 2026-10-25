import {
  createWebpVariant,
  ensureWebpVariant,
  variantKey,
  acceptsWebp,
  webpEligible,
  responsiveFile,
  deleteResponsiveFiles,
} from "../plugins/media/variants.mjs";
import { imageSize } from "image-size";
import { inspectIco } from "../shared/ico.mjs";
import { inspectModel } from "./gltf.mjs";
import { modelPoster } from "./model-poster.mjs";
import { XMLValidator, XMLParser } from "fast-xml-parser";
import {
  fail,
  json,
  now,
  all,
  parse,
  uploadForm,
  readJson,
  mediaRecord,
  references,
} from "./v2-utils.mjs";
const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/vnd.microsoft.icon",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
};
export function inspectMedia(bytes, filename, mime) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["gltf", "glb", "zip"].includes(ext))
    return inspectModel(bytes, filename);
  const expected = MIME[ext];
  if (!expected)
    fail(
      "Supported files: PNG, JPG, GIF, WebP, SVG, ICO, PDF, MP3, WAV, OGG, MP4, WebM, GLB, glTF, and model ZIP packages.",
    );
  if (
    mime &&
    mime !== expected &&
    !(
      ext === "ico" &&
      ["image/x-icon", "image/ico", "image/icon"].includes(mime)
    ) &&
    ![
      "application/octet-stream",
      "audio/mp3",
      "audio/x-wav",
      "application/ogg",
    ].includes(mime)
  )
    fail("The file type does not match its extension.");
  const ascii = (start, end) =>
    new TextDecoder().decode(bytes.slice(start, end));
  const head = ascii(0, 16);
  let valid = false;
  let iconFrames;
  if (ext === "ico") {
    try {
      iconFrames = inspectIco(bytes);
      valid = true;
    } catch {
      fail("This ICO file is damaged or contains an unsupported frame.");
    }
  }
  if (ext === "pdf")
    valid =
      /^%PDF-\d\.\d/.test(head) &&
      /%%EOF\s*$/.test(ascii(Math.max(0, bytes.length - 1024), bytes.length));
  if (ext === "png")
    valid =
      bytes[0] === 137 &&
      ascii(1, 4) === "PNG" &&
      bytes[4] === 13 &&
      bytes[5] === 10;
  if (["jpg", "jpeg"].includes(ext))
    valid = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (ext === "gif")
    valid = head.startsWith("GIF87a") || head.startsWith("GIF89a");
  if (ext === "webp")
    valid = head.startsWith("RIFF") && ascii(8, 12) === "WEBP";
  if (ext === "wav") valid = head.startsWith("RIFF") && ascii(8, 12) === "WAVE";
  if (ext === "ogg") valid = head.startsWith("OggS");
  if (ext === "mp3")
    valid =
      head.startsWith("ID3") || (bytes[0] === 255 && (bytes[1] & 224) === 224);
  if (ext === "mp4") valid = ascii(4, 8) === "ftyp";
  if (ext === "webm")
    valid =
      bytes[0] === 26 &&
      bytes[1] === 69 &&
      bytes[2] === 223 &&
      bytes[3] === 163;
  if (ext === "svg") {
    const svg = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (
      /<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|<\s*(script|foreignObject|iframe|object|embed|animate|set)\b|\bon\w+\s*=|javascript\s*:|data\s*:/i.test(
        svg,
      )
    )
      fail(
        "SVG files must be static and contain no scripts or external resources.",
      );
    if (XMLValidator.validate(svg) !== true) fail("This SVG is not valid XML.");
    const tree = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      processEntities: true,
      htmlEntities: true,
    }).parse(svg);
    if (!tree.svg) fail("This SVG has no root element.");
    const tags = new Set([
      "svg",
      "g",
      "path",
      "rect",
      "circle",
      "ellipse",
      "line",
      "polyline",
      "polygon",
      "text",
      "tspan",
      "defs",
      "linearGradient",
      "radialGradient",
      "stop",
      "clipPath",
      "title",
      "desc",
      "symbol",
      "use",
    ]);
    function check(obj) {
      for (const [key, val] of Object.entries(obj)) {
        if (key === "?xml" || key === "#text") continue;
        if (key.startsWith("@_")) {
          const attr = key.slice(2);
          const value = String(val);
          // Gradients and clipping paths may reference IDs within this SVG only.
          // Decode XML entities above and reject CSS escapes/comments so an
          // external URL cannot disguise its function name or destination.
          const localUrl =
            /^url\(\s*(?:#[\w:.-]+|"#[\w:.-]+"|'#[\w:.-]+')\s*\)$/i;
          if (
            /^on/i.test(attr) ||
            attr === "style" ||
            attr === "xml:base" ||
            /\\|\/\*/.test(value) ||
            (/url\s*\(/i.test(value) && !localUrl.test(value)) ||
            ((attr === "href" || attr === "xlink:href") &&
              !value.startsWith("#"))
          )
            fail(
              "SVG files must not contain active content or external references.",
            );
        } else {
          if (!tags.has(key)) fail("Unsupported SVG element: " + key);
          for (const child of Array.isArray(val) ? val : [val])
            if (child && typeof child === "object") check(child);
        }
      }
    }
    check(tree);
    valid = true;
  }
  if (!valid) fail("The file signature does not match its media type.");
  const type = ext === "pdf" ? "pdf" : expected.split("/")[0];
  let metadata = { size: bytes.length };
  if (type === "image") {
    try {
      const size = iconFrames?.[0] || imageSize(bytes);
      metadata = { ...metadata, width: size.width, height: size.height };
      if (iconFrames)
        metadata.iconSizes = iconFrames.map(({ width, height }) => ({
          width,
          height,
        }));
    } catch {
      fail("This image is damaged or has no readable dimensions.");
    }
  }
  return { mime: expected, type, metadata, ext };
}
export async function handleMedia(request, env, user, path) {
  const db = env.DB,
    storage = env.STORAGE;
  if (!storage) fail("Media storage is unavailable.", 503);
  if (path === "/api/media" && request.method === "GET")
    return json(
      await all(db, "SELECT * FROM media ORDER BY uploaded_at DESC").then(
        (rows) => rows.map(mediaRecord),
      ),
    );
  const match = path.match(
    /^\/api\/media\/([^/]+)(?:\/(replace|references))?$/,
  );
  const id = match?.[1],
    action = match?.[2];
  if (id && action === "references" && request.method === "GET")
    return json(await references(db, id));
  const current = id
    ? await db.prepare("SELECT * FROM media WHERE id=?").bind(id).first()
    : null;
  if (id && !current) fail("Media not found.", 404);
  if (
    request.method === "POST" &&
    (path === "/api/media" || action === "replace")
  ) {
    const max = Math.min(
      Number(env.MAX_MEDIA_UPLOAD_BYTES) || 100 * 1024 * 1024,
      100 * 1024 * 1024,
    );
    const form = await uploadForm(request, max);
    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function")
      fail("Choose a media file.");
    if (!file.size || file.size > max)
      fail(
        "File size must be between 1 byte and " +
          Math.round(max / 1024 / 1024) +
          " MB.",
        413,
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = inspectMedia(bytes, file.name, file.type);
    info.metadata.originalFilename = file.name.slice(0, 200);
    if (info.type !== "model" && file.size > 25 * 1024 * 1024)
      fail("Images, PDFs, audio and video must be 25 MB or smaller.", 413);
    if (current && current.type !== info.type)
      fail("Replacement must keep the same media type.");
    const alt = String(form.get("altText") ?? current?.alt_text ?? "").trim();
    if (info.type === "image" && !alt)
      fail("Add alt text describing this image.");
    if (alt.length > 500) fail("Alt text must be 500 characters or fewer.");
    const metadata = parse(String(form.get("metadata") || "{}"));
    for (const key of ["duration"])
      if (
        Number.isFinite(metadata[key]) &&
        metadata[key] >= 0 &&
        metadata[key] < 86400
      )
        info.metadata[key] = metadata[key];
    const mediaId = id || crypto.randomUUID(),
      key = "media/" + mediaId + "/" + crypto.randomUUID() + "." + info.ext,
      time = now();
    const posterKey =
      info.type === "model"
        ? "media/" + mediaId + "/" + crypto.randomUUID() + "-poster.svg"
        : "";
    if (posterKey) info.metadata.posterStorageKey = posterKey;
    await storage.put(key, info.bytes || bytes);
    try {
      if (posterKey) await storage.put(posterKey, modelPoster(file.name));
      if (info.type === "image") await createWebpVariant(env, bytes, info, key);
    } catch (e) {
      await storage.delete(key);
      throw e;
    }
    try {
      if (current)
        await db
          .prepare(
            "UPDATE media SET mime=?,storage_key=?,metadata=?,alt_text=?,updated_at=? WHERE id=?",
          )
          .bind(
            info.mime,
            key,
            JSON.stringify(info.metadata),
            alt,
            time,
            mediaId,
          )
          .run();
      else
        await db
          .prepare(
            "INSERT INTO media (id,type,name,mime,storage_key,alt_text,caption,description,tags,metadata,uploaded_by,uploaded_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            mediaId,
            info.type,
            file.name.slice(0, 200),
            info.mime,
            key,
            alt,
            "",
            "",
            "[]",
            JSON.stringify(info.metadata),
            user.email,
            time,
            time,
          )
          .run();
    } catch (e) {
      await storage.delete(key);
      if (posterKey) await storage.delete(posterKey);
      if (info.metadata.webp)
        await storage.delete(info.metadata.webp.storageKey);
      throw e;
    }
    if (current) await deleteResponsiveFiles(storage, current);
    if (current && variantKey(current))
      await storage.delete(variantKey(current));
    if (current?.storage_key) await storage.delete(current.storage_key);
    if (current?.type === "model" && parse(current.metadata).posterStorageKey)
      await storage.delete(parse(current.metadata).posterStorageKey);
    return json(
      mediaRecord(
        await db
          .prepare("SELECT * FROM media WHERE id=?")
          .bind(mediaId)
          .first(),
      ),
      current ? 200 : 201,
    );
  }
  if (id && !action && request.method === "PATCH") {
    const body = await readJson(request);
    for (const [key, max] of [
      ["name", 200],
      ["altText", 500],
      ["caption", 1000],
      ["description", 5000],
    ])
      if (typeof body[key] !== "string" || body[key].length > max)
        fail("Check the media " + key + ".");
    if (!body.name.trim() || (current.type === "image" && !body.altText.trim()))
      fail("Name and image alt text are required.");
    if (
      !Array.isArray(body.tags) ||
      body.tags.length > 30 ||
      body.tags.some((t) => typeof t !== "string" || t.length > 80)
    )
      fail("Use up to 30 short tags.");
    await db
      .prepare(
        "UPDATE media SET name=?,alt_text=?,caption=?,description=?,tags=?,updated_at=? WHERE id=?",
      )
      .bind(
        body.name.trim(),
        body.altText.trim(),
        body.caption,
        body.description,
        JSON.stringify(body.tags),
        now(),
        id,
      )
      .run();
    return json(
      mediaRecord(
        await db.prepare("SELECT * FROM media WHERE id=?").bind(id).first(),
      ),
    );
  }
  if (id && !action && request.method === "DELETE") {
    const refs = await references(db, id);
    if (refs.length)
      fail(
        "This media is in use. Remove its references before deleting it.",
        409,
        { references: refs },
      );
    // Delete metadata only after blob deletion succeeds, so failure remains recoverable.
    await deleteResponsiveFiles(storage, current);
    if (variantKey(current)) await storage.delete(variantKey(current));
    if (current.storage_key) await storage.delete(current.storage_key);
    if (current.type === "model" && parse(current.metadata).posterStorageKey)
      await storage.delete(parse(current.metadata).posterStorageKey);
    await db.prepare("DELETE FROM media WHERE id=?").bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "Media endpoint not found." }, 404);
}
export async function serveMedia(request, env, id, identity, poster = false) {
  const accessStarted = performance.now();
  let record = await env.DB.prepare("SELECT * FROM media WHERE id=?")
    .bind(id)
    .first();
  if (!record) fail("Media not found.", 404);
  if (poster && record.type !== "model") fail("Model poster not found.", 404);
  // The Node/Vercel handler supplies this identity only after session validation.
  // Still verify it here; a header alone must not grant media access.
  const authenticated = request.headers.has("oai-authenticated-user-id");
  let refs = [];
  if (authenticated) await identity(request, env.DB);
  else {
    refs = await references(env.DB, id, { publicOnly: true });
    if (!refs.some((r) => r.published)) await identity(request, env.DB);
  }
  const accessDuration = performance.now() - accessStarted;
  const externalUrl = parse(record.metadata).externalUrl;
  if (!poster && externalUrl && !record.storage_key) {
    const target = new URL(externalUrl);
    if (target.protocol !== "https:" || target.username || target.password)
      fail("This external image URL is invalid.");
    return new Response(null, {
      status: 302,
      headers: { Location: target.href, "Cache-Control": "no-cache" },
    });
  }
  const negotiate =
    !poster && record.type === "image" && webpEligible(record.mime);
  const preferWebp = negotiate && acceptsWebp(request);
  const query = new URL(request.url).searchParams;
  const width = Number(query.get("width"));
  const optimizeStarted = performance.now();
  let resized;
  if (!poster && query.get("format") === "webp" && query.has("width")) {
    if (![320, 640, 960, 1280, 1920].includes(width))
      fail("Choose a supported image width.");
    try {
      resized = await responsiveFile(env, record, width);
    } catch {
      /* Retain original delivery on codec/storage failures. */
    }
  }
  if (preferWebp && !resized) {
    try {
      record = await ensureWebpVariant(env, record);
    } catch {
      /* Always retain original delivery when conversion is unavailable. */
    }
  }
  const key =
    poster && record.type === "model"
      ? parse(record.metadata).posterStorageKey
      : record.storage_key;
  const optimizeDuration = performance.now() - optimizeStarted;
  const storageStarted = performance.now();
  let optimized = resized?.key || (preferWebp ? variantKey(record) : "");
  let file = resized?.file;
  try {
    file ||= await env.STORAGE?.get(optimized || key);
  } catch (error) {
    if (!optimized) throw error;
  }
  if (!file && optimized) {
    optimized = "";
    file = await env.STORAGE?.get(key);
  }
  if (!file) fail("This media file is unavailable.", 404);
  const headers = {
    "Content-Type": poster
      ? "image/svg+xml"
      : optimized
        ? "image/webp"
        : record.mime,
    ...(negotiate &&
    query.get("format") !== "webp" &&
    query.get("format") !== "original"
      ? { Vary: "Accept" }
      : {}),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "Accept-Ranges": "bytes",
    "Server-Timing": `media-access;dur=${accessDuration.toFixed(1)}, media-optimize;dur=${optimizeDuration.toFixed(1)}, media-storage;dur=${(performance.now() - storageStarted).toFixed(1)}`,
  };
  // Explicit format avoids CDN content negotiation ambiguity. Short CDN TTL bounds
  // withdrawal visibility; replacement gets a new version immediately.
  const publicImage =
    !poster &&
    record.type === "image" &&
    refs.some((r) => r.published) &&
    query.get("v") === record.updated_at &&
    (query.get("format") === "original" ||
      (query.get("format") === "webp" && optimized)) &&
    !query.has("download") &&
    !query.has("themePreview") &&
    !request.headers.has("Cookie") &&
    !request.headers.has("Authorization") &&
    !request.headers.has("oai-authenticated-user-id") &&
    !request.headers.has("Range");
  if (publicImage) {
    headers["Cache-Control"] = "public, max-age=0, must-revalidate";
    headers["Vercel-CDN-Cache-Control"] = "public, max-age=60";
    headers["X-Colossal-Public-Media"] = "1";
  }
  const fingerprint = new TextEncoder().encode(optimized || key);
  const digest = await crypto.subtle.digest("SHA-256", fingerprint);
  headers.ETag =
    '"' +
    Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("") +
    '"';
  if (
    !request.headers.has("Range") &&
    request.headers
      .get("If-None-Match")
      ?.split(",")
      .map((tag) => tag.trim())
      .includes(headers.ETag)
  )
    return new Response(null, { status: 304, headers });
  if (new URL(request.url).searchParams.get("download") === "1") {
    const name = String(
      parse(record.metadata).originalFilename || record.name || "download",
    ).replace(/[\r\n"\\]/g, "_");
    headers["Content-Disposition"] =
      `attachment; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase())}`;
  }
  const buffer = await file.arrayBuffer();
  const range = request.headers.get("Range");
  if (range) {
    const m = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!m)
      return new Response(null, {
        status: 416,
        headers: {
          ...headers,
          "Content-Range": "bytes */" + buffer.byteLength,
        },
      });
    const start = m[1]
        ? Number(m[1])
        : Math.max(0, buffer.byteLength - Number(m[2])),
      end = m[1]
        ? Math.min(
            m[2] ? Number(m[2]) : buffer.byteLength - 1,
            buffer.byteLength - 1,
          )
        : buffer.byteLength - 1;
    if (start > end || start >= buffer.byteLength)
      return new Response(null, {
        status: 416,
        headers: {
          ...headers,
          "Content-Range": "bytes */" + buffer.byteLength,
        },
      });
    return new Response(
      request.method === "HEAD" ? null : buffer.slice(start, end + 1),
      {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${buffer.byteLength}`,
          "Content-Length": String(end - start + 1),
        },
      },
    );
  }
  return new Response(request.method === "HEAD" ? null : buffer, {
    headers: { ...headers, "Content-Length": String(buffer.byteLength) },
  });
}
