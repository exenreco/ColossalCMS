import test from "node:test";
import assert from "node:assert/strict";
import caching, {
  cacheCandidate,
  purge,
  policy,
} from "../plugins/caching/server.mjs";
import {
  CACHE_ID,
  defaults,
  validateSettings,
} from "../plugins/caching/config.mjs";
import { createPluginRegistry } from "../server/plugin-registry.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { parseSql } from "../scripts/mongo-database.mjs";
import worker from "../server/worker.mjs";
function adapter(local) {
  return {
    prepare(sql) {
      const statement = (args = []) => ({
        bind: (...args) => statement(args),
        first: () => {
          parseSql(sql, args);
          return local
            .prepare(sql)
            .bind(...args)
            .first();
        },
        all: () => {
          parseSql(sql, args);
          return local
            .prepare(sql)
            .bind(...args)
            .all();
        },
        run: () => {
          parseSql(sql, args);
          return local
            .prepare(sql)
            .bind(...args)
            .run();
        },
      });
      return statement();
    },
  };
}
async function fixture() {
  const local = localDatabase(),
    db = adapter(local),
    registry = createPluginRegistry([caching]);
  await db
    .prepare("INSERT INTO plugins (id,active,installed) VALUES (?,1,1)")
    .bind(CACHE_ID)
    .run();
  let renders = 0,
    views = 0;
  const request = (path = "/about", options = {}) =>
    new Request("https://cms.test" + path, options);
  const render = (request, content = "Rendered page", headers = {}) =>
    registry.request(
      {
        request,
        env: { DB: db },
        recordView: async () => {
          views++;
        },
      },
      async () => {
        renders++;
        return registry.withResponseMetadata(
          new Response(content, {
            headers: { "Content-Type": "text/html", ...headers },
          }),
          {
            cacheable: true,
            rendered: { viewContentId: "about", status: 200 },
          },
        );
      },
    );
  return {
    local,
    db,
    registry,
    request,
    render,
    get renders() {
      return renders;
    },
    get views() {
      return views;
    },
  };
}
test("persistent cache reuses responses across instances and counts cached document views without caching render API views", async () => {
  const f = await fixture();
  try {
    const first = await f.render(f.request());
    assert.equal(first.headers.get("X-Colossal-Cache"), "MISS");
    assert.equal(await first.text(), "Rendered page");
    const second = await f.render(f.request());
    assert.equal(second.headers.get("X-Colossal-Cache"), "HIT");
    assert.equal(f.renders, 1);
    assert.equal(f.views, 1);
    assert.equal(second.headers.get("Cache-Control"), "no-store");
    const secondInstance = adapter(f.local);
    const persistent = await f.registry.request(
      {
        request: f.request(),
        env: { DB: secondInstance },
        recordView: async () => {},
      },
      () => {
        throw Error("A durable hit must not render.");
      },
    );
    assert.equal(persistent.headers.get("X-Colossal-Cache"), "HIT");
    const head = await f.render(f.request("/about", { method: "HEAD" }));
    assert.equal(await head.text(), "");
    assert.equal(f.views, 1);
    await f.render(f.request("/api/themes/render?path=/about"));
    await f.render(f.request("/api/themes/render?path=/about"));
    assert.equal(f.views, 1);
  } finally {
    await f.local.close();
  }
});
test("cache expires on time and before scheduled publication", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: new Date("2026-10-16T12:00:00Z"),
  });
  const f = await fixture();
  try {
    await purge(f.db, { ...defaults, ttl: 30 });
    await f.render(f.request());
    t.mock.timers.tick(31000);
    assert.equal(
      (await f.render(f.request())).headers.get("X-Colossal-Cache"),
      "MISS",
    );
    await f.db
      .prepare(
        "INSERT INTO content (id,kind,title,slug,excerpt,body,status,publish_at,updated_at,author,details) VALUES ('scheduled','post','Scheduled','scheduled','','','scheduled',?,'2026-10-16','owner','{}')",
      )
      .bind(new Date(Date.now() + 10000).toISOString())
      .run();
    await f.render(f.request("/other"));
    t.mock.timers.tick(11000);
    assert.equal(
      (await f.render(f.request("/other"))).headers.get("X-Colossal-Cache"),
      "MISS",
    );
  } finally {
    await f.local.close();
  }
});
test("authenticated, private, preview, query, dynamic, media, range and search requests bypass caching", async () => {
  const f = await fixture();
  try {
    for (const [path, headers] of [
      ["/admin/pages", {}],
      ["/login", {}],
      ["/setup", {}],
      ["/about?themePreview=secret", {}],
      ["/search?q=hello", {}],
      ["/search", {}],
      ["/api/themes/render?path=/search", {}],
      ["/about?unknown=1", {}],
      ["/api/messaging/form", {}],
      ["/api/protected-files/id/download", {}],
      ["/api/media/id/file", {}],
      ["/about", { Cookie: "cms_session=secret" }],
      ["/about", { Authorization: "Bearer secret" }],
      ["/about", { "oai-authenticated-user-id": "owner" }],
      ["/about", { Range: "bytes=0-100" }],
      ["/about", { "Cache-Control": "no-cache" }],
    ]) {
      assert.equal(cacheCandidate(f.request(path, { headers })), null);
      const result = await f.render(f.request(path, { headers }));
      assert.notEqual(result.headers.get("X-Colossal-Cache"), "HIT");
    }
    for (const headers of [
      { "Set-Cookie": "secret=value" },
      { "Cache-Control": "private" },
      { Vary: "Cookie" },
    ]) {
      const result = await f.render(f.request("/private"), "private", headers);
      assert.equal(result.headers.get("X-Colossal-Cache"), "BYPASS");
    }
    assert.equal(
      (
        await f.db
          .prepare("SELECT COUNT(*) AS count FROM response_cache")
          .first()
      ).count,
      0,
    );
  } finally {
    await f.local.close();
  }
});
test("purges invalidate all instances and stale in-flight renders cannot resurrect cached content", async () => {
  const f = await fixture();
  try {
    await f.render(f.request());
    const secondDb = adapter(f.local);
    await purge(secondDb);
    assert.equal(
      (await f.render(f.request(), "After purge")).headers.get(
        "X-Colossal-Cache",
      ),
      "MISS",
    );
    let release, started;
    const ready = new Promise((resolve) => (started = resolve));
    const pending = f.registry.request(
      { request: f.request("/pending"), env: { DB: f.db } },
      async () => {
        started();
        await new Promise((resolve) => (release = resolve));
        return f.registry.withResponseMetadata(new Response("Old generation"), {
          cacheable: true,
        });
      },
    );
    await ready;
    await purge(secondDb);
    release();
    await pending;
    const fresh = await f.render(f.request("/pending"), "New generation");
    assert.equal(fresh.headers.get("X-Colossal-Cache"), "MISS");
    assert.equal(await fresh.text(), "New generation");
    const mutation = new Request("https://cms.test/api/admin/settings", {
      method: "POST",
    });
    await f.registry.request(
      { request: mutation, env: { DB: f.db } },
      async () => Response.json({ ok: true }),
    );
    assert.equal(
      (await f.render(f.request())).headers.get("X-Colossal-Cache"),
      "MISS",
    );
  } finally {
    await f.local.close();
  }
});
test("plugin activation, exclusions, settings, size bounds, errors and access checks are honored", async () => {
  const f = await fixture();
  try {
    const admin = (
      method = "GET",
      body,
      path = "/api/admin/caching",
      user = { role: "admin" },
    ) =>
      f.registry.dispatch("admin", {
        request: new Request("https://cms.test" + path, {
          method,
          body: body ? JSON.stringify(body) : undefined,
          headers: { "Content-Type": "application/json" },
        }),
        path,
        db: f.db,
        user,
        log: async () => {},
      });
    await assert.rejects(admin("GET", null, "/api/admin/caching", null), {
      status: 401,
    });
    await assert.rejects(
      admin("POST", defaults, "/api/admin/caching", { role: "editor" }),
      { status: 403 },
    );
    await assert.rejects(admin("POST", { ...defaults, ttl: 0 }), /lifetime/);
    assert.throws(
      () =>
        validateSettings({
          ...defaults,
          excludedPaths: ["https://other.test"],
        }),
      /paths/,
    );
    await admin("POST", { ...defaults, excludedPaths: ["/about"] });
    assert.notEqual(
      (await f.render(f.request("/about/child"))).headers.get(
        "X-Colossal-Cache",
      ),
      "HIT",
    );
    const huge = await f.render(f.request("/huge"), "x".repeat(600000));
    assert.equal(huge.headers.get("X-Colossal-Cache"), "BYPASS");
    for (let i = 0; i < 75; i++) await f.render(f.request("/bounded-" + i));
    assert.ok(
      (
        await f.db
          .prepare("SELECT COUNT(*) AS count FROM response_cache")
          .first()
      ).count <= 64,
    );
    const stats = await (await admin()).json();
    assert.ok(stats.stats.entries <= 64);
    assert.equal(stats.settings.ttl, 300);
    await f.db
      .prepare("UPDATE plugins SET active=0 WHERE id=?")
      .bind(CACHE_ID)
      .run();
    assert.notEqual(
      (await f.render(f.request("/bounded-1"))).headers.get("X-Colossal-Cache"),
      "HIT",
    );
    const bad = {
      prepare() {
        throw Error("Database unavailable");
      },
    };
    const response = await f.registry.request(
      { request: f.request(), env: { DB: bad } },
      async () => new Response("Fallback"),
    );
    assert.equal(await response.text(), "Fallback");
  } finally {
    await f.local.close();
  }
});
test("worker caches real public HTML and render data, keeps analytics, and invalidates after settings changes", async () => {
  const DB = localDatabase(),
    env = {
      DB,
      ASSETS: {
        fetch: async () =>
          new Response(
            "<html><head><title>CMS</title></head><body><cl-frontend></cl-frontend></body></html>",
            { headers: { "Content-Type": "text/html" } },
          ),
      },
    };
  const call = (path, method = "GET", body, owner = false) =>
    worker.fetch(
      new Request("https://cms.test" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Origin: "https://cms.test",
          ...(owner
            ? {
                "oai-authenticated-user-id": "owner",
                "oai-authenticated-user-email": "owner@example.test",
              }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
  try {
    assert.equal(
      (await call("/api/admin/setup", "POST", {}, true)).status,
      200,
    );
    assert.equal(
      (
        await call(
          "/api/admin/plugins",
          "POST",
          { id: CACHE_ID, action: "install" },
          true,
        )
      ).status,
      200,
    );
    const first = await call("/about");
    assert.equal(first.headers.get("X-Colossal-Cache"), "MISS");
    const second = await call("/about");
    assert.equal(second.headers.get("X-Colossal-Cache"), "HIT");
    assert.equal(await first.text(), await second.text());
    assert.equal(
      (
        await DB.prepare(
          "SELECT COUNT(*) AS count FROM content_views WHERE content_id='about'",
        ).first()
      ).count,
      2,
    );
    assert.equal(
      (await call("/api/themes/render?path=/about")).headers.get(
        "X-Colossal-Cache",
      ),
      "MISS",
    );
    assert.equal(
      (await call("/api/themes/render?path=/about")).headers.get(
        "X-Colossal-Cache",
      ),
      "HIT",
    );
    const settings = (
      await (await call("/api/admin/state", "GET", undefined, true)).json()
    ).settings;
    const changed = await call(
      "/api/admin/settings",
      "POST",
      { ...settings, title: "New site title" },
      true,
    );
    assert.equal(changed.status, 200, await changed.text());
    const fresh = await call("/about");
    assert.equal(fresh.headers.get("X-Colossal-Cache"), "MISS");
    assert.match(await fresh.text(), /New site title/);
  } finally {
    await DB.close();
  }
});
