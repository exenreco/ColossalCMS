import test from "node:test";
import assert from "node:assert/strict";
import { createVercelHandler } from "../scripts/vercel-handler.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { passwordAuth, hashPassword } from "../scripts/password-auth.mjs";
import { buildVercelRuntime } from "../scripts/build-vercel-runtime.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

test("Vercel bundle serves setup without CommonJS require of ESM support", async () => {
  const directory = await mkdtemp(resolve("tests/.vercel-bundle-"));
  try {
    const file = join(directory, "runtime.mjs");
    await buildVercelRuntime(file);
    const code = `
      import assert from 'node:assert/strict';
      const { createVercelHandler } = await import(${JSON.stringify(pathToFileURL(file).href)});
      const handler = createVercelHandler(
        { CMS_PUBLIC_URL: 'https://cms.test' },
        async () => ({ AUTH: { setupNeeded: async () => true } }),
      );
      let status, body;
      await handler({ url: '/api/cms?__cmsPath=/setup', method: 'GET', headers: {} }, {
        writeHead(value) { status = value; },
        end(value) { body = Buffer.from(value).toString(); },
      });
      assert.equal(status, 200);
      assert.match(body, /Create administrator/);
    `;
    const result = spawnSync(
      process.execPath,
      ["--no-experimental-require-module", "--input-type=module", "-e", code],
      { encoding: "utf8", timeout: 30000 },
    );
    assert.equal(result.status, 0, result.stderr || result.error?.message);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function call(handler, path, options = {}) {
  let status, headers, data;
  await handler(
    {
      url: "/api/cms?__cmsPath=" + encodeURIComponent(path),
      method: options.method || "GET",
      headers: options.headers || {},
      body: options.body,
      socket: { remoteAddress: "test-client" },
    },
    {
      writeHead(code, values) {
        status = code;
        headers = new Headers(values);
      },
      end(value) {
        data = value ? Buffer.from(value).toString() : "";
      },
    },
  );
  return { status, headers, data };
}

test("Vercel reuses connections, routes parsed JSON, enforces password identity and origin", async () => {
  const DB = localDatabase(),
    AUTH = passwordAuth(DB);
  let starts = 0;
  await AUTH.bootstrap(
    "vercel@example.test",
    await hashPassword("vercel integration password"),
  );
  const handler = createVercelHandler(
    { CMS_PUBLIC_URL: "https://cms.test" },
    async () => {
      starts++;
      return { DB, AUTH, PASSWORD_AUTH: true, STORAGE: {} };
    },
  );
  try {
    const [one, two] = await Promise.all([
      call(handler, "/healthz"),
      call(handler, "/healthz"),
    ]);
    assert.equal(one.status, 200);
    assert.equal(two.status, 200);
    assert.equal(starts, 1);
    assert.equal(one.headers.get("Cache-Control"), "no-store");
    assert.equal(
      (await call(handler, "/admin/posts")).headers.get("Location"),
      "/login",
    );
    assert.equal(
      (
        await call(handler, "/api/admin/session", {
          headers: {
            "oai-authenticated-user-id": "owner",
            "oai-authenticated-user-email": "vercel@example.test",
          },
        })
      ).status,
      401,
    );
    const login = {
      method: "POST",
      body: {
        email: "vercel@example.test",
        password: "vercel integration password",
      },
      headers: {
        Origin: "https://cms.test",
        "Content-Type": "application/json",
      },
    };
    assert.equal(
      (
        await call(handler, "/api/auth/login", {
          ...login,
          headers: { ...login.headers, Origin: "https://evil.test" },
        })
      ).status,
      403,
    );
    const signedIn = await call(handler, "/api/auth/login", login);
    assert.equal(signedIn.status, 200);
    assert.match(signedIn.headers.get("Set-Cookie"), /Secure/);
    const cookie = signedIn.headers.get("Set-Cookie").split(";")[0];
    assert.equal(
      (await call(handler, "/api/admin/session", { headers: { cookie } }))
        .status,
      200,
    );
    assert.equal(
      (
        await call(handler, "/api/auth/logout", {
          method: "POST",
          body: {},
          headers: { ...login.headers, cookie },
        })
      ).status,
      200,
    );
    assert.equal(
      (await call(handler, "/api/admin/session", { headers: { cookie } }))
        .status,
      401,
    );
    assert.equal(starts, 1);
  } finally {
    DB.close();
  }
});

test("Vercel retries failed initialization without revealing secrets and rejects invalid configuration/paths", async () => {
  let starts = 0;
  const handler = createVercelHandler(
    { CMS_PUBLIC_URL: "https://cms.test" },
    async () => {
      if (++starts === 1) throw new Error("provider-secret-value");
      return { AUTH: { setupNeeded: async () => false } };
    },
  );
  const failure = await call(handler, "/healthz");
  assert.equal(failure.status, 503);
  assert.ok(!failure.data.includes("provider-secret-value"));
  assert.equal((await call(handler, "/healthz")).status, 200);
  assert.equal((await call(handler, "//evil.test/admin")).status, 400);
  assert.equal(
    (
      await call(handler, "/api/auth/login", {
        method: "POST",
        body: "x".repeat(5 * 1024 * 1024),
      })
    ).status,
    413,
  );
  assert.equal(
    (
      await call(
        createVercelHandler({ CMS_PUBLIC_URL: "http://cms.test" }),
        "/healthz",
      )
    ).status,
    503,
  );
  assert.equal(
    (
      await call(
        createVercelHandler({
          CMS_PUBLIC_URL: "https://cms.test",
          CMS_STORAGE_PROVIDER: "local",
        }),
        "/healthz",
      )
    ).status,
    503,
  );
});

test("Vercel blocks dotenv writes and background connection jobs but supports member passwords", async () => {
  const DB = localDatabase(),
    AUTH = passwordAuth(DB);
  await AUTH.bootstrap(
    "vercel@example.test",
    await hashPassword("vercel integration password"),
  );
  await DB.prepare("INSERT INTO plugins (id,active,installed) VALUES (?,1,1)")
    .bind("com.colossal.production-connections")
    .run();
  const handler = createVercelHandler(
    { CMS_PUBLIC_URL: "https://cms.test" },
    async () => ({
      DB,
      AUTH,
      PASSWORD_AUTH: true,
      STORAGE: {},
      CONNECTIONS: {
        describe: async () => ({
          fields: [],
          active: { database: "mongodb", storage: "gridfs" },
        }),
      },
    }),
  );
  try {
    const login = await call(handler, "/api/auth/login", {
      method: "POST",
      headers: {
        Origin: "https://cms.test",
        "Content-Type": "application/json",
      },
      body: {
        email: "vercel@example.test",
        password: "vercel integration password",
      },
    });
    const headers = {
      Origin: "https://cms.test",
      "Content-Type": "application/json",
      cookie: login.headers.get("Set-Cookie").split(";")[0],
    };
    const config = await call(handler, "/api/admin/connections", { headers });
    assert.equal(config.status, 200);
    assert.equal(JSON.parse(config.data).readOnly, true);
    for (const path of ["save", "run"])
      assert.equal(
        (
          await call(handler, "/api/admin/connections/" + path, {
            method: "POST",
            headers,
            body: {},
          })
        ).status,
        409,
      );
    assert.equal(
      (
        await call(handler, "/api/admin/connections/password", {
          method: "POST",
          headers,
          body: {
            email: "editor@example.test",
            password: "new editor password",
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await DB.prepare("SELECT role FROM members WHERE email=?")
          .bind("editor@example.test")
          .first()
      ).role,
      "editor",
    );
  } finally {
    DB.close();
  }
});
