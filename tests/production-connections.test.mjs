import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import {
  connectionManager,
  connectionDefaults,
  validateConnectionConfig,
} from "../scripts/connection-manager.mjs";
import {
  parseSql,
  sqlTokens,
  mongoAdapter,
} from "../scripts/mongo-database.mjs";
import {
  productionSchema,
  mongoValidator,
  rowDefaults,
} from "../scripts/production-schema.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { d1Database, migrateD1 } from "../scripts/d1-database.mjs";
import { s3Storage } from "../scripts/s3-storage.mjs";
import { passwordAuth, hashPassword } from "../scripts/password-auth.mjs";
import worker from "../server/worker.mjs";
import { startProductionServer } from "../scripts/production-server.mjs";
import { once } from "node:events";
import {
  migrateLocalData,
  seedBuiltInData,
  registerSetupOwner,
} from "../scripts/data-migration.mjs";
import { localStorage } from "../scripts/local-storage.mjs";

const config = {
  ...connectionDefaults,
  CMS_STORAGE_PROVIDER: "r2",
  MONGODB_URI: "mongodb+srv://username:secret@cluster.example/",
  R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  R2_BUCKET: "colossal-media",
  R2_ACCESS_KEY_ID: "private-key",
  R2_SECRET_ACCESS_KEY: "private-secret",
};

