import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { parseSql } from "../scripts/mongo-database.mjs";
import {
  defaultTheme,
  validateDocument,
  renderTheme,
} from "../server/theme-engine.mjs";

test("Protected copies require server-validated passwords, leave public originals unchanged and enforce durable limits", async () => {
  const sqlite = localDatabase(),
    blobs = new Map(),
    bytes = new TextEncoder().encode("%PDF-1.7\nPrivate copy fixture\n%%EOF");
  const db = {
    prepare(sql) {
      const wrap = (args = []) => ({
        bind: (...values) => wrap(values),
        first: async () => {
          parseSql(sql, args);
          return sqlite
            .prepare(sql)
            .bind(...args)
            .first();
        },
        all: async () => {
          parseSql(sql, args);
          return sqlite
            .prepare(sql)
            .bind(...args)
            .all();
        },
        run: async () => {
          parseSql(sql, args);
          return sqlite
            .prepare(sql)
            .bind(...args)
            .run();
        },
      });
      return wrap();
    },
  };
  const env = {
    DB: db,
    STORAGE: {
      put: async (key, value) => blobs.set(key, new Uint8Array(value).slice()),
      get: async (key) => {
        const value = blobs.get(key);
        return value
          ? {
              size: value.byteLength,
              arrayBuffer: async () => value.slice().buffer,
            }
          : null;
      },
      delete: async (key) => blobs.delete(key),
    },
    ASSETS: { fetch: async () => new Response("asset") },
  };
  const owner = {
    "oai-authenticated-user-id": "owner",
    "oai-authenticated-user-email": "owner@example.test",
  };
  const request = (
    path,
    body,
    admin = false,
    origin = "https://cms.test",
    method = body ? "POST" : "GET",
  ) =>
    worker.fetch(
      new Request("https://cms.test" + path, {
        method,
        headers: {
          ...(admin ? owner : {}),
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
  try {
    await sqlite
      .prepare(
        "INSERT INTO members(id,email,role) VALUES ('owner','owner@example.test','admin')",
      )
      .run();
    await sqlite
      .prepare(
        "INSERT INTO media(id,type,name,mime,storage_key,uploaded_by,uploaded_at,updated_at) VALUES ('source','pdf','Fixture.pdf','application/pdf','media/source.pdf','owner','2026-01-01','2026-01-01')",
      )
      .run();
    await sqlite
      .prepare("INSERT INTO config(id,value) VALUES ('site',?)")
      .bind(JSON.stringify({ siteIconId: "source" }))
      .run();
    blobs.set("media/source.pdf", bytes);
    assert.equal(
      (
        await request("/api/admin/protected-files", {
          mediaId: "source",
          password: "sample-file-password-123",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(
          "/api/admin/protected-files",
          { mediaId: "source", password: "short" },
          true,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "/api/admin/protected-files",
          { mediaId: "source", password: "sample-file-password-123" },
          true,
          "https://other.test",
        )
      ).status,
      403,
    );
    const create = await request(
      "/api/admin/protected-files",
      { mediaId: "source", password: "sample-file-password-123" },
      true,
    );
    assert.equal(create.status, 201);
    const info = await create.json(),
      id = info.id;
    assert.deepEqual(Object.keys(info).sort(), ["hasPassword", "id", "name"]);
    const row = await sqlite
      .prepare("SELECT * FROM protected_files WHERE id=?")
      .bind(id)
      .first();
    assert.match(row.password_hash, /^\$2[aby]\$12\$/);
    assert.notEqual(row.password_hash, "sample-file-password-123");
    assert.notEqual(row.storage_key, "media/source.pdf");
    assert.deepEqual(blobs.get(row.storage_key), bytes);
    assert.deepEqual(blobs.get("media/source.pdf"), bytes);
    assert.equal(
      (await sqlite.prepare("SELECT * FROM media").all()).results.length,
      1,
    );
    assert.equal(
      (await request("/api/admin/protected-files/" + id)).status,
      401,
    );
    assert.deepEqual(
      await (
        await request("/api/admin/protected-files/" + id, undefined, true)
      ).json(),
      info,
    );
    assert.equal(
      (await request("/api/protected-files/" + id + "/download")).status,
      405,
    );
    assert.equal(
      (
        await request("/api/protected-files/" + id + "/download", {
          password: "wrong",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request(
          "/api/protected-files/" + id + "/download",
          { password: "sample-file-password-123" },
          false,
          "https://other.test",
        )
      ).status,
      403,
    );
    const download = await request("/api/protected-files/" + id + "/download", {
      password: "sample-file-password-123",
    });
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("Cache-Control"), "private, no-store");
    assert.match(
      download.headers.get("Content-Disposition"),
      /attachment;.*Fixture.pdf/,
    );
    assert.deepEqual(new Uint8Array(await download.arrayBuffer()), bytes);
    assert.equal((await request("/api/media/" + id + "/file")).status, 404);
    const original = await request("/api/media/source/file");
    assert.equal(original.status, 200);
    assert.deepEqual(new Uint8Array(await original.arrayBuffer()), bytes);
    await request(
      "/api/admin/protected-files/" + id,
      { password: "replacement-file-password" },
      true,
    );
    assert.equal(
      (
        await request("/api/protected-files/" + id + "/download", {
          password: "sample-file-password-123",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request("/api/protected-files/" + id + "/download", {
          password: "replacement-file-password",
        })
      ).status,
      200,
    );
    await sqlite
      .prepare("UPDATE protected_file_attempts SET attempts=10")
      .run();
    assert.equal(
      (
        await request("/api/protected-files/" + id + "/download", {
          password: "replacement-file-password",
        })
      ).status,
      429,
    );
    await sqlite
      .prepare("UPDATE protected_file_attempts SET expires_at='2000-01-01'")
      .run();
    assert.equal(
      (
        await request("/api/protected-files/" + id + "/download", {
          password: "replacement-file-password",
        })
      ).status,
      200,
    );
    assert.ok(
      (await sqlite.prepare("SELECT id FROM protected_file_attempts").first())
        .id.length === 64,
    );
  } finally {
    sqlite.close();
  }
});

test("Protected file block renders a configurable, safe button without private metadata and disables editor downloads", () => {
  const document = defaultTheme(),
    id = crypto.randomUUID();
  document.templates.default.children = [
    {
      id: "protected-example-block",
      type: "core/protected-file",
      settings: { downloadId: id, label: "Download <file>" },
    },
  ];
  const theme = validateDocument(document, true),
    ctx = {
      kind: "page",
      content: { id: "page", details: {} },
      settings: {},
      media: [],
      allContent: [],
      plugins: [],
    };
  const rendered = renderTheme(theme, ctx, "default");
  assert.match(rendered.html, /Download &lt;file&gt;/);
  assert.match(rendered.html, new RegExp('data-protected-file="' + id + '"'));
  assert.doesNotMatch(rendered.html, /password_hash|storage_key|\/api\/media/);
  assert.match(rendered.css, /cl-protected-dialog/);
  assert.match(
    renderTheme(theme, { ...ctx, adsPreview: true }, "default").html,
    /button type="button" disabled/,
  );
});
