import { json, readJson, parse } from "../../server/v2-utils.mjs";
import {
  CACHE_ID,
  CACHE_SLOTS,
  MAX_ENTRY_BYTES,
  defaults,
  validateSettings,
} from "./config.mjs";
// Bundled deployments share a build namespace; source-mode restarts get a fresh one.
const build =
  typeof __CMS_CACHE_BUILD_ID__ === "undefined"
    ? crypto.randomUUID()
    : __CMS_CACHE_BUILD_ID__;
const instances = new WeakMap();
const instance = (db) => {
  db = db.cacheIdentity || db;
  if (!instances.has(db))
    instances.set(db, {
      memory: new Map(),
      hits: 0,
      misses: 0,
      bypasses: 0,
      errors: 0,
    });
  return instances.get(db);
};
const settingsRow = (db) =>
  db.prepare("SELECT value FROM config WHERE id='response-cache'").first();
export async function policy(db) {
  const [plugin, row] = await Promise.all([
    db
      .prepare("SELECT installed,active FROM plugins WHERE id=?")
      .bind(CACHE_ID)
      .first(),
    settingsRow(db),
  ]);
  const saved = parse(row?.value);
  return {
    ...validateSettings({ ...defaults, ...saved }),
    active: !!(plugin?.installed && plugin?.active),
    generation: saved.generation || "initial",
    purgedAt: saved.purgedAt || "",
  };
}
export async function purge(db, settings) {
  const prior = parse((await settingsRow(db))?.value);
  const next = {
    ...validateSettings(settings || { ...defaults, ...prior }),
    generation: crypto.randomUUID(),
    purgedAt: new Date().toISOString(),
  };
  // Rotate before deleting: an in-flight old render can never become a valid new entry.
  await db
    .prepare(
      "INSERT INTO config (id,value) VALUES ('response-cache',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
    )
    .bind(JSON.stringify(next))
    .run();
  instance(db).memory.clear();
  await db.prepare("DELETE FROM response_cache").run();
  return next;
}
export function cacheCandidate(request) {
  const url = new URL(request.url),
    path = url.pathname;
  if (
    !["GET", "HEAD"].includes(request.method) ||
    request.headers.has("Cookie") ||
    request.headers.has("Authorization") ||
    request.headers.has("oai-authenticated-user-id") ||
    request.headers.has("Range") ||
    /no-cache|no-store|max-age=0/i.test(
      request.headers.get("Cache-Control") || "",
    )
  )
    return null;
  if (
    path.startsWith("/admin") ||
    [
      "/login",
      "/setup",
      "/healthz",
      "/signin-with-chatgpt",
      "/site-icon",
    ].includes(path)
  )
    return null;
  const api = ["/api/themes/render", "/api/public"].includes(path);
  if (
    (path.startsWith("/api/") && !api) ||
    (/\.[a-z0-9]+$/i.test(path) && path !== "/index.html")
  )
    return null;
  for (const [key, value] of url.searchParams) {
    if (key === "page" && /^[1-9]\d{0,2}$/.test(value)) continue;
    if (
      api &&
      path === "/api/themes/render" &&
      key === "path" &&
      /^\/(?!\/)[^?#\\]*$/.test(value) &&
      value.length < 500 &&
      !value.startsWith("/admin")
    )
      continue;
    return null;
  }
  const resolvedPath =
    api && path === "/api/themes/render"
      ? url.searchParams.get("path") || "/"
      : path;
  if (resolvedPath === "/search" || resolvedPath.startsWith("/search/"))
    return null;
  url.searchParams.sort();
  return {
    url,
    api,
    path:
      api && path === "/api/themes/render"
        ? url.searchParams.get("path") || "/"
        : path,
  };
}
const hash = async (text) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
const tagged = (response, state, age) => {
  const headers = new Headers(response.headers);
  headers.set("X-Colossal-Cache", state);
  if (age !== undefined) headers.set("Age", String(age));
  // This is an origin cache. Browsers/CDNs must revalidate so purges and analytics work.
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
async function hit(request, entry, context) {
  if (
    request.method === "GET" &&
    !new URL(request.url).pathname.startsWith("/api/") &&
    entry.metadata?.rendered
  )
    await context.recordView?.(entry.metadata.rendered).catch(() => {});
  return tagged(
    new Response(request.method === "HEAD" ? null : entry.body, {
      status: entry.status,
      headers: entry.headers,
    }),
    "HIT",
    Math.max(0, Math.floor((Date.now() - entry.createdAt) / 1000)),
  );
}
function remember(state, key, entry) {
  state.memory.delete(key);
  state.memory.set(key, entry);
  while (state.memory.size > CACHE_SLOTS)
    state.memory.delete(state.memory.keys().next().value);
}
const mutatesSite = (request) =>
  !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
  /^\/api\/(?:admin|themes|maintenance|media|plugins)(?:\/|$)/.test(
    new URL(request.url).pathname,
  ) &&
  !/\/(?:render|preview|preferences|batch\/preview)$/.test(
    new URL(request.url).pathname,
  );
export async function cacheRequest(context, next) {
  const { request, env } = context,
    db = env.DB;
  if (!db) return next();
  if (mutatesSite(request)) {
    const response = await next();
    if (response.ok || response.status >= 500) {
      try {
        if ((await policy(db)).active) await purge(db);
      } catch {
        instance(db).errors++;
      }
    }
    return response;
  }
  const candidate = cacheCandidate(request);
  if (!candidate) return next();
  const state = instance(db);
  let config;
  try {
    config = await policy(db);
  } catch {
    state.errors++;
    return next();
  }
  if (
    !config.active ||
    !config.enabled ||
    (candidate.api && !config.cacheApi) ||
    (!candidate.api && !config.cachePages) ||
    config.excludedPaths.some(
      (path) =>
        candidate.path === path ||
        candidate.path.startsWith(path.endsWith("/") ? path : path + "/"),
    )
  ) {
    state.bypasses++;
    return next();
  }
  const key = await hash(
    build + "\n" + config.generation + "\n" + candidate.url.href,
  );
  const slot = String(parseInt(key.slice(0, 8), 16) % CACHE_SLOTS);
  let entry = state.memory.get(key);
  if (entry && entry.expiresAt <= Date.now()) {
    state.memory.delete(key);
    entry = null;
  }
  try {
    if (!entry) {
      const row = await db
        .prepare(
          "SELECT cache_key,generation,payload,expires_at FROM response_cache WHERE id=?",
        )
        .bind(slot)
        .first();
      if (
        row?.cache_key === key &&
        row.generation === config.generation &&
        Date.parse(row.expires_at) > Date.now()
      )
        entry = JSON.parse(row.payload);
    }
    if (entry && entry.expiresAt > Date.now()) {
      remember(state, key, entry);
      state.hits++;
      return await hit(request, entry, context);
    }
  } catch {
    state.errors++;
  }
  state.misses++;
  const response = await next(),
    metadata = context.responseMetadata?.(response);
  if (
    request.method !== "GET" ||
    response.status !== 200 ||
    !metadata?.cacheable ||
    response.headers.has("Set-Cookie") ||
    /private/i.test(response.headers.get("Cache-Control") || "") ||
    (response.headers.get("Vary") &&
      !/^accept-encoding$/i.test(response.headers.get("Vary")))
  )
    return tagged(response, "BYPASS");
  try {
    const body = await response.clone().text(),
      createdAt = Date.now();
    if (new TextEncoder().encode(body).length > MAX_ENTRY_BYTES)
      return tagged(response, "BYPASS");
    // Scheduled posts must become visible at their publication time, even without a write.
    const scheduled = await db
      .prepare(
        "SELECT publish_at FROM content WHERE status='scheduled' AND publish_at>? ORDER BY publish_at LIMIT 1",
      )
      .bind(new Date().toISOString())
      .first();
    const expiresAt = Math.min(
      createdAt + config.ttl * 1000,
      scheduled?.publish_at ? Date.parse(scheduled.publish_at) : Infinity,
    );
    entry = {
      body,
      status: response.status,
      headers: [...response.headers].filter(
        ([key]) =>
          ![
            "content-length",
            "content-encoding",
            "etag",
            "age",
            "x-colossal-cache",
          ].includes(key),
      ),
      metadata,
      createdAt,
      expiresAt,
    };
    const payload = JSON.stringify(entry);
    if (new TextEncoder().encode(payload).length > MAX_ENTRY_BYTES)
      return tagged(response, "BYPASS");
    await db
      .prepare(
        "INSERT INTO response_cache (id,cache_key,generation,payload,expires_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET cache_key=excluded.cache_key,generation=excluded.generation,payload=excluded.payload,expires_at=excluded.expires_at",
      )
      .bind(
        slot,
        key,
        config.generation,
        payload,
        new Date(expiresAt).toISOString(),
      )
      .run();
    remember(state, key, entry);
    return tagged(response, "MISS");
  } catch {
    state.errors++;
    return tagged(response, "ERROR");
  }
}
export default {
  id: CACHE_ID,
  request: cacheRequest,
  routes: [
    {
      scope: "admin",
      prefix: "/api/admin/caching",
      methods: ["GET", "POST"],
      admin: true,
      async handle({ request, db, path, log }) {
        if (
          path !== "/api/admin/caching" &&
          path !== "/api/admin/caching/purge"
        )
          return null;
        if (request.method === "GET") {
          const config = await policy(db),
            rows = (
              await db
                .prepare("SELECT payload,expires_at FROM response_cache")
                .all()
            ).results;
          const live = rows.filter(
            (row) => Date.parse(row.expires_at) > Date.now(),
          );
          const state = instance(db);
          return json({
            settings: validateSettings(config),
            stats: {
              entries: live.length,
              bytes: live.reduce(
                (sum, row) =>
                  sum + new TextEncoder().encode(row.payload).length,
                0,
              ),
              maxEntries: CACHE_SLOTS,
              hits: state.hits,
              misses: state.misses,
              bypasses: state.bypasses,
              errors: state.errors,
              purgedAt: config.purgedAt,
            },
          });
        }
        if (path.endsWith("/purge")) await purge(db);
        else await purge(db, validateSettings(await readJson(request, 20000)));
        await log(
          path.endsWith("/purge")
            ? "Purged public response cache"
            : "Updated Caching settings and purged cached responses",
        );
        return json({ ok: true });
      },
    },
  ],
};
