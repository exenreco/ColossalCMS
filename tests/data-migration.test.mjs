import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localDatabase } from "../scripts/local-database.mjs";
import { localStorage } from "../scripts/local-storage.mjs";
import { d1Database } from "../scripts/d1-database.mjs";
import {
  seedBuiltInData,
  migrateLocalData,
  localMigrationAvailable,
  localSnapshot,
  registerSetupOwner,
} from "../scripts/data-migration.mjs";
import { passwordAuth, hashPassword } from "../scripts/password-auth.mjs";
import {
  connectionManager,
  connectionDefaults,
} from "../scripts/connection-manager.mjs";

async function fixture(fn) {
  const directory = await mkdtemp(join(tmpdir(), "colossal-migration-"));
  const source = localDatabase(join(directory, "colossal.sqlite")),
    target = localDatabase();
  const files = localStorage(join(directory, "storage")),
    output = localStorage(join(directory, "output"));
  try {
    await fn({ directory, source, target, files, output });
  } finally {
    source.close();
    target.close();
    await rm(directory, { recursive: true, force: true });
  }
}
const rows = async (db, table) =>
  (await db.prepare("SELECT * FROM " + table + " ORDER BY id").all()).results;

test("setup administrator registers without full migration, preserves production credentials and excludes other members and sessions", async () =>
  fixture(async ({ directory, source, target }) => {
    const sourceAuth = passwordAuth(source, {
      setupToken: "isolated-owner-registration-token-32-characters",
    });
    await sourceAuth.setup(
      "setup@example.test",
      "setup administrator password",
      "isolated-owner-registration-token-32-characters",
    );
    await sourceAuth.setPassword(
      "another@example.test",
      "other member password",
    );
    await sourceAuth.login(
      "setup@example.test",
      "setup administrator password",
    );
    await registerSetupOwner(target, directory);
    assert.equal((await rows(target, "members")).length, 1);
    assert.equal((await rows(target, "auth_credentials")).length, 1);
    assert.equal((await rows(target, "auth_sessions")).length, 0);
    assert.equal((await rows(target, "content")).length, 0);
    const original = await rows(target, "auth_credentials");
    await sourceAuth.setPassword(
      "setup@example.test",
      "changed local administrator password",
    );
    await registerSetupOwner(target, directory);
    assert.deepEqual(await rows(target, "auth_credentials"), original);
    assert.ok(
      (
        await passwordAuth(target).login(
          "setup@example.test",
          "setup administrator password",
        )
      ).cookie,
    );
  }));

test("administrator registration preserves other production owners and rejects email collisions atomically", async () =>
  fixture(async ({ directory, source, target }) => {
    const setupToken = "isolated-owner-registration-token-32-characters";
    await passwordAuth(source, { setupToken }).setup(
      "setup@example.test",
      "setup administrator password",
      setupToken,
    );
    await passwordAuth(target).setPassword(
      "setup@example.test",
      "existing member password",
    );
    await assert.rejects(
      registerSetupOwner(target, directory),
      /email conflict/,
    );
    assert.equal(
      await target.prepare("SELECT id FROM members WHERE id='owner'").first(),
      null,
    );
    assert.equal((await rows(target, "auth_credentials")).length, 1);
    await passwordAuth(target, { setupToken }).setup(
      "production@example.test",
      "production administrator password",
      setupToken,
    );
    await registerSetupOwner(target, directory);
    assert.equal(
      (
        await target
          .prepare("SELECT email FROM members WHERE id='owner'")
          .first()
      ).email,
      "production@example.test",
    );
    assert.ok(
      (
        await passwordAuth(target).login(
          "production@example.test",
          "production administrator password",
        )
      ).cookie,
    );
  }));

test("administrator registration skips missing local source and incomplete password setup", async () =>
  fixture(async ({ directory, source, target }) => {
    const logs = [];
    await registerSetupOwner(target, join(directory, "missing"), (m) =>
      logs.push(m),
    );
    await source
      .prepare(
        "INSERT INTO members (id,email,role) VALUES ('owner','setup@example.test','admin')",
      )
      .run();
    await registerSetupOwner(target, directory, (m) => logs.push(m));
    assert.equal((await rows(target, "members")).length, 0);
    assert.ok(logs.some((m) => m.includes("incomplete")));
  }));
