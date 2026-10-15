import bcrypt from "bcryptjs";
import { fail, json, readJson } from "./v2-utils.mjs";
const validId = (id) => typeof id === "string" && /^[a-f0-9-]{36}$/.test(id);
function passwordValue(value) {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    new TextEncoder().encode(value).length > 72
  )
    fail("Use a password of at least 8 characters and at most 72 UTF-8 bytes.");
  return value;
}
const metadata = (row) => ({
  id: row.id,
  name: row.name,
  hasPassword: !!row.password_hash,
});

export async function protectedFileAdmin(request, env, user, id = "") {
  if (!["admin", "editor"].includes(user?.role))
    fail("Editor access is required.", 403);
  if (id && !validId(id)) fail("Protected file not found.", 404);
  const db = env.DB;
  const current = id
    ? await db
        .prepare("SELECT * FROM protected_files WHERE id=?")
        .bind(id)
        .first()
    : null;
  if (id && !current) fail("Protected file not found.", 404);
  if (request.method === "GET" && current) return json(metadata(current));
  if (request.method !== "POST") fail("Method not allowed.", 405);
  const body = await readJson(request, 4096);
  const password = passwordValue(body.password);
  const passwordHash = await bcrypt.hash(password, 12);
  const time = new Date().toISOString();
  if (current) {
    await db
      .prepare(
        "UPDATE protected_files SET password_hash=?,updated_at=? WHERE id=?",
      )
      .bind(passwordHash, time, id)
      .run();
    return json(metadata(current));
  }
  if (typeof body.mediaId !== "string" || body.mediaId.length > 150)
    fail("Choose a media file.");
  const source = await db
    .prepare("SELECT * FROM media WHERE id=?")
    .bind(body.mediaId)
    .first();
  if (!source?.storage_key)
    fail("Choose an uploaded media file. External URLs cannot be copied.");
  const file = await env.STORAGE?.get(source.storage_key);
  if (!file) fail("The source file is unavailable.", 404);
  if (file.size > 25 * 1024 * 1024)
    fail("Protected copies support files up to 25 MB.");
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > 25 * 1024 * 1024)
    fail("Protected copies support files up to 25 MB.");
  const copyId = crypto.randomUUID(),
    key = "protected-files/" + crypto.randomUUID();
  await env.STORAGE.put(key, bytes);
  try {
    await db
      .prepare(
        "INSERT INTO protected_files(id,source_media_id,storage_key,name,mime,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
      )
      .bind(
        copyId,
        source.id,
        key,
        source.name,
        source.mime,
        passwordHash,
        time,
        time,
      )
      .run();
  } catch (error) {
    await env.STORAGE.delete(key).catch(() => {});
    throw error;
  }
  return json({ id: copyId, name: source.name, hasPassword: true }, 201);
}

export async function protectedFileDownload(request, env, id) {
  if (request.method !== "POST")
    fail("Submit the password to download this file.", 405);
  if (request.headers.get("Origin") !== new URL(request.url).origin)
    fail("Downloads must start from this website.", 403);
  if (!validId(id)) fail("Protected file not found.", 404);
  const db = env.DB,
    body = await readJson(request, 4096);
  if (
    typeof body.password !== "string" ||
    !body.password ||
    new TextEncoder().encode(body.password).length > 72
  )
    fail("Enter the file password.");
  const record = await db
    .prepare("SELECT * FROM protected_files WHERE id=?")
    .bind(id)
    .first();
  if (!record) fail("Protected file not found.", 404);
  const ip =
    request.headers.get("x-cms-client-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(id + "|" + ip),
  );
  const attemptId = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const now = new Date().toISOString(),
    expires = new Date(Date.now() + 15 * 60000).toISOString();
  await db
    .prepare("DELETE FROM protected_file_attempts WHERE expires_at<?")
    .bind(now)
    .run();
  await db
    .prepare(
      "INSERT OR IGNORE INTO protected_file_attempts(id,attempts,expires_at) VALUES (?,0,?)",
    )
    .bind(attemptId, expires)
    .run();
  const reserved = await db
    .prepare(
      "UPDATE protected_file_attempts SET attempts=attempts+1 WHERE id=? AND attempts<10 AND expires_at>=?",
    )
    .bind(attemptId, now)
    .run();
  if (Number(reserved.meta?.changes ?? reserved.changes) !== 1)
    fail("Too many download attempts. Try again in 15 minutes.", 429);
  if (!(await bcrypt.compare(body.password, record.password_hash)))
    fail("Incorrect password.", 401);
  const file = await env.STORAGE?.get(record.storage_key);
  if (!file) fail("This protected file is unavailable.", 404);
  const bytes = await file.arrayBuffer();
  const filename = String(record.name || "download")
    .replace(/[\u0000-\u001f\u007f"\\/]/g, "_")
    .slice(0, 180);
  return new Response(bytes, {
    headers: {
      "Content-Type": record.mime || "application/octet-stream",
      "Content-Disposition":
        "attachment; filename=\"download\"; filename*=UTF-8''" +
        encodeURIComponent(filename).replace(
          /['()*]/g,
          (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase(),
        ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
