import test from "node:test";
import assert from "node:assert/strict";
import { requestDatabase } from "../server/request-performance.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { mongoAdapter, connectMongo } from "../scripts/mongo-database.mjs";
import { productionSchema } from "../scripts/production-schema.mjs";
import { responsiveSourceSet } from "../plugins/media/delivery.mjs";
import { seedBuiltInData } from "../scripts/data-migration.mjs";

test("request reads coalesce, isolate mutable rows, invalidate on writes and preserve bound batches", async () => {
  const base = localDatabase();
  try {
    await base
      .prepare("INSERT INTO config (id,value) VALUES ('test','before')")
      .run();
    const { db, stats } = requestDatabase(base);
    const read = () =>
      db.prepare("SELECT value FROM config WHERE id=?").bind("test").first();
    const [one, two] = await Promise.all([read(), read()]);
    assert.equal(stats.count, 1);
    assert.equal(stats.reused, 1);
    one.value = "mutated";
    assert.equal(two.value, "before");
    await db
      .prepare("UPDATE config SET value=? WHERE id=?")
      .bind("after", "test")
      .run();
    assert.equal((await read()).value, "after");
    await db.batch([
      db
        .prepare("UPDATE config SET value=? WHERE id=?")
        .bind("batched", "test"),
    ]);
    assert.equal((await read()).value, "batched");
    const another = requestDatabase(base);
    assert.equal(
      (
        await another.db
          .prepare("SELECT value FROM config WHERE id=?")
          .bind("test")
          .first()
      ).value,
      "batched",
    );
    assert.equal(another.stats.count, 1);
    assert.equal(db.cacheIdentity, base);
  } finally {
    base.close();
  }
});

test("Mongo first reads limit results at the server and narrow reads project fields", async () => {
  let options, limit;
  const db = mongoAdapter(
    {},
    {
      collection: () => ({
        find(filter, supplied) {
          options = supplied;
          return {
            limit(value) {
              limit = value;
              return this;
            },
            toArray: async () => [{ id: "one", value: "yes" }],
          };
        },
      }),
    },
  );
  assert.deepEqual(
    await db.prepare("SELECT value FROM config WHERE id=?").bind("one").first(),
    { value: "yes" },
  );
  assert.equal(limit, 1);
  assert.deepEqual(options.projection, { value: 1 });
  await db.prepare("SELECT * FROM config").all();
  assert.equal(options.projection, undefined);
});

test("Mongo schema provisioning runs once per schema and failed runs do not mark completion", async () => {
  const markers = new Map();
  const collections = new Set();
  let writes = 0,
    failIndex = false;
  const database = {
    command: async () => ({}),
    admin: () => ({ command: async () => ({ setName: "test" }) }),
    listCollections: () => ({
      toArray: async () => [...collections].map((name) => ({ name })),
    }),
    createCollection: async (name) => {
      collections.add(name);
      writes++;
    },
    collection: () => ({
      findOne: async ({ id }) => markers.get(id),
      updateOne: async ({ id }, update) => {
        markers.set(id, update.$set);
      },
      createIndex: async () => {
        if (failIndex) throw new Error("index failed");
        writes++;
      },
    }),
  };
  const client = {
    connect: async () => {},
    db: () => database,
    close: async () => {},
  };
  const config = {
    MONGODB_URI: "mongodb://example.test",
    MONGODB_DATABASE: "test",
    MONGODB_DNS_SERVERS: "",
  };
  await connectMongo(config, () => {}, true, client);
  assert.ok(writes > 0);
  writes = 0;
  await connectMongo(config, () => {}, true, client);
  assert.equal(writes, 0);
  markers.clear();
  failIndex = true;
  await assert.rejects(connectMongo(config, () => {}, true, client));
  assert.equal(markers.size, 0);
  const schema = productionSchema();
  assert.ok(
    schema.content.indexes.some(
      (index) => index.fields.join() === "status,publish_at",
    ),
  );
  assert.ok(
    schema.themes.indexes.some((index) => index.fields.join() === "active"),
  );
});

test("responsive source sets are bounded, versioned and preserve preview access", () => {
  const source = responsiveSourceSet(
    {
      id: "img",
      type: "image",
      mime: "image/png",
      updatedAt: "version",
      metadata: { width: 1500 },
    },
    "private-token",
  );
  assert.match(source, /width=320/);
  assert.match(source, /width=1280/);
  assert.doesNotMatch(source, /width=1920/);
  assert.match(source, /v=version/);
  assert.match(source, /themePreview=private-token/);
  assert.equal(
    responsiveSourceSet({
      type: "image",
      mime: "image/svg+xml",
      updatedAt: "v",
      metadata: { width: 500 },
    }),
    "",
  );
});

test("bundled startup seeds once per deployment, retries failures, and preserves existing content", async () => {
  const db = localDatabase();
  const previous = globalThis.__CMS_CACHE_BUILD_ID__;
  globalThis.__CMS_CACHE_BUILD_ID__ = "performance-test-build";
  try {
    await seedBuiltInData(db);
    const content = await db.prepare("SELECT id,title FROM content").first();
    await db
      .prepare("UPDATE content SET title=? WHERE id=?")
      .bind("User edits preserved", content.id)
      .run();
    let reported = 0;
    await seedBuiltInData(db, () => reported++);
    assert.equal(reported, 0, "already provisioned deployment does not reseed");
    globalThis.__CMS_CACHE_BUILD_ID__ = "performance-test-next-build";
    const prepare = db.prepare;
    db.prepare = (sql) => {
      if (sql.includes("glassey-theme-v1"))
        throw new Error("provisioning failed");
      return prepare(sql);
    };
    await assert.rejects(seedBuiltInData(db), /provisioning failed/);
    db.prepare = prepare;
    assert.equal(
      (
        await db
          .prepare("SELECT value FROM config WHERE id='runtime:builtins'")
          .first()
      ).value,
      "performance-test-build",
    );
    await seedBuiltInData(db);
    assert.equal(
      (
        await db
          .prepare("SELECT value FROM config WHERE id='runtime:builtins'")
          .first()
      ).value,
      "performance-test-next-build",
    );
    assert.equal(
      (
        await db
          .prepare("SELECT title FROM content WHERE id=?")
          .bind(content.id)
          .first()
      ).title,
      "User edits preserved",
    );
  } finally {
    if (previous === undefined) delete globalThis.__CMS_CACHE_BUILD_ID__;
    else globalThis.__CMS_CACHE_BUILD_ID__ = previous;
    db.close();
  }
});