test("production dotenv values are masked, persisted, selectively revealed and host overrides remain protected", async () => {
  const dir = await mkdtemp(join(tmpdir(), "colossal-env-"));
  try {
    const manager = connectionManager({
      filename: join(dir, ".env.production"),
      hostEnv: { R2_REGION: "auto" },
    });
    const { R2_REGION, ...editable } = config;
    await manager.save(editable);
    const description = await manager.describe();
    assert.equal(description.active.database, "sqlite");
    assert.equal(
      description.fields.find((f) => f.key === "MONGODB_URI").value,
      "",
    );
    assert.equal(
      description.fields.find((f) => f.key === "MONGODB_URI").configured,
      true,
    );
    assert.equal(
      (await manager.reveal("MONGODB_URI")).value,
      config.MONGODB_URI,
    );
    await manager.save({ MONGODB_URI: "", MONGODB_DATABASE: "portfolio" });
    assert.equal((await manager.config()).MONGODB_URI, config.MONGODB_URI);
    assert.equal((await manager.config()).MONGODB_DATABASE, "portfolio");
    const file = await readFile(join(dir, ".env.production"), "utf8");
    assert.match(file, /MONGODB_DATABASE="portfolio"/);
    await assert.rejects(manager.save({ R2_REGION: "eu" }), /managed/);
    await assert.rejects(
      manager.save({ NODE_OPTIONS: "arbitrary" }),
      /cannot be edited/,
    );
    await assert.rejects(
      manager.save({ MONGODB_URI: "invalid\nOTHER=secret" }),
      /Invalid/,
    );
    await assert.rejects(manager.reveal("CMS_ADMIN_PASSWORD_HASH"), /Unknown/);
    assert.throws(
      () =>
        validateConnectionConfig({
          ...config,
          R2_ENDPOINT: "http://insecure.example",
        }),
      /HTTPS/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("connection runs stream ordered operations, finish, close resources and never expose provider secrets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "colossal-runs-"));
  let closed = 0;
  try {
    const manager = connectionManager({
      filename: join(dir, ".env.production"),
      hostEnv: {},
      connectors: {
        registerOwner: async () => {},
        seed: async (db, log) => log("Built-in data ready"),
        mongo: async (c, log, initialize) => {
          log("Mongo connected");
          if (initialize) log("Created collections and indexes");
          return {
            close: async () => {
              closed++;
            },
          };
        },
        storage: () => ({
          test: async () => {},
          close: () => {
            closed++;
          },
        }),
      },
    });
    await manager.save(config);
    const { id } = await manager.start("initialize");
    while (manager.job(id).status === "running")
      await new Promise((r) => setTimeout(r, 2));
    const job = manager.job(id);
    assert.equal(job.status, "completed");
    assert.equal(closed, 2);
    assert.match(JSON.stringify(job), /Created collections/);
    assert.doesNotMatch(JSON.stringify(job), /private-secret|username:secret/);
    const failed = connectionManager({
      filename: join(dir, ".env.production"),
      hostEnv: {},
      connectors: {
        mongo: async () => {
          throw new Error(config.MONGODB_URI);
        },
      },
    });
    const run = await failed.start("test");
    while (failed.job(run.id).status === "running")
      await new Promise((r) => setTimeout(r, 2));
    assert.equal(failed.job(run.id).status, "failed");
    assert.doesNotMatch(JSON.stringify(failed.job(run.id)), /username:secret/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Mongo schema covers every CMS table and parser covers all runtime SQL including optimistic publication", () => {
  const schema = productionSchema();
  assert.ok(
    schema.content &&
      schema.themes &&
      schema.auth_credentials &&
      schema.auth_sessions,
  );
  assert.equal(rowDefaults(schema.content).details, "{}");
  assert.equal(rowDefaults(schema.content).template_id, "");
  assert.ok(
    mongoValidator(schema.auth_credentials).$jsonSchema.required.includes(
      "password_hash",
    ),
  );
  assert.ok(
    schema.content.indexes.some((i) => i.unique && i.fields.includes("slug")),
  );
  let count = 0;
  for (const file of readdirSync("server").filter((f) => f.endsWith(".mjs"))) {
    const source = readFileSync("server/" + file, "utf8");
    for (const match of source.matchAll(
      /"((?:SELECT|INSERT|UPDATE|DELETE) [^"\n]*)"/g,
    )) {
      const sql = match[1],
        args = sqlTokens(sql)
          .filter((t) => t === "?")
          .map(() => 1);
      assert.doesNotThrow(() => parseSql(sql, args), file + ": " + sql);
      count++;
    }
  }
  assert.ok(count > 100);
  assert.deepEqual(
    parseSql(
      "UPDATE themes SET revision=revision+1,draft=NULL WHERE id=? AND revision=?",
      ["theme", 4],
    ).increments,
    { revision: 1 },
  );
  assert.equal(
    parseSql(
      "INSERT INTO theme_history (id,theme_id,version,snapshot,created_at) SELECT ?,?,?,?,? FROM themes WHERE id=? AND revision=?",
      ["h", "t", "1", "{}", "now", "t", 4],
    ).source.table,
    "themes",
  );
  assert.throws(
    () => parseSql("SELECT * FROM members WHERE id=?", []),
    /Missing/,
  );
  assert.throws(
    () => parseSql("SELECT * FROM members; DROP TABLE members"),
    /Unsupported/,
  );
});

test("native Mongo migration copies local data and replaces untouched built-in themes with null drafts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "colossal-mongo-migration-"));
  const source = localDatabase(join(dir, "colossal.sqlite"));
  const mock = fakeMongo(),
    target = mongoAdapter(mock.client, mock.database);
  try {
    await seedBuiltInData(source);
    await source
      .prepare("UPDATE content SET title=? WHERE id=?")
      .bind("Migrated local title", "welcome")
      .run();
    await seedBuiltInData(target);
    await migrateLocalData(target, localStorage(join(dir, "destination")), dir);
    assert.equal(
      (
        await target
          .prepare("SELECT title FROM content WHERE id=?")
          .bind("welcome")
          .first()
      ).title,
      "Migrated local title",
    );
    assert.deepEqual(
      (await target.prepare("SELECT * FROM themes ORDER BY id").all()).results,
      JSON.parse(
        JSON.stringify(
          (await source.prepare("SELECT * FROM themes ORDER BY id").all())
            .results,
        ),
      ),
    );
    await migrateLocalData(target, localStorage(join(dir, "destination")), dir);
    assert.equal(
      (await target.prepare("SELECT * FROM content").all()).results.length,
      3,
    );
  } finally {
    source.close();
    await target.close();
    await rm(dir, { recursive: true, force: true });
  }
});

function fakeMongo() {
  let data = {};
  let rolledBack = 0;
  const match = (row, filter) =>
    Object.entries(filter).every(([key, value]) =>
      key === "$or"
        ? value.some((f) => match(row, f))
        : key === "$and"
          ? value.every((f) => match(row, f))
          : typeof value !== "object" || value === null
            ? row[key] === value
            : Object.entries(value).every(([op, val]) =>
                op === "$eq"
                  ? row[key] === val
                  : op === "$ne"
                    ? row[key] !== val
                    : op === "$gt"
                      ? row[key] > val
                      : op === "$gte"
                        ? row[key] >= val
                        : op === "$lt"
                          ? row[key] < val
                          : row[key] <= val,
              ),
    );
  const cursor = (rows) => ({
    sort(sort) {
      rows.sort((a, b) => {
        for (const [key, dir] of Object.entries(sort)) {
          if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * dir;
        }
        return 0;
      });
      return this;
    },
    limit(n) {
      rows = rows.slice(0, n);
      return this;
    },
    toArray: async () => structuredClone(rows),
  });
  const database = {
    collection(name) {
      data[name] ||= [];
      return {
        find(filter) {
          return cursor(data[name].filter((r) => match(r, filter)));
        },
        findOne: async (filter) =>
          structuredClone(data[name].find((r) => match(r, filter)) || null),
        async insertOne(row) {
          if (data[name].some((r) => r.id === row.id))
            throw Object.assign(new Error("duplicate"), { code: 11000 });
          data[name].push(structuredClone(row));
          return {};
        },
        async updateOne(filter, update, options) {
          let row = data[name].find((r) => match(r, filter));
          const matchedCount = row ? 1 : 0;
          if (!row && options.upsert) {
            row = { ...filter, ...update.$setOnInsert };
            data[name].push(row);
          }
          if (row) Object.assign(row, update.$set || {});
          return {
            matchedCount,
            modifiedCount: matchedCount,
            upsertedCount: row && !matchedCount ? 1 : 0,
          };
        },
        async updateMany(filter, update) {
          const rows = data[name].filter((r) => match(r, filter));
          for (const row of rows) {
            Object.assign(row, update.$set);
            for (const [key, value] of Object.entries(update.$inc || {}))
              row[key] += value;
          }
          return { matchedCount: rows.length, modifiedCount: rows.length };
        },
        async deleteMany(filter) {
          const size = data[name].length;
          data[name] = data[name].filter((r) => !match(r, filter));
          return { deletedCount: size - data[name].length };
        },
        aggregate(pipeline) {
          let rows = structuredClone(data[name]);
          for (const stage of pipeline) {
            if (stage.$lookup) {
              const l = stage.$lookup;
              rows = rows.map((r) => ({
                ...r,
                [l.as]: (data[l.from] || []).filter(
                  (f) => f[l.foreignField] === r[l.localField],
                ),
              }));
            } else if (stage.$unwind) {
              const key = stage.$unwind.slice(1);
              rows = rows.flatMap((r) =>
                r[key].map((value) => ({ ...r, [key]: value })),
              );
            } else if (stage.$match) {
              rows = rows.filter((r) => match(r, stage.$match));
            }
          }
          return cursor(rows);
        },
      };
    },
  };
  const client = {
    startSession: () => ({
      withTransaction: async (fn) => {
        const backup = structuredClone(data);
        try {
          return await fn();
        } catch (e) {
          data = backup;
          rolledBack++;
          throw e;
        }
      },
      endSession: async () => {},
    }),
    close: async () => {},
  };
  return { database, client, rolledBack: () => rolledBack };
}

test("native Mongo operations preserve defaults, ignored inserts, upserts, joins and transactional rollback", async () => {
  const mock = fakeMongo(),
    db = mongoAdapter(mock.client, mock.database);
  await db.batch([
    db
      .prepare(
        "INSERT OR IGNORE INTO plugins (id,active,installed) VALUES (?,0,1)",
      )
      .bind("p"),
    db
      .prepare(
        "INSERT OR IGNORE INTO plugins (id,active,installed) VALUES (?,0,1)",
      )
      .bind("p"),
  ]);
  assert.equal(
    (await db.prepare("SELECT * FROM plugins").all()).results.length,
    1,
  );
  await db
    .prepare(
      "INSERT INTO plugin_packages (id,manifest,current,previous,pending,installed_at) VALUES (?,?,?,NULL,NULL,?)",
    )
    .bind("p", "{}", "v1", "now")
    .run();
  assert.equal(
    (
      await db
        .prepare(
          "SELECT p.*,s.active,s.installed FROM plugin_packages p JOIN plugins s ON s.id=p.id WHERE p.id=?",
        )
        .bind("p")
        .first()
    ).installed,
    1,
  );
  await db
    .prepare(
      "INSERT INTO config (id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
    )
    .bind("site", "before")
    .run();
  await db
    .prepare(
      "INSERT INTO config (id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
    )
    .bind("site", "after")
    .run();
  assert.equal(
    (
      await db
        .prepare("SELECT value FROM config WHERE id=?")
        .bind("site")
        .first()
    ).value,
    "after",
  );
  await assert.rejects(
    db.batch([
      db
        .prepare("UPDATE config SET value=? WHERE id=?")
        .bind("rollback", "site"),
      db
        .prepare("INSERT INTO config (id,value) VALUES (?,?)")
        .bind("site", "duplicate"),
    ]),
  );
  assert.equal(mock.rolledBack(), 1);
  assert.equal(
    (await db.prepare("SELECT value FROM config WHERE id='site'").first())
      .value,
    "after",
  );
  await db
    .prepare(
      "INSERT INTO themes (id,manifest,published,draft,active,is_core,revision,updated_at) VALUES (?,?,?,NULL,1,0,1,?)",
    )
    .bind("t", "{}", "{}", "now")
    .run();
  const pub = () =>
    db
      .prepare(
        "INSERT INTO theme_history (id,theme_id,version,snapshot,created_at) SELECT ?,?,?,?,? FROM themes WHERE id=? AND revision=?",
      )
      .bind("h", "t", "1", "{}", "now", "t", 1);
  await db.batch([
    pub(),
    db
      .prepare(
        "UPDATE themes SET revision=revision+1,draft=NULL WHERE id=? AND revision=?",
      )
      .bind("t", 1),
  ]);
  assert.equal(
    (await db.prepare("SELECT revision FROM themes WHERE id='t'").first())
      .revision,
    2,
  );
  assert.equal((await pub().run()).meta.changes, 0);
});

test("D1 REST uses bound parameters and atomic batch payloads; migrations are idempotent", async () => {
  const local = localDatabase(),
    payloads = [];
  // Use an empty adapter database for migration tests (localDatabase has already applied them).
  const { DatabaseSync } = await import("node:sqlite"),
    raw = new DatabaseSync(":memory:");
  const fetcher = async (url, options) => {
    assert.match(url, /\/accounts\/a+\/d1\/database\/b+\/query$/);
    assert.equal(options.headers.Authorization, "Bearer token");
    const body = JSON.parse(options.body);
    payloads.push(body);
    const statements = body.batch || [body];
    raw.exec("BEGIN");
    try {
      const result = statements.map((s) => {
        if (/^\s*(CREATE|ALTER|WITH)/i.test(s.sql)) {
          raw.exec(s.sql);
          return { success: true, results: [], meta: { changes: 0 } };
        }
        const stmt = raw.prepare(s.sql);
        return /^SELECT/.test(s.sql)
          ? { success: true, results: stmt.all(...(s.params || [])) }
          : { success: true, results: [], meta: stmt.run(...(s.params || [])) };
      });
      raw.exec("COMMIT");
      return Response.json(
        { success: true, result },
        { headers: { "Content-Type": "application/json" } },
      );
    } catch {
      raw.exec("ROLLBACK");
      return Response.json({ success: false }, { status: 400 });
    }
  };
  try {
    const db = d1Database(
      {
        CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
        CLOUDFLARE_D1_DATABASE_ID: "b".repeat(36),
        CLOUDFLARE_API_TOKEN: "token",
      },
      fetcher,
    );
    const logs = [];
    await migrateD1(db, (m) => logs.push(m));
    await migrateD1(db, (m) => logs.push(m));
    assert.ok(logs.some((l) => l.includes("already applied")));
    raw.exec(
      "CREATE TABLE d1_migrations (name TEXT); INSERT INTO d1_migrations VALUES ('0004_production_auth.sql'); DELETE FROM local_migrations WHERE name='0004_production_auth.sql'",
    );
    await migrateD1(db, (m) => logs.push(m));
    assert.ok(
      logs.some((l) => l.includes("Adopted existing Wrangler migration")),
    );
    await db
      .prepare("INSERT INTO config (id,value) VALUES (?,?)")
      .bind("example", "'quoted'")
      .run();
    assert.equal(
      (
        await db
          .prepare("SELECT value FROM config WHERE id=?")
          .bind("example")
          .first()
      ).value,
      "'quoted'",
    );
    assert.ok(payloads.some((p) => p.batch?.length > 1));
  } finally {
    raw.close();
    local.close();
  }
});

test("S3 adapter matches the CMS blob contract and checks buckets without writing objects", async () => {
  const commands = [],
    data = new Map();
  const client = {
    send: async (command) => {
      commands.push(command.constructor.name);
      const p = command.input;
      if (command.constructor.name === "PutObjectCommand") {
        data.set(p.Key, p.Body);
        return {};
      }
      if (command.constructor.name === "GetObjectCommand") {
        if (!data.has(p.Key))
          throw Object.assign(new Error(), { name: "NoSuchKey" });
        return {
          Body: {
            transformToByteArray: async () => new Uint8Array(data.get(p.Key)),
          },
        };
      }
      if (command.constructor.name === "DeleteObjectCommand")
        data.delete(p.Key);
      return {};
    },
    destroy() {},
  };
  const storage = s3Storage(config, client);
  await storage.test();
  assert.deepEqual(commands, ["HeadBucketCommand"]);
  await storage.put("media/image", new Uint8Array([1, 2, 3]));
  const blob = await storage.get("media/image");
  assert.equal(blob.size, 3);
  assert.deepEqual(
    Array.from(new Uint8Array(await blob.arrayBuffer())),
    [1, 2, 3],
  );
  await storage.delete("media/image");
  assert.equal(await storage.get("media/image"), null);
  await assert.rejects(storage.put("../.env", new Uint8Array()), /Invalid/);
});

test("bcrypt credentials and hashed sessions persist, expire and are revoked on password changes", async () => {
  const db = localDatabase();
  let time = Date.now();
  const auth = passwordAuth(db, { clock: () => time });
  try {
    const hash = await hashPassword("a secure test password");
    assert.match(hash, /^\$2b\$12\$/);
    assert.ok(await bcrypt.compare("a secure test password", hash));
    await auth.bootstrap("owner@example.test", hash);
    await db.prepare("DELETE FROM auth_credentials WHERE id='owner'").run();
    await assert.rejects(
      auth.bootstrap("other@example.test", hash),
      /must match/,
    );
    await auth.bootstrap("owner@example.test", hash);
    await auth.bootstrap("other@example.test", hash);
    assert.equal(
      (await db.prepare("SELECT email FROM members WHERE id='owner'").first())
        .email,
      "owner@example.test",
    );
    await assert.rejects(auth.login("owner@example.test", "wrong"), /Invalid/);
    const session = await auth.login(
      "owner@example.test",
      "a secure test password",
      "test-client",
    );
    assert.match(session.cookie, /HttpOnly; SameSite=Lax.*Secure/);
    const request = new Request("https://cms.test", {
      headers: { cookie: session.cookie.split(";")[0] },
    });
    assert.equal((await auth.identify(request)).role, "admin");
    const stored = await db.prepare("SELECT * FROM auth_sessions").first();
    assert.ok(!session.cookie.includes(stored.id));
    time += 9 * 60 * 60 * 1000;
    assert.equal(await auth.identify(request), null);
    time -= 9 * 60 * 60 * 1000;
    await auth.setPassword("owner@example.test", "a different secure password");
    assert.equal(await auth.identify(request), null);
    await assert.rejects(
      auth.login("owner@example.test", "a secure test password"),
      /Invalid/,
    );
    await assert.rejects(hashPassword("tiny"), /at least/);
    await assert.rejects(hashPassword("😀".repeat(20)), /72/);
  } finally {
    db.close();
  }
});

test("connection management API is admin-only, origin-protected and requires plugin activation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "colossal-api-env-")),
    db = localDatabase();
  const owner = {
    "oai-authenticated-user-id": "owner",
    "oai-authenticated-user-email": "owner@example.test",
  };
  const manager = connectionManager({
      filename: join(dir, ".env.production"),
      hostEnv: {},
    }),
    env = {
      DB: db,
      CONNECTIONS: manager,
      AUTH: passwordAuth(db),
      ASSETS: { fetch: async () => new Response("asset") },
      STORAGE: {},
    };
  const call = async (path, method = "GET", body, headers = owner) => {
    const r = await worker.fetch(
      new Request("https://cms.test/api" + path, {
        method,
        headers: {
          ...headers,
          Origin: "https://cms.test",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
    return { status: r.status, body: await r.json() };
  };
  try {
    assert.equal((await call("/admin/setup", "POST", {})).status, 200);
    assert.equal((await call("/admin/connections")).status, 409);
    await call("/admin/plugins", "POST", {
      id: "com.colossal.production-connections",
      action: "install",
    });
    assert.equal((await call("/admin/connections")).status, 200);
    assert.equal(
      (await call("/admin/connections", "GET", undefined, {})).status,
      401,
    );
    await call("/admin/members", "POST", {
      email: "editor@example.test",
      role: "editor",
    });
    const editor = {
      "oai-authenticated-user-id": "editor",
      "oai-authenticated-user-email": "editor@example.test",
    };
    const memberPassword = "a-long-member-password";
    for (const [headers, status] of [
      [editor, 403],
      [{}, 401],
    ]) {
      assert.equal(
        (
          await call(
            "/admin/connections/password",
            "POST",
            {
              email: "new@example.test",
              password: memberPassword,
            },
            headers,
          )
        ).status,
        status,
      );
    }
    assert.equal(
      (
        await call("/admin/connections/password", "POST", {
          email: "bad email",
          password: memberPassword,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/admin/connections/password", "POST", {
          email: "new@example.test",
          password: "short",
        })
      ).status,
      400,
    );
    assert.equal(
      await db
        .prepare("SELECT id FROM members WHERE email=?")
        .bind("new@example.test")
        .first(),
      null,
    );
    assert.equal(
      (
        await call("/admin/connections/password", "POST", {
          email: " New@Example.test ",
          password: memberPassword,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await db
          .prepare("SELECT role FROM members WHERE email=?")
          .bind("new@example.test")
          .first()
      ).role,
      "editor",
    );
    const newSession = await env.AUTH.login(
      "new@example.test",
      memberPassword,
      "member-test",
    );
    assert.ok(newSession.cookie);
    const sessionRequest = new Request("https://cms.test", {
      headers: { cookie: newSession.cookie },
    });
    assert.ok(await env.AUTH.identify(sessionRequest));
    assert.equal(
      (
        await call("/admin/connections/password", "POST", {
          email: "new@example.test",
          password: "a-different-member-password",
        })
      ).status,
      200,
    );
    assert.equal(await env.AUTH.identify(sessionRequest), null);
    assert.ok(
      (
        await env.AUTH.login(
          "new@example.test",
          "a-different-member-password",
          "member-reset-test",
        )
      ).cookie,
    );
    assert.equal(
      (
        await call("/admin/connections/password", "POST", {
          email: "owner@example.test",
          password: memberPassword,
        })
      ).status,
      200,
    );
    assert.equal(
      (await db.prepare("SELECT role FROM members WHERE id='owner'").first())
        .role,
      "admin",
    );
    assert.equal(
      (
        await call(
          "/admin/connections/reveal",
          "POST",
          { key: "MONGODB_URI" },
          editor,
        )
      ).status,
      403,
    );
    assert.equal(
      (await call("/admin/connections/save", "POST", config)).status,
      200,
    );
    assert.equal(
      (await call("/admin/connections")).body.fields.find(
        (f) => f.key === "MONGODB_URI",
      ).value,
      "",
    );
    const response = await worker.fetch(
      new Request("https://cms.test/api/admin/connections/reveal", {
        method: "POST",
        headers: {
          ...owner,
          Origin: "https://other.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key: "MONGODB_URI" }),
      }),
      env,
    );
    assert.equal(response.status, 403);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("setup administrator registers and signs in through the native Mongo adapter without content migration", async () => {
  const directory = await mkdtemp(join(tmpdir(), "colossal-mongo-owner-"));
  const source = localDatabase(join(directory, "colossal.sqlite"));
  const mock = fakeMongo(),
    target = mongoAdapter(mock.client, mock.database);
  try {
    const setupToken = "isolated-native-mongo-owner-token-32-characters";
    await passwordAuth(source, { setupToken }).setup(
      "mongo-owner@example.test",
      "native mongo owner password",
      setupToken,
    );
    await registerSetupOwner(target, directory);
    assert.equal(
      (await target.prepare("SELECT * FROM members").all()).results.length,
      1,
    );
    assert.equal(
      (await target.prepare("SELECT * FROM content").all()).results.length,
      0,
    );
    assert.ok(
      (
        await passwordAuth(target).login(
          "mongo-owner@example.test",
          "native mongo owner password",
        )
      ).cookie,
    );
    await registerSetupOwner(target, directory);
    assert.equal(
      (await target.prepare("SELECT * FROM auth_credentials").all()).results
        .length,
      1,
    );
  } finally {
    source.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("Mongo-backed CMS initializes, renders and saves content through the existing API", async () => {
  const mock = fakeMongo(),
    DB = mongoAdapter(mock.client, mock.database),
    env = {
      DB,
      STORAGE: {},
      ASSETS: { fetch: async () => new Response("asset") },
    };
  const call = async (path, method = "GET", body) => {
    const r = await worker.fetch(
      new Request("https://cms.test/api" + path, {
        method,
        headers: {
          "oai-authenticated-user-id": "mongo-owner",
          "oai-authenticated-user-email": "mongo@example.test",
          Origin: "https://cms.test",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
    return { status: r.status, data: await r.json() };
  };
  assert.equal((await call("/admin/setup", "POST", {})).status, 200);
  const state = await call("/admin/state");
  assert.equal(state.status, 200);
  assert.ok(state.data.content.length);
  const page = state.data.content.find((c) => c.kind === "page");
  assert.ok(page);
  assert.equal(
    (
      await call("/admin/content", "POST", {
        ...page,
        title: "Mongo portfolio",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await DB.prepare("SELECT title FROM content WHERE id=?")
        .bind(page.id)
        .first()
    ).title,
    "Mongo portfolio",
  );
  assert.equal((await call("/themes/render?path=/")).status, 200);
  assert.equal((await call("/admin/state")).status, 200);
});

test("Node production hosting strips spoofed identity, signs in with bcrypt and signs out", async () => {
  const DB = localDatabase(),
    AUTH = passwordAuth(DB);
  let server;
  try {
    await AUTH.bootstrap(
      "node@example.test",
      await hashPassword("node hosting test password"),
    );
    server = await startProductionServer(
      { CMS_PUBLIC_URL: "https://cms.test", PORT: "0" },
      async () => ({ DB, AUTH, PASSWORD_AUTH: true, STORAGE: {} }),
    );
    if (!server.listening) await once(server, "listening");
    const base = "http://127.0.0.1:" + server.address().port;
    const spoofed = await fetch(base + "/api/admin/session", {
      headers: {
        "oai-authenticated-user-id": "owner",
        "oai-authenticated-user-email": "node@example.test",
      },
    });
    assert.equal(spoofed.status, 401);
    assert.equal(
      (await fetch(base + "/admin/", { redirect: "manual" })).headers.get(
        "location",
      ),
      "/login",
    );
    const login = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "https://cms.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "node@example.test",
        password: "node hosting test password",
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await fetch(base + "/api/admin/session", { headers: { cookie } }))
        .status,
      200,
    );
    assert.equal(
      (
        await fetch(base + "/api/auth/logout", {
          method: "POST",
          headers: {
            cookie,
            Origin: "https://cms.test",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(base + "/api/admin/session", { headers: { cookie } }))
        .status,
      401,
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    DB.close();
  }
});
