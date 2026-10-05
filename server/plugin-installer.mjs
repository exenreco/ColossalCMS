import { unzipSync } from "fflate";
import semver from "semver";
import { catalog } from "./catalog.mjs";
import {
  fail,
  json,
  now,
  all,
  parse,
  uploadForm,
  readJson,
} from "./v2-utils.mjs";
const VERSION = "0.0.1";
function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c ^= byte;
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
const safePath = (p) =>
  typeof p === "string" &&
  p.length < 240 &&
  !p.includes("..") &&
  !p.includes("\\") &&
  !p.includes(":") &&
  !p.startsWith("/") &&
  !/[\x00-\x1f]/.test(p);
/** Validate the central directory before decompression; reject traversal, symlinks, ZIP64 and bombs. */
export function inspectZip(
  bytes,
  manifestFile = "plugin.manifest.json",
  limits = {},
) {
  const maxEntry = limits.maxEntry || 16 * 1024 * 1024;
  const maxTotal = limits.maxTotal || 32 * 1024 * 1024;
  if (
    bytes.length < 22 ||
    bytes[0] !== 80 ||
    bytes[1] !== 75 ||
    bytes[2] !== 3 ||
    bytes[3] !== 4
  )
    fail("The file is not a valid ZIP archive.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) fail("The ZIP directory is damaged.");
  const count = view.getUint16(end + 10, true),
    directorySize = view.getUint32(end + 12, true),
    offset = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    count === 65535 ||
    count > 500 ||
    !count ||
    offset + directorySize > end
  )
    fail("Use a single-volume ZIP with no more than 500 files.");
  let cursor = offset,
    total = 0;
  const entries = [],
    names = new Set();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50)
      fail("The ZIP directory is damaged.");
    const flags = view.getUint16(cursor + 8, true),
      method = view.getUint16(cursor + 10, true),
      crc = view.getUint32(cursor + 16, true),
      compressed = view.getUint32(cursor + 20, true),
      size = view.getUint32(cursor + 24, true),
      n = view.getUint16(cursor + 28, true),
      extra = view.getUint16(cursor + 30, true),
      comment = view.getUint16(cursor + 32, true),
      mode = view.getUint32(cursor + 38, true) >>> 16,
      local = view.getUint32(cursor + 42, true);
    if (cursor + 46 + n + extra + comment > end)
      fail("The ZIP directory is truncated.");
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + n));
    if (
      !safePath(name) ||
      names.has(name.toLowerCase()) ||
      (mode & 0xf000) === 0xa000
    )
      fail("Unsafe or duplicate ZIP path: " + name);
    names.add(name.toLowerCase());
    if (flags & 1 || ![0, 8].includes(method))
      fail("Encrypted or unsupported ZIP compression.");
    total += size;
    if (
      size > maxEntry ||
      total > maxTotal ||
      (size > 1024 * 1024 && size / Math.max(1, compressed) > 200)
    )
      fail("The unpacked archive exceeds the safe size limit.");
    if (local + 30 > offset || view.getUint32(local, true) !== 0x04034b50)
      fail("The ZIP entry is damaged.");
    const localName = view.getUint16(local + 26, true),
      localExtra = view.getUint16(local + 28, true);
    if (
      local + 30 + localName + localExtra + compressed > offset ||
      decoder.decode(bytes.slice(local + 30, local + 30 + localName)) !== name
    )
      fail("The ZIP entry paths do not match.");
    entries.push({ name, size, crc });
    cursor += 46 + n + extra + comment;
  }
  let unpacked;
  try {
    unpacked = unzipSync(bytes);
  } catch {
    fail("The ZIP integrity check failed.");
  }
  for (const entry of entries) {
    const data = unpacked[entry.name];
    if (!data || data.length !== entry.size || crc32(data) !== entry.crc)
      fail("The ZIP checksum failed for " + entry.name);
  }
  if (manifestFile === null) return { files: unpacked };
  if (!unpacked[manifestFile])
    fail("Place " + manifestFile + " at the archive root.");
  let manifest;
  try {
    manifest = JSON.parse(decoder.decode(unpacked[manifestFile]));
  } catch {
    fail("The plugin manifest is not valid JSON.");
  }
  return { files: unpacked, manifest };
}
export function validateManifest(m) {
  if (
    !m ||
    typeof m !== "object" ||
    !/^([a-z][a-z0-9-]*\.)+[a-z][a-z0-9-]*$/.test(m.id) ||
    m.id.length > 120
  )
    fail("The manifest needs a valid reverse-domain plugin id.");
  if (catalog.some((p) => p.id === m.id) || m.isCore !== false)
    fail(
      "Uploaded plugins cannot replace bundled plugins or declare themselves core.",
    );
  for (const key of ["name", "description", "author", "license"])
    if (typeof m[key] !== "string" || !m[key].trim() || m[key].length > 500)
      fail("The manifest needs a valid " + key + ".");
  if (
    !semver.valid(m.version) ||
    !semver.validRange(m.requires?.colossal) ||
    !semver.satisfies(VERSION, m.requires.colossal)
  )
    fail("This plugin is not compatible with Colossal " + VERSION + ".");
  if (
    !Array.isArray(m.requires.plugins) ||
    m.requires.plugins.some((p) => typeof p !== "string" || p === m.id)
  )
    fail("Declare a valid requires.plugins dependency list.");
  if (
    !m.admin?.menu ||
    !/^\/admin\/[a-z][a-z0-9-]*$/.test(m.admin.menu.path) ||
    typeof m.admin.entryComponent !== "string" ||
    typeof m.admin.menu.label !== "string" ||
    !Number.isInteger(m.admin.menu.order) ||
    (m.admin.menu.group !== undefined &&
      !["main", "system"].includes(m.admin.menu.group))
  )
    fail(
      "The manifest needs an admin entry component, menu label, path, and integer order.",
    );
  if (
    !Array.isArray(m.frontend?.routes) ||
    m.frontend.routes.some(
      (r) =>
        !r ||
        !/^[a-z][a-z0-9-]*$/.test(r.path) ||
        typeof r.component !== "string" ||
        [
          "admin",
          "api",
          "callback",
          "signin-with-chatgpt",
          "signout-with-chatgpt",
        ].includes(r.path),
    )
  )
    fail("Frontend routes must have a literal page path and a component name.");
  if (!safePath(m.runtime?.entry) || !m.runtime.entry.endsWith(".mjs"))
    fail("Declare runtime.entry pointing to a browser ES module (.mjs).");
  return m;
}
export async function uploadedPlugins(db) {
  const rows = await all(
    db,
    "SELECT p.*,s.active,s.installed FROM plugin_packages p JOIN plugins s ON s.id=p.id",
  );
  return rows.map((r) => ({
    ...parse(r.manifest),
    active: !!r.active,
    installed: !!r.installed,
    uploaded: true,
    revision: r.current,
    previousRevision: r.previous,
    pending: !!r.pending,
  }));
}
async function deps(db, m) {
  for (const id of m.requires.plugins) {
    const dep = await db
      .prepare("SELECT installed,active FROM plugins WHERE id=?")
      .bind(id)
      .first();
    if (!dep?.installed) fail("Install the required plugin first: " + id);
  }
}
async function removeVersion(env, revision) {
  if (!revision) return;
  const v = await env.DB.prepare("SELECT files FROM plugin_versions WHERE id=?")
    .bind(revision)
    .first();
  if (v) {
    await env.STORAGE.delete(parse(v.files, []));
    await env.DB.prepare("DELETE FROM plugin_versions WHERE id=?")
      .bind(revision)
      .run();
  }
}
export async function installPlugin(request, env) {
  const db = env.DB;
  if (!env.STORAGE) fail("Plugin storage is unavailable.", 503);
  const limit = Math.min(
    Number(env.MAX_PLUGIN_UPLOAD_BYTES) || 25 * 1024 * 1024,
    25 * 1024 * 1024,
  );
  const form = await uploadForm(request, limit);
  const file = form.get("file");
  if (!file || !file.name?.toLowerCase().endsWith(".zip"))
    fail("Choose a plugin ZIP file.");
  if (
    ![
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
      "",
    ].includes(file.type)
  )
    fail("The uploaded file must have a ZIP MIME type.");
  if (file.size > limit)
    fail("Plugin ZIP files must be 25 MB or smaller.", 413);
  const { files, manifest } = inspectZip(
    new Uint8Array(await file.arrayBuffer()),
  );
  validateManifest(manifest);
  await deps(db, manifest);
  if (!files[manifest.runtime.entry])
    fail("The runtime entry module is missing from the archive.");
  const existing = await db
    .prepare("SELECT * FROM plugin_packages WHERE id=?")
    .bind(manifest.id)
    .first();
  if (existing?.pending)
    fail(
      "Activate or discard the pending version before uploading another.",
      409,
    );
  if (
    existing &&
    semver.lte(manifest.version, parse(existing.manifest).version)
  )
    fail(
      "Upload a newer version, or use rollback for the previous version.",
      409,
    );
  const others = [...catalog, ...(await uploadedPlugins(db))].filter(
    (p) => p.id !== manifest.id,
  );
  if (others.some((p) => p.admin.menu.path === manifest.admin.menu.path))
    fail("Another plugin already uses this admin path.", 409);
  const content = await all(db, "SELECT slug FROM content");
  if (
    manifest.frontend.routes.some(
      (r) =>
        content.some((c) => c.slug === r.path) ||
        others.some((p) => p.frontend.routes.some((q) => q.path === r.path)),
    )
  )
    fail(
      "A frontend route conflicts with existing content or another plugin.",
      409,
    );
  const revision = crypto.randomUUID(),
    prefix = "plugins/" + manifest.id + "/" + revision + "/",
    keys = [];
  try {
    for (const [name, data] of Object.entries(files)) {
      if (name.endsWith("/")) continue;
      const key = prefix + name;
      await env.STORAGE.put(key, data);
      keys.push(key);
    }
    const batch = [
      db
        .prepare(
          "INSERT INTO plugin_versions (id,plugin_id,manifest,files,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(
          revision,
          manifest.id,
          JSON.stringify(manifest),
          JSON.stringify(keys),
          now(),
        ),
    ];
    if (existing)
      batch.push(
        db
          .prepare(
            "UPDATE plugin_packages SET manifest=?,current=?,previous=?,pending=? WHERE id=?",
          )
          .bind(
            JSON.stringify(manifest),
            revision,
            existing.current,
            JSON.stringify({
              previous: existing.current,
              older: existing.previous,
              manifest: existing.manifest,
              active: (
                await db
                  .prepare("SELECT active FROM plugins WHERE id=?")
                  .bind(manifest.id)
                  .first()
              ).active,
            }),
            manifest.id,
          ),
      );
    else
      batch.push(
        db
          .prepare(
            "INSERT INTO plugin_packages (id,manifest,current,previous,pending,installed_at) VALUES (?,?,?,?,?,?)",
          )
          .bind(
            manifest.id,
            JSON.stringify(manifest),
            revision,
            null,
            JSON.stringify({ new: true }),
            now(),
          ),
      );
    batch.push(
      db
        .prepare(
          "INSERT INTO plugins (id,active,installed) VALUES (?,0,1) ON CONFLICT(id) DO UPDATE SET active=0,installed=1",
        )
        .bind(manifest.id),
    );
    await db.batch(batch);
  } catch (e) {
    await env.STORAGE.delete(keys);
    throw e;
  }
  return json(
    {
      plugin: (await uploadedPlugins(db)).find((p) => p.id === manifest.id),
      message:
        "Validated and installed inactive. Uploaded code execution is disabled.",
    },
    201,
  );
}
export async function changeUploadedPlugin(request, env, id, action) {
  const db = env.DB,
    row = await db
      .prepare("SELECT * FROM plugin_packages WHERE id=?")
      .bind(id)
      .first();
  if (!row) fail("Plugin not found.", 404);
  const manifest = parse(row.manifest);
  if (["deactivate", "uninstall", "rollback"].includes(action)) {
    const dependent = (await uploadedPlugins(db)).find(
      (p) => p.active && p.requires.plugins.includes(id),
    );
    if (dependent) fail("Deactivate " + dependent.name + " first.", 409);
  }
  if (action === "activate") {
    fail(
      "Uploaded plugin activation is disabled pending approval of trusted code execution.",
      403,
    );
  } else if (action === "deactivate")
    await db.prepare("UPDATE plugins SET active=0 WHERE id=?").bind(id).run();
  else if (action === "discard") {
    const pending = parse(row.pending);
    if (!row.pending) fail("There is no pending installation.");
    if (pending.new)
      await db.batch([
        db.prepare("DELETE FROM plugins WHERE id=?").bind(id),
        db.prepare("DELETE FROM plugin_packages WHERE id=?").bind(id),
      ]);
    else
      await db.batch([
        db
          .prepare(
            "UPDATE plugin_packages SET current=?,previous=?,manifest=?,pending=NULL WHERE id=?",
          )
          .bind(pending.previous, pending.older || null, pending.manifest, id),
        db
          .prepare("UPDATE plugins SET active=? WHERE id=?")
          .bind(pending.active, id),
      ]);
    await removeVersion(env, row.current);
  } else if (action === "rollback") {
    if (!row.previous) fail("No previous version is available.");
    const v = await db
      .prepare("SELECT manifest FROM plugin_versions WHERE id=?")
      .bind(row.previous)
      .first();
    if (!v) fail("Previous version files are unavailable.", 409);
    await db.batch([
      db
        .prepare(
          "UPDATE plugin_packages SET current=?,previous=?,manifest=?,pending=NULL WHERE id=?",
        )
        .bind(row.previous, row.current, v.manifest, id),
      db.prepare("UPDATE plugins SET active=0 WHERE id=?").bind(id),
    ]);
  } else if (action === "uninstall") {
    await db.batch([
      db.prepare("DELETE FROM plugins WHERE id=?").bind(id),
      db.prepare("DELETE FROM plugin_packages WHERE id=?").bind(id),
    ]);
    const versions = await all(
      db,
      "SELECT id FROM plugin_versions WHERE plugin_id=?",
      id,
    );
    for (const v of versions) await removeVersion(env, v.id);
  } else fail("Unknown plugin action.");
  return json({ ok: true });
}
export async function servePlugin(request, env, id, revision, file, identity) {
  if (!safePath(file)) fail("Invalid plugin file path.", 400);
  const row = await env.DB.prepare(
    "SELECT p.*,s.active FROM plugin_packages p JOIN plugins s ON s.id=p.id WHERE p.id=?",
  )
    .bind(id)
    .first();
  if (!row || ![row.current, row.previous].includes(revision))
    fail("Plugin version not found.", 404);
  if (!row.active || row.current !== revision) {
    const user = await identity(request, env.DB);
    if (user.role !== "admin") fail("Administrator access required.", 403);
  }
  const object = await env.STORAGE?.get(
    "plugins/" + id + "/" + revision + "/" + file,
  );
  if (!object) fail("Plugin file not found.", 404);
  const ext = file.split(".").pop();
  const type =
    {
      mjs: "text/javascript",
      js: "text/javascript",
      css: "text/css",
      json: "application/json",
      png: "image/png",
      jpg: "image/jpeg",
      webp: "image/webp",
    }[ext] || "application/octet-stream";
  return new Response(object.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
