import test from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "../scripts/local-database.mjs";
import { passwordAuth, hashPassword } from "../scripts/password-auth.mjs";
import {
  loginSecurity,
  normalizeIp,
  LOGIN_SECURITY_ID,
} from "../server/login-security.mjs";
import { handleNodeAuth, authPage } from "../scripts/node-auth.mjs";
import { clientIp } from "../scripts/client-ip.mjs";
import { parseSql } from "../scripts/mongo-database.mjs";
import worker, { initialize } from "../server/worker.mjs";
import { createVercelHandler } from "../scripts/vercel-handler.mjs";

const password = "login security test password";
const hash = hashPassword(password);
async function fixture() {
  const db = localDatabase();
  let time = Date.parse("2026-10-06T12:00:00Z");
  const clock = () => time;
  const auth = passwordAuth(db, { clock });
  await auth.bootstrap("owner@example.test", await hash);
  await initialize(db, { email: "owner@example.test" });
  const manager = loginSecurity(db, { clock });
  await manager.save({
    enabled: true,
    maxAttempts: 2,
    windowMinutes: 15,
    blockMinutes: 1,
    retentionDays: 7,
  });
  return {
    db,
    auth,
    manager,
    clock,
    advance: (milliseconds) => (time += milliseconds),
  };
}

test("login blocks persist across auth instances, isolate IPs, expire and reset counters", async () => {
  const { db, auth, manager, clock, advance } = await fixture();
  try {
    await assert.rejects(
      auth.login("owner@example.test", "incorrect", "203.0.113.5"),
      (error) => error.status === 401 && error.remainingAttempts === 1,
    );
    await assert.rejects(
      auth.login("missing@example.test", "incorrect", "203.0.113.5"),
      (error) => error.status === 429 && error.retryAfter === 60,
    );
    const fresh = passwordAuth(db, { clock });
    await assert.rejects(
      fresh.login("owner@example.test", password, "203.0.113.5"),
      (error) => error.status === 429,
    );
    assert.ok(
      (await fresh.login("owner@example.test", password, "203.0.113.6")).cookie,
    );
    let overview = await manager.overview("203.0.113.6");
    assert.equal(overview.blocks.length, 1);
    assert.equal(overview.blocks[0].source, "automatic");
    assert.ok(overview.events.some((event) => event.outcome === "blocked"));
    assert.ok(!JSON.stringify(overview).includes(password));
    advance(61000);
    assert.ok(
      (await fresh.login("owner@example.test", password, "203.0.113.5")).cookie,
    );
    overview = await manager.overview("203.0.113.6");
    assert.equal(overview.blocks.length, 0);
    assert.equal(
      overview.windows.find((row) => row.ip === "203.0.113.5").attempts,
      0,
    );
  } finally {
    db.close();
  }
});

test("manual blocks, unblock/reset, successful login reset, retention and disabling are enforced", async () => {
  const { db, auth, manager, advance } = await fixture();
  try {
    await manager.addBlock(
      { ip: "::ffff:203.0.113.8", reason: "Repeated misuse", minutes: 0 },
      "203.0.113.9",
    );
    await assert.rejects(
      auth.login("owner@example.test", password, "203.0.113.8"),
      (error) => error.status === 429 && error.retryAfter === undefined,
    );
    await manager.removeBlock({ ip: "203.0.113.8" });
    await assert.rejects(
      auth.login("owner@example.test", "incorrect", "203.0.113.8"),
      (error) => error.status === 401,
    );
    assert.ok(
      (await auth.login("owner@example.test", password, "203.0.113.8")).cookie,
    );
    await assert.rejects(
      auth.login("owner@example.test", "incorrect", "203.0.113.8"),
      (error) => error.status === 401 && error.remainingAttempts === 1,
    );
    await assert.rejects(
      manager.addBlock(
        { ip: "::ffff:203.0.113.9", reason: "", minutes: 0 },
        "203.0.113.9",
      ),
      /current IP/,
    );
    await assert.rejects(
      manager.addBlock({ ip: "203.0.113.0/24", reason: "", minutes: 0 }),
      /valid IPv4/,
    );
    await assert.rejects(
      manager.save({ enabled: true, maxAttempts: 0 }),
      /maxAttempts/,
    );
    await manager.addBlock({
      ip: "203.0.113.10",
      reason: "Permanent",
      minutes: 0,
    });
    advance(8 * 86400000);
    const overview = await manager.overview();
    assert.equal(overview.events.length, 0);
    assert.equal(overview.windows.length, 0);
    assert.equal(overview.blocks.length, 1);
    await manager.save({ ...(await manager.settings()), enabled: false });
    assert.ok(
      (await auth.login("owner@example.test", password, "203.0.113.10")).cookie,
    );
    assert.equal((await manager.overview()).events.length, 0);
  } finally {
    db.close();
  }
});