test("local migration uses D1 REST bound queries and transactional batches", async () =>
  fixture(async ({ directory, source, target, files, output }) => {
    await localContent(source, files);
    let batches = 0;
    const destination = d1Database(
      {
        CLOUDFLARE_ACCOUNT_ID: "account",
        CLOUDFLARE_D1_DATABASE_ID: "database",
        CLOUDFLARE_API_TOKEN: "private",
      },
      async (url, options) => {
        const body = JSON.parse(options.body);
        if (body.batch) {
          batches++;
          const result = await target.batch(
            body.batch.map((query) =>
              target.prepare(query.sql).bind(...query.params),
            ),
          );
          return Response.json({
            success: true,
            result: result.map((meta) => ({
              success: true,
              results: [],
              meta,
            })),
          });
        }
        const statement = target.prepare(body.sql).bind(...body.params);
        const result = /^SELECT/.test(body.sql)
          ? await statement.all()
          : { results: [], meta: await statement.run() };
        return Response.json({
          success: true,
          result: [{ ...result, success: true }],
        });
      },
    );
    await seedBuiltInData(destination);
    await migrateLocalData(destination, output, directory);
    assert.equal(
      (
        await destination
          .prepare("SELECT title FROM content WHERE id=?")
          .bind("welcome")
          .first()
      ).title,
      "Local portfolio",
    );
    assert.equal((await rows(destination, "media")).length, 1);
    assert.ok(batches >= 3);
  }));

async function localContent(source, files) {
  await seedBuiltInData(source, () => {}, "author@example.com");
  await source
    .prepare("UPDATE content SET title=?,body=? WHERE id=?")
    .bind("Local portfolio", "Editable local blocks", "welcome")
    .run();
  await source
    .prepare("INSERT INTO members (id,email,role) VALUES (?,?,?)")
    .bind("owner", "author@example.com", "admin")
    .run();
  await source
    .prepare(
      "INSERT INTO auth_credentials (id,password_hash,updated_at) VALUES (?,?,?)",
    )
    .bind(
      "owner",
      await hashPassword("migration administrator password"),
      "now",
    )
    .run();
  await source
    .prepare(
      "INSERT INTO auth_sessions (id,member_id,expires_at) VALUES (?,?,?)",
    )
    .bind("local-session", "owner", "future")
    .run();
  await source
    .prepare(
      "INSERT INTO media (id,type,name,mime,storage_key,uploaded_by,uploaded_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
    )
    .bind(
      "image",
      "image",
      "photo.png",
      "image/png",
      "media/photo.png",
      "owner",
      "now",
      "now",
    )
    .run();
  await files.put("media/photo.png", Buffer.from([0, 255, 12, 128]));
}

test("built-in themes/plugins/settings/sample data initialize without a local source and preserve edits", async () =>
  fixture(async ({ target }) => {
    await seedBuiltInData(target);
    assert.equal((await rows(target, "themes")).length, 2);
    assert.ok((await rows(target, "plugins")).length >= 10);
    assert.equal((await rows(target, "content")).length, 3);
    await target
      .prepare("UPDATE content SET title=? WHERE id=?")
      .bind("Production edit", "welcome")
      .run();
    await seedBuiltInData(target);
    assert.equal(
      (
        await target
          .prepare("SELECT title FROM content WHERE id=?")
          .bind("welcome")
          .first()
      ).title,
      "Production edit",
    );
  }));

test("local migration copies records and verified uploads, replaces untouched samples and retries idempotently", async () =>
  fixture(async ({ directory, source, target, files, output }) => {
    await localContent(source, files);
    await seedBuiltInData(target);
    const before = localSnapshot(directory),
      logs = [];
    assert.equal(await localMigrationAvailable(directory), true);
    await migrateLocalData(target, output, directory, (message) =>
      logs.push(message),
    );
    for (const table of [
      "content",
      "themes",
      "plugins",
      "media",
      "members",
      "auth_credentials",
      "config",
    ])
      assert.deepEqual(
        await rows(target, table),
        await rows(source, table),
        table,
      );
    assert.deepEqual(
      (await output.get("media/photo.png")).body,
      Buffer.from([0, 255, 12, 128]),
    );
    assert.equal((await rows(target, "auth_sessions")).length, 0);
    assert.deepEqual(localSnapshot(directory), before);
    await migrateLocalData(target, output, directory);
    assert.equal((await rows(target, "content")).length, 3);
    assert.ok(logs.some((message) => message.includes("verified upload")));
  }));

