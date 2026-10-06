import test from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "../scripts/local-database.mjs";
import { mongodbHeartbeat } from "../server/mongodb-heartbeat.mjs";
import {
  authorizeHeartbeat,
  HEARTBEAT_PATH,
} from "../scripts/heartbeat-runtime.mjs";
import { createVercelHandler } from "../scripts/vercel-handler.mjs";
import { mongoAdapter, parseSql } from "../scripts/mongo-database.mjs";
import worker, { initialize } from "../server/worker.mjs";

const secret = "isolated-test-cron-secret-32-characters";
async function fixture(pingOverride) {
  const db = localDatabase();
  await initialize(db, { email: "owner@example.test" });
  await db
    .prepare(
      "INSERT INTO members (id,email,role) VALUES ('owner','owner@example.test','admin')",
    )
    .run();
  await db
    .prepare(
      "UPDATE plugins SET active=1,installed=1 WHERE id='com.colossal.production-connections'",
    )
    .run();
  let time = Date.parse("2026-10-06T12:59:00Z"),
    pings = 0;
  const clock = () => time;
  const ping = async () => {
    pings++;
    if (pingOverride) await pingOverride();
  };
  const manager = mongodbHeartbeat({
    db,
    ping,
    mode: "vercel",
    cronConfigured: true,
    clock,
  });
  return {
    db,
    manager,
    ping,
    clock,
    pings: () => pings,
    advance: (ms) => (time += ms),
  };
}

test("heartbeat defaults are daily and disabled, timing persists and UTC days tolerate cron jitter", async () => {
  const { db, manager, pings, advance } = await fixture();
  try {
    assert.deepEqual((await manager.describe()).settings, {
      enabled: false,
      intervalDays: 1,
    });
    assert.deepEqual(await manager.run(), { skipped: "disabled" });
    assert.equal(pings(), 0);
    await manager.save({ enabled: true, intervalDays: 1 });
    assert.equal((await manager.run()).status, "success");
    assert.equal(pings(), 1);
    assert.deepEqual(await manager.run(), { skipped: "not-due" });
    // Next day's cron can run earlier in its hour than yesterday's invocation.
    advance(23 * 3600000 + 60000);
    assert.equal((await manager.run()).status, "success");
    await manager.save({ enabled: true, intervalDays: 7 });
    advance(6 * 86400000);
    assert.deepEqual(await manager.run(), { skipped: "not-due" });
    advance(86400000);
    assert.equal((await manager.run()).status, "success");
    assert.equal((await manager.describe()).settings.intervalDays, 7);
    await assert.rejects(
      manager.save({ enabled: true, intervalDays: 30 }),
      /between 1 and 14/,
    );
    await manager.save({ enabled: false, intervalDays: 1 });
    assert.equal(
      (await manager.run({ force: true, source: "admin" })).status,
      "success",
    );
    await db
      .prepare(
        "UPDATE plugins SET active=0 WHERE id='com.colossal.production-connections'",
      )
      .run();
    assert.deepEqual(await manager.run({ force: true }), {
      skipped: "plugin-inactive",
    });
  } finally {
    db.close();
  }
});

test("persistent heartbeat leases prevent duplicate simultaneous pings across instances", async () => {
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  const { db, manager, clock, ping, pings } = await fixture(() => waiting);
  try {
    await manager.save({ enabled: true, intervalDays: 1 });
    const other = mongodbHeartbeat({ db, ping, mode: "vercel", clock });
    const first = manager.run();
    const second = other.run();
    // Release on the next task after both contenders have claimed/read state.
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    const results = await Promise.all([first, second]);
    assert.equal(
      results.filter((result) => result.status === "success").length,
      1,
    );
    assert.ok(results.some((result) => result.skipped === "already-running"));
    assert.equal(pings(), 1);
  } finally {
    release();
    db.close();
  }
});

test("heartbeat failures are masked, backed off, recover and remain independent of settings", async () => {
  let failed = true;
  const { db, manager, pings, advance } = await fixture(async () => {
    if (failed)
      throw Object.assign(
        new Error("mongodb://private-user:private-secret@private-host"),
        { name: "MongoServerSelectionError" },
      );
  });
  try {
    await manager.save({ enabled: true, intervalDays: 1 });
    const result = await manager.run();
    assert.equal(result.status, "failed");
    assert.match(result.message, /Network Access/);
    assert.doesNotMatch(JSON.stringify(result), /private-/);
    assert.deepEqual(await manager.run(), { skipped: "retry-backoff" });
    assert.equal(pings(), 1);
    advance(3600001);
    failed = false;
    assert.equal((await manager.run()).status, "success");
    assert.equal((await manager.describe()).state.status, "success");
  } finally {
    db.close();
  }
});