test("simultaneous reservations on independent security managers cannot bypass an IP limit", async () => {
  const { db, manager, clock } = await fixture();
  try {
    const other = loginSecurity(db, { clock });
    const results = await Promise.allSettled([
      manager.begin("203.0.113.11", "one@example.test"),
      other.begin("203.0.113.11", "two@example.test"),
      manager.begin("203.0.113.11", "three@example.test"),
    ]);
    assert.ok(
      results.filter((result) => result.status === "fulfilled").length <= 2,
    );
    assert.ok(
      results.some(
        (result) =>
          result.status === "rejected" && result.reason.status === 429,
      ),
    );
    assert.equal((await manager.overview()).blocks.length, 1);
    await assert.rejects(
      other.begin("203.0.113.11", "four@example.test"),
      (error) => error.status === 429,
    );
  } finally {
    db.close();
  }
});

test("login form responses provide remaining attempts and Retry-After with a countdown", async () => {
  const { db, auth } = await fixture();
  try {
    const request = () =>
      new Request("https://cms.test/api/auth/login", {
        method: "POST",
        headers: {
          Origin: "https://cms.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "owner@example.test",
          password: "incorrect",
        }),
      });
    const first = await handleNodeAuth(request(), auth, "203.0.113.12");
    assert.equal(first.status, 401);
    assert.equal((await first.json()).remainingAttempts, 1);
    const blocked = await handleNodeAuth(request(), auth, "203.0.113.12");
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("Retry-After"), "60");
    assert.equal((await blocked.json()).retryAfter, 60);
    assert.match(authPage(), /setInterval\(updateCountdown/);
    assert.match(authPage(), /data.remainingAttempts/);
  } finally {
    db.close();
  }
});