test("migration preflight preserves conflicting production edits/files and rejects missing referenced uploads", async () =>
  fixture(async ({ directory, source, target, files, output }) => {
    await localContent(source, files);
    await seedBuiltInData(target);
    await target
      .prepare("UPDATE content SET title=? WHERE id=?")
      .bind("Production edit", "welcome")
      .run();
    await assert.rejects(
      migrateLocalData(target, output, directory),
      /conflict/,
    );
    assert.equal(await output.get("media/photo.png"), null);
    assert.equal((await rows(target, "members")).length, 0);
    await target
      .prepare("DELETE FROM content WHERE id=?")
      .bind("welcome")
      .run();
    await output.put(
      "media/photo.png",
      Buffer.from("existing production file"),
    );
    await assert.rejects(
      migrateLocalData(target, output, directory),
      /Storage migration conflict/,
    );
    assert.equal(
      (await output.get("media/photo.png")).body.toString(),
      "existing production file",
    );
    await output.delete("media/photo.png");
    await files.delete("media/photo.png");
    await assert.rejects(
      migrateLocalData(target, output, directory),
      /Local upload missing/,
    );
    assert.equal((await rows(target, "media")).length, 0);
  }));

test("failed file copy leaves database unchanged and retry verifies and completes", async () =>
  fixture(async ({ directory, source, target, files, output }) => {
    await localContent(source, files);
    const failing = {
      ...output,
      put: async () => {
        throw new Error("offline");
      },
    };
    await assert.rejects(
      migrateLocalData(target, failing, directory),
      /offline/,
    );
    assert.equal((await rows(target, "content")).length, 0);
    assert.equal((await rows(target, "members")).length, 0);
    await migrateLocalData(target, output, directory);
    assert.equal((await rows(target, "media")).length, 1);
  }));

test("connection initialization seeds automatically, migrates only when checked, and test never copies", async () =>
  fixture(async ({ directory, source, target, files, output }) => {
    await localContent(source, files);
    const manager = connectionManager({
      localDataDir: directory,
      hostEnv: {
        ...connectionDefaults,
        CMS_STORAGE_PROVIDER: "gridfs",
        MONGODB_URI: "mongodb://example",
      },
      connectors: {
        mongo: async () => ({ ...target, close: async () => {} }),
        gridfs: async () => output,
      },
    });
    const wait = async (id) => {
      for (let i = 0; i < 200 && !manager.job(id).finishedAt; i++)
        await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(
        manager.job(id).status,
        "completed",
        JSON.stringify(manager.job(id)),
      );
    };
    // Keep fixture-owned target open between runs.
    await wait((await manager.start("test")).id);
    assert.equal((await rows(target, "content")).length, 0);
    assert.equal((await rows(target, "members")).length, 0);
    const initialization = await manager.start("initialize");
    await wait(initialization.id);
    assert.equal(
      (await rows(target, "content"))[2].title !== "Local portfolio",
      true,
    );
    assert.equal((await rows(target, "media")).length, 0);
    assert.equal((await rows(target, "members")).length, 1);
    assert.ok(
      (
        await passwordAuth(target).login(
          "author@example.com",
          "migration administrator password",
        )
      ).cookie,
    );
    const logs = JSON.stringify(manager.job(initialization.id));
    assert.ok(!logs.includes("migration administrator password"));
    assert.ok(
      !logs.includes((await rows(source, "auth_credentials"))[0].password_hash),
    );
    await wait((await manager.start("initialize", { migrateLocal: true })).id);
    assert.equal(
      (
        await target
          .prepare("SELECT title FROM content WHERE id=?")
          .bind("welcome")
          .first()
      ).title,
      "Local portfolio",
    );
    assert.equal((await rows(target, "media")).length, 1);
    await assert.rejects(
      manager.start("test", { migrateLocal: true }),
      /requires schema/,
    );
    await assert.rejects(
      manager.start("initialize", { migrateLocal: "true" }),
      /whether/,
    );
  }));
