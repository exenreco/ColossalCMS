import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localDatabase } from "../scripts/local-database.mjs";
import { passwordAuth } from "../scripts/password-auth.mjs";
import { handleNodeAuth } from "../scripts/node-auth.mjs";
import { startProductionServer } from "../scripts/production-server.mjs";

const token = "isolated-test-setup-token-32-characters";
const password = "isolated administrator password";

test("local development generates a private token, requires sign-in and retains setup after restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "colossal-local-auth-"));
  let child;
  const start = () =>
    new Promise((resolve, reject) => {
      const env = { ...process.env, CMS_DATA_DIR: directory, CMS_PORT: "0" };
      delete env.CMS_SETUP_TOKEN;
      delete env.CMS_DEV_AUTH_BYPASS;
      child = spawn(process.execPath, ["scripts/dev-server.mjs"], {
        env,
        windowsHide: true,
      });
      let output = "";
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error("Local auth server did not start."));
      }, 15000);
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.stdout.on("data", (data) => {
        output += data;
        const match = output.match(/Local: (http:\/\/127\.0\.0\.1:\d+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        if (!output.includes("Local:"))
          reject(new Error("Local auth server exited: " + code));
      });
    });
  const stop = async () => {
    if (child && child.exitCode === null) {
      const closed = once(child, "exit");
      child.kill();
      await closed;
    }
    child = undefined;
  };
  try {
    let base = await start();
    const generatedToken = (
      await readFile(join(directory, "setup-token"), "utf8")
    ).trim();
    assert.match(generatedToken, /^[a-f0-9]{64}$/);
    assert.equal(
      (await fetch(base + "/admin/", { redirect: "manual" })).headers.get(
        "location",
      ),
      "/setup",
    );
    assert.equal(
      (
        await fetch(base + "/api/admin/session", {
          headers: {
            "oai-authenticated-user-id": "owner",
            "oai-authenticated-user-email": "spoof@example.test",
          },
        })
      ).status,
      401,
    );
    const post = (path, body) =>
      fetch(base + path, {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    assert.equal(
      (
        await post("/api/auth/setup", {
          email: "local-owner@example.test",
          password,
          token: generatedToken,
        })
      ).status,
      200,
    );
    const login = await post("/api/auth/login", {
      email: "local-owner@example.test",
      password,
    });
    const cookie = login.headers.get("set-cookie");
    assert.equal(login.status, 200);
    assert.ok(!cookie.includes("Secure"));
    assert.equal(
      (
        await fetch(base + "/api/admin/session", {
          headers: { cookie: cookie.split(";")[0] },
        })
      ).status,
      200,
    );
    await stop();
    base = await start();
    assert.equal(
      (await fetch(base + "/setup", { redirect: "manual" })).headers.get(
        "location",
      ),
      "/login",
    );
    assert.equal(
      (await readFile(join(directory, "setup-token"), "utf8")).trim(),
      generatedToken,
    );
    assert.equal(
      (
        await post("/api/auth/setup", {
          email: "replacement@example.test",
          password,
          token: generatedToken,
        })
      ).status,
      409,
    );
  } finally {
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("first-run owner setup validates token, email and password, and permanently closes after success", async () => {
  const db = localDatabase(),
    auth = passwordAuth(db, { setupToken: token });
  try {
    assert.equal(await auth.setupNeeded(), true);
    await assert.rejects(
      auth.setup("owner@example.test", password, "wrong"),
      /Invalid setup token/,
    );
    await assert.rejects(
      auth.setup("bad email", password, token),
      /valid administrator email/,
    );
    await assert.rejects(
      auth.setup("owner@example.test", "short", token),
      /at least/,
    );
    assert.equal(await db.prepare("SELECT id FROM members").first(), null);
    await auth.setup(" Owner@Example.test ", password, token);
    assert.equal(await auth.setupNeeded(), false);
    const owner = await db
      .prepare("SELECT * FROM members WHERE id='owner'")
      .first();
    assert.equal(owner.email, "owner@example.test");
    assert.equal(owner.role, "admin");
    assert.match(
      (
        await db
          .prepare(
            "SELECT password_hash FROM auth_credentials WHERE id='owner'",
          )
          .first()
      ).password_hash,
      /^\$2b\$12\$/,
    );
    assert.ok((await auth.login(owner.email, password)).cookie);
    await assert.rejects(
      auth.setup("replacement@example.test", password, token),
      /already complete/,
    );
    assert.equal(
      (await db.prepare("SELECT email FROM members WHERE id='owner'").first())
        .email,
      owner.email,
    );
  } finally {
    db.close();
  }
});

test("setup handles legacy owners without changing member ids and never takes another member's email", async () => {
  const db = localDatabase(),
    auth = passwordAuth(db, { setupToken: token });
  try {
    await db
      .prepare(
        "INSERT INTO members (id,email,role) VALUES ('owner','legacy@example.test','admin')",
      )
      .run();
    await auth.setPassword("member@example.test", password);
    await assert.rejects(
      auth.setup("member@example.test", password, token),
      /another member/,
    );
    assert.equal(await auth.setupNeeded(), true);
    await auth.setup("chosen@example.test", password, token);
    assert.equal(
      (await db.prepare("SELECT email FROM members WHERE id='owner'").first())
        .email,
      "chosen@example.test",
    );
    assert.equal(
      (
        await db
          .prepare("SELECT role FROM members WHERE email='member@example.test'")
          .first()
      ).role,
      "editor",
    );
  } finally {
    db.close();
  }
});

test("setup tokens fail closed and attempts are rate limited", async () => {
  const db = localDatabase();
  let time = Date.now();
  const auth = passwordAuth(db, { setupToken: token, clock: () => time });
  try {
    await assert.rejects(
      passwordAuth(db).setup("owner@example.test", password, ""),
      /Invalid setup token/,
    );
    for (let n = 0; n < 10; n++)
      await assert.rejects(
        auth.setup("owner@example.test", password, "wrong", "client"),
        /Invalid setup token/,
      );
    await assert.rejects(
      auth.setup("owner@example.test", password, token, "client"),
      /Too many setup attempts/,
    );
    time += 16 * 60 * 1000;
    await auth.setup("owner@example.test", password, token, "client");
  } finally {
    db.close();
  }
});

test("concurrent setup attempts create exactly one owner credential", async () => {
  const db = localDatabase(),
    auth = passwordAuth(db, { setupToken: token });
  try {
    const results = await Promise.allSettled([
      auth.setup("first@example.test", password, token),
      auth.setup("second@example.test", password, token),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (await db.prepare("SELECT * FROM auth_credentials").all()).results.length,
      1,
    );
    assert.equal(
      (await db.prepare("SELECT * FROM members").all()).results.length,
      1,
    );
  } finally {
    db.close();
  }
});

test("setup pages keep tokens private and auth requests enforce origin and valid JSON", async () => {
  const db = localDatabase(),
    auth = passwordAuth(db, { setupToken: token });
  const request = (path, body, origin = "https://cms.test") =>
    new Request("https://cms.test" + path, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body,
    });
  try {
    const page = await handleNodeAuth(
      new Request("https://cms.test/setup"),
      auth,
    );
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.ok(html.includes("Create administrator"));
    assert.ok(!html.includes(token));
    assert.equal(page.headers.get("Cache-Control"), "no-store");
    assert.match(
      page.headers.get("Content-Security-Policy"),
      /frame-ancestors 'none'/,
    );
    assert.equal(
      (
        await handleNodeAuth(new Request("https://cms.test/login"), auth)
      ).headers.get("Location"),
      "/setup",
    );
    await assert.rejects(
      handleNodeAuth(
        request("/api/auth/setup", "{}", "https://evil.test"),
        auth,
      ),
      /must come from your site/,
    );
    for (const body of ["bad", "null", "[]"])
      await assert.rejects(
        handleNodeAuth(request("/api/auth/setup", body), auth),
        /valid JSON/,
      );
  } finally {
    db.close();
  }
});

test("Node hosting redirects new sites to setup, disables setup after creation and supports sign-in", async () => {
  const DB = localDatabase(),
    AUTH = passwordAuth(DB, { setupToken: token });
  let server;
  try {
    server = await startProductionServer(
      { CMS_PUBLIC_URL: "https://cms.test", PORT: "0" },
      async () => ({ DB, AUTH, PASSWORD_AUTH: true, STORAGE: {} }),
    );
    if (!server.listening) await once(server, "listening");
    const base = "http://127.0.0.1:" + server.address().port;
    const post = (path, body) =>
      fetch(base + path, {
        method: "POST",
        headers: {
          Origin: "https://cms.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await fetch(base + "/admin/", { redirect: "manual" })).headers.get(
        "location",
      ),
      "/setup",
    );
    assert.equal((await fetch(base + "/setup")).status, 200);
    assert.equal(
      (
        await post("/api/auth/setup", {
          email: "owner@example.test",
          password,
          token: "wrong",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await post("/api/auth/setup", {
          email: "owner@example.test",
          password,
          token,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post("/api/auth/setup", {
          email: "other@example.test",
          password,
          token,
        })
      ).status,
      409,
    );
    assert.equal(
      (await fetch(base + "/setup", { redirect: "manual" })).headers.get(
        "location",
      ),
      "/login",
    );
    assert.equal(
      (await fetch(base + "/admin/", { redirect: "manual" })).headers.get(
        "location",
      ),
      "/login",
    );
    const login = await post("/api/auth/login", {
      email: "owner@example.test",
      password,
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
        await fetch(base + "/login", {
          headers: { cookie },
          redirect: "manual",
        })
      ).headers.get("location"),
      "/admin/",
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    DB.close();
  }
});