test("security administration requires an admin and same-origin requests and supports block removal", async () => {
  const { db } = await fixture();
  try {
    await db
      .prepare(
        "INSERT INTO members (id,email,role) VALUES ('editor','editor@example.test','editor')",
      )
      .run();
    const env = { DB: db, PASSWORD_AUTH: true };
    const call = (path, options = {}) =>
      worker.fetch(
        new Request("https://cms.test/api/admin/login-security" + path, {
          method: options.method || "GET",
          headers: {
            "oai-authenticated-user-id": options.id || "owner",
            "oai-authenticated-user-email":
              options.email || "owner@example.test",
            "x-cms-client-ip": "203.0.113.20",
            Origin: options.origin || "https://cms.test",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        }),
        env,
      );
    assert.equal(
      (await call("", { id: "editor", email: "editor@example.test" })).status,
      403,
    );
    assert.equal(
      (
        await worker.fetch(
          new Request("https://cms.test/api/admin/login-security"),
          env,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await call("/block", {
          method: "POST",
          origin: "https://evil.test",
          body: { ip: "203.0.113.21", reason: "", minutes: 0 },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/block", {
          method: "POST",
          body: { ip: "203.0.113.20", reason: "", minutes: 0 },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call("/block", {
          method: "POST",
          body: { ip: "203.0.113.21", reason: "Manual block", minutes: 0 },
        })
      ).status,
      200,
    );
    const state = await (await call("")).json();
    assert.equal(state.active, true);
    assert.equal(state.blocks[0].ip, "203.0.113.21");
    assert.equal(
      (await call("/unblock", { method: "POST", body: { ip: "203.0.113.21" } }))
        .status,
      200,
    );
    assert.equal((await (await call("")).json()).blocks.length, 0);
  } finally {
    db.close();
  }
});

test("client IPs canonicalize IPv6 and trust forwarding only on the Vercel adapter", () => {
  assert.equal(normalizeIp("::ffff:203.0.113.22"), "203.0.113.22");
  assert.equal(
    normalizeIp("2001:0DB8:0000:0000:0000:0000:0000:0001"),
    "2001:db8::1",
  );
  for (const invalid of [
    "999.1.1.1",
    "203.0.113.0/24",
    "evil.test",
    "[::1]",
    "::1%eth0",
  ])
    assert.equal(normalizeIp(invalid), null);
  const request = {
    headers: {
      "x-forwarded-for": "203.0.113.22",
      "x-cms-client-ip": "203.0.113.99",
    },
    socket: { remoteAddress: "::ffff:127.0.0.1" },
  };
  assert.equal(clientIp(request), "127.0.0.1");
  assert.equal(clientIp(request, { vercel: true }), "203.0.113.22");
});

test("Vercel login limits use verified visitor IPs and ignore forged internal IP headers", async () => {
  const { db, auth, manager } = await fixture();
  try {
    const handler = createVercelHandler(
      { CMS_PUBLIC_URL: "https://cms.test", VERCEL: "1" },
      async () => ({ DB: db, AUTH: auth, PASSWORD_AUTH: true }),
    );
    const call = async (ip, passwordValue) => {
      let status;
      await handler(
        {
          url: "/api/cms?__cmsPath=/api/auth/login",
          method: "POST",
          headers: {
            "x-forwarded-for": ip,
            "x-cms-client-ip": "203.0.113.99",
            origin: "https://cms.test",
            "content-type": "application/json",
          },
          body: { email: "owner@example.test", password: passwordValue },
          socket: { remoteAddress: "10.0.0.1" },
        },
        {
          writeHead(code) {
            status = code;
          },
          end() {},
        },
      );
      return status;
    };
    assert.equal(await call("203.0.113.30", "incorrect"), 401);
    assert.equal(await call("203.0.113.30", "incorrect"), 429);
    assert.equal(await call("203.0.113.31", password), 200);
    const state = await manager.overview();
    assert.equal(state.blocks[0].ip, "203.0.113.30");
    assert.ok(
      state.events.some(
        (event) => event.ip === "203.0.113.31" && event.outcome === "success",
      ),
    );
    assert.ok(
      !state.events.some(
        (event) => event.ip === "203.0.113.99" || event.ip === "10.0.0.1",
      ),
    );
  } finally {
    db.close();
  }
});

test("security SQL is compatible with the MongoDB adapter and counters use atomic increments", async () => {
  const { db, clock } = await fixture();
  const statements = [];
  const prepare = (sql, args = []) => {
    const original = db.prepare(sql).bind(...args);
    return {
      sql,
      args,
      original,
      bind: (...values) => prepare(sql, values),
      first: () => {
        statements.push({ sql, args });
        return original.first();
      },
      all: () => {
        statements.push({ sql, args });
        return original.all();
      },
      run: () => {
        statements.push({ sql, args });
        return original.run();
      },
    };
  };
  const tracked = {
    prepare,
    batch: (items) => {
      statements.push(...items.map(({ sql, args }) => ({ sql, args })));
      return db.batch(items.map((item) => item.original));
    },
  };
  try {
    const manager = loginSecurity(tracked, { clock });
    await manager.save(await manager.settings());
    await manager.finish(
      await manager.begin("203.0.113.24", "test@example.test"),
      false,
    );
    await manager.finish(
      await manager.begin("203.0.113.25", "test@example.test"),
      true,
    );
    await manager.addBlock({
      ip: "203.0.113.24",
      reason: "manual",
      minutes: 10,
    });
    await manager.overview();
    await manager.removeBlock({ ip: "203.0.113.24" });
    for (const { sql, args } of statements)
      assert.doesNotThrow(() => parseSql(sql, args), sql);
    assert.ok(
      statements.some(
        ({ sql, args }) => parseSql(sql, args).increments?.attempts === 1,
      ),
    );
  } finally {
    db.close();
  }
});
