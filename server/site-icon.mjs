import { serveMedia } from "./media.mjs";
import { parse } from "./v2-utils.mjs";

const icons = new WeakMap();

/** A stable, crawlable alias for the configured Site Icon, independent of SEO. */
export async function serveSiteIcon(request, env, identity) {
  const settings = parse(
    (await env.DB.prepare("SELECT value FROM config WHERE id='site'").first())
      ?.value,
  );
  const id = settings.siteIconId;
  if (!id)
    return env.ASSETS.fetch(
      new Request(new URL("/favicon.svg", request.url), request),
    );
  const record = await env.DB.prepare("SELECT * FROM media WHERE id=?")
    .bind(id)
    .first();
  if (!record || record.type !== "image")
    return new Response("Site icon unavailable.", { status: 404 });
  const key = `${id}:${record.updated_at}:${record.storage_key}`;
  const database = env.DB.cacheIdentity || env.DB;
  let icon = icons.get(database);
  if (!icon || icon.key !== key) {
    const url = new URL(
      `/api/media/${encodeURIComponent(id)}/file?format=original`,
      request.url,
    );
    const headers = new Headers(request.headers);
    for (const name of ["If-None-Match", "If-Modified-Since", "Range"])
      headers.delete(name);
    const source = await serveMedia(
      new Request(url, { headers }),
      env,
      id,
      identity,
    );
    if (!source.ok) return source;
    const original = new Uint8Array(await source.arrayBuffer());
    let bytes = original,
      mime = source.headers.get("Content-Type");
    if (env.IMAGE_OPTIMIZER?.toIcon) {
      try {
        bytes = await env.IMAGE_OPTIMIZER.toIcon(original);
        mime = "image/png";
      } catch {
        /* Keep the authored icon available if the codec is unavailable. */
      }
    }
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    icon = {
      key,
      bytes,
      mime,
      etag:
        '"' +
        Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("") +
        '"',
    };
    icons.set(database, icon);
  }
  const headers = {
    "Content-Type": icon.mime,
    "Cache-Control": "public, max-age=0, must-revalidate",
    ETag: icon.etag,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  if (
    request.headers
      .get("If-None-Match")
      ?.split(",")
      .map((s) => s.trim())
      .includes(icon.etag)
  )
    return new Response(null, { status: 304, headers });
  return new Response(request.method === "HEAD" ? null : icon.bytes, {
    headers,
  });
}
