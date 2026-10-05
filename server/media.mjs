import { imageSize } from "image-size";
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
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
};
export function inspectMedia(bytes, filename, mime) {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["gltf", "glb", "zip"].includes(ext))
    return inspectModel(bytes, filename);
  const expected = MIME[ext];
  if (!expected)
    fail(
      "Supported files: PNG, JPG, GIF, WebP, SVG, MP3, WAV, OGG, MP4, and WebM.",
    );
  if (
    mime &&
    mime !== expected &&
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
      /<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|<\s*(script|foreignObject|iframe|object|embed|animate|set)\b|\bon\w+\s*=|javascript\s*:|data\s*:|url\s*\(/i.test(
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
      processEntities: false,
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
          if (
            /^on/i.test(attr) ||
            attr === "style" ||
            ((attr === "href" || attr === "xlink:href") &&
              !String(val).startsWith("#"))
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
  const type = expected.split("/")[0];
  let metadata = { size: bytes.length };
  if (type === "image") {
    try {
      const size = imageSize(bytes);
      metadata = { ...metadata, width: size.width, height: size.height };
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
    if (info.type !== "model" && file.size > 25 * 1024 * 1024)
      fail("Images, audio and video must be 25 MB or smaller.", 413);
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
      throw e;
    }
    if (current) await storage.delete(current.storage_key);
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
    await storage.delete(current.storage_key);
    if (current.type === "model" && parse(current.metadata).posterStorageKey)
      await storage.delete(parse(current.metadata).posterStorageKey);
    await db.prepare("DELETE FROM media WHERE id=?").bind(id).run();
    return json({ ok: true });
  }
  return json({ error: "Media endpoint not found." }, 404);
}
export async function serveMedia(request, env, id, identity, poster = false) {
  const record = await env.DB.prepare("SELECT * FROM media WHERE id=?")
    .bind(id)
    .first();
  if (!record) fail("Media not found.", 404);
  if (poster && record.type !== "model") fail("Model poster not found.", 404);
  const refs = await references(env.DB, id);
  if (!refs.some((r) => r.published)) await identity(request, env.DB);
  const file = await env.STORAGE?.get(
    poster && record.type === "model"
      ? parse(record.metadata).posterStorageKey
      : record.storage_key,
  );
  if (!file) fail("This media file is unavailable.", 404);
  const headers = {
    "Content-Type": poster ? "image/svg+xml" : record.mime,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-cache",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "Accept-Ranges": "bytes",
  };
  const buffer = await file.arrayBuffer();
  const range = request.headers.get("Range");
  if (range) {
    const m = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!m)
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": "bytes */" + buffer.byteLength },
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
        headers: { "Content-Range": "bytes */" + buffer.byteLength },
      });
    return new Response(buffer.slice(start, end + 1), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${buffer.byteLength}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  return new Response(request.method === "HEAD" ? null : buffer, {
    headers: { ...headers, "Content-Length": String(buffer.byteLength) },
  });
}