test("cron authorization runs before Vercel runtime initialization and does not require an admin session", async () => {
  const { db, manager, pings } = await fixture();
  try {
    await manager.save({ enabled: true, intervalDays: 1 });
    let starts = 0;
    const handler = createVercelHandler(
      { CMS_PUBLIC_URL: "https://cms.test", CRON_SECRET: secret },
      async () => {
        starts++;
        return { HEARTBEAT: manager };
      },
    );
    const call = async (authorization, method = "GET") => {
      let status, data;
      await handler(
        {
          url: "/api/cms?__cmsPath=" + HEARTBEAT_PATH,
          method,
          headers: authorization ? { authorization } : {},
          body: method === "POST" ? {} : undefined,
        },
        {
          writeHead(code) {
            status = code;
          },
          end(body) {
            data = JSON.parse(Buffer.from(body).toString());
          },
        },
      );
      return { status, data };
    };
    assert.equal((await call()).status, 401);
    assert.equal((await call("Bearer wrong")).status, 401);
    assert.equal((await call("Bearer " + secret, "POST")).status, 405);
    assert.equal(starts, 0);
    const result = await call("Bearer " + secret);
    assert.equal(result.status, 200);
    assert.equal(result.data.status, "success");
    assert.equal(pings(), 1);
    assert.equal(starts, 1);
    assert.throws(
      () => authorizeHeartbeat(new Request("https://cms.test"), ""),
      /Configure CRON_SECRET/,
    );
  } finally {
    db.close();
  }
});

test("Connections heartbeat controls remain writable on Vercel, admin-only and same-origin", async () => {
  const { db, manager, pings } = await fixture();
  try {
    await db
      .prepare(
        "INSERT INTO members (id,email,role) VALUES ('editor','editor@example.test','editor')",
      )
      .run();
    const env = {
      DB: db,
      SERVERLESS: true,
      HEARTBEAT: manager,
      CONNECTIONS: {
        describe: async () => ({
          fields: [],
          active: { database: "mongodb", storage: "gridfs" },
        }),
      },
    };
    const call = (path, body, overrides = {}) =>
      worker.fetch(
        new Request("https://cms.test/api/admin/connections" + path, {
          method: body ? "POST" : "GET",
          headers: {
            "oai-authenticated-user-id": overrides.editor ? "editor" : "owner",
            "oai-authenticated-user-email": overrides.editor
              ? "editor@example.test"
              : "owner@example.test",
            Origin: overrides.origin || "https://cms.test",
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        }),
        env,
      );
    const initial = await (await call("")).json();
    assert.equal(initial.readOnly, true);
    assert.equal(initial.heartbeat.settings.intervalDays, 1);
    assert.equal(
      (
        await call(
          "/heartbeat",
          { enabled: true, intervalDays: 1 },
          { editor: true },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "/heartbeat",
          { enabled: true, intervalDays: 1 },
          { origin: "https://evil.test" },
        )
      ).status,
      403,
    );
    assert.equal(
      (await call("/heartbeat", { enabled: true, intervalDays: 1 })).status,
      200,
    );
    assert.equal((await call("/heartbeat/ping", {})).status, 200);
    assert.equal(pings(), 1);
    assert.equal((await call("/save", {})).status, 409);
    const unsupported = mongodbHeartbeat({ db });
    assert.equal((await unsupported.describe()).supported, false);
    await assert.rejects(
      unsupported.run({ force: true }),
      /requires a running MongoDB/,
    );
  } finally {
    db.close();
  }
});

test("native Mongo heartbeat uses a real ping command with a timeout, and lease SQL is portable", async () => {
  const calls = [];
  const adapter = mongoAdapter(
    {},
    {
      command: async (...args) => {
        calls.push(args);
        return { ok: 1 };
      },
    },
    {},
  );
  await adapter.ping();
  assert.deepEqual(calls, [[{ ping: 1 }, { timeoutMS: 10000 }]]);
  const parsed = parseSql(
    "UPDATE config SET value=? WHERE id='mongodb-heartbeat-status' AND value=?",
    ["claimed", "previous"],
  );
  assert.equal(parsed.updates.value, "claimed");
  assert.ok(parsed.filter.$and);
});
