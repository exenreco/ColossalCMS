import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
const DB = localDatabase();
const env = { DB, ASSETS: { fetch: async () => new Response("asset") } };
const owner = {
  "oai-authenticated-user-id": "owner-id",
  "oai-authenticated-user-email": "owner@example.com",
};
async function call(path, method = "GET", body, headers = owner) {
  const r = await worker.fetch(
    new Request("https://cms.test/api" + path, {
      method,
      headers: {
        ...headers,
        Origin: "https://cms.test",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
  return { status: r.status, data: await r.json() };
}
before(async () => {
  assert.equal((await call("/admin/setup", "POST", {})).status, 200);
});
after(() => DB.close());
test("anonymous requests cannot read or modify admin state", async () => {
  assert.equal((await call("/admin/state", "GET", undefined, {})).status, 401);
  assert.equal((await call("/admin/settings", "POST", {}, {})).status, 401);
});
test("setup cannot replace the workspace owner", async () => {
  assert.equal((await call("/admin/setup", "POST", {})).status, 409);
});
test("drafts stay private and publishing persists through a new request", async () => {
  const created = await call("/admin/content", "POST", {
    kind: "post",
    title: "Integration draft",
    slug: "integration-draft",
    body: "A thoughtful story.",
    excerpt: "A test",
    status: "draft",
  });
  assert.equal(created.status, 200);
  assert.ok(
    !(await call("/public")).data.content.some((c) => c.id === created.data.id),
  );
  const stored = (await call("/admin/state")).data.content.find(
    (c) => c.id === created.data.id,
  );
  assert.equal(stored.body, "A thoughtful story.");
  assert.equal(
    (await call("/admin/content", "POST", { ...stored, status: "published" }))
      .status,
    200,
  );
  assert.ok(
    (await call("/public")).data.content.some((c) => c.id === created.data.id),
  );
  assert.equal(
    (await call("/admin/content/" + created.data.id, "DELETE", {})).status,
    200,
  );
  assert.ok(
    !(await call("/public")).data.content.some((c) => c.id === created.data.id),
  );
});
test("scheduling remains private until its publication time", async () => {
  const c = {
    kind: "post",
    title: "Scheduled",
    slug: "scheduled-story",
    body: "Later",
    excerpt: "",
    status: "scheduled",
    publishAt: new Date(Date.now() + 86400000).toISOString(),
  };
  const r = await call("/admin/content", "POST", c);
  assert.equal(r.status, 200);
  assert.ok(
    !(await call("/public")).data.content.some((x) => x.id === r.data.id),
  );
  await DB.prepare("UPDATE content SET publish_at=? WHERE id=?")
    .bind("2020-01-01T00:00:00.000Z", r.data.id)
    .run();
  assert.ok(
    (await call("/public")).data.content.some((x) => x.id === r.data.id),
  );
  assert.equal(
    (
      await call("/admin/content", "POST", {
        ...c,
        slug: "invalid-schedule",
        publishAt: "not a date",
      })
    ).status,
    400,
  );
});
test("reserved and duplicate slugs are rejected", async () => {
  const c = {
    kind: "page",
    title: "Test",
    body: "",
    excerpt: "",
    status: "draft",
  };
  assert.equal(
    (await call("/admin/content", "POST", { ...c, slug: "admin" })).status,
    400,
  );
  assert.equal(
    (await call("/admin/content", "POST", { ...c, slug: "about" })).status,
    409,
  );
});
test("core plugins are protected on the server; extensions affect public configuration", async () => {
  for (const action of ["deactivate", "uninstall"])
    assert.equal(
      (
        await call("/admin/plugins", "POST", {
          id: "com.colossal.pages",
          action,
        })
      ).status,
      403,
    );
  assert.equal(
    (
      await call("/admin/plugins", "POST", {
        id: "com.colossal.announcement",
        action: "install",
      })
    ).status,
    200,
  );
  assert.ok(
    (await call("/public")).data.plugins.some(
      (p) => p.id === "com.colossal.announcement",
    ),
  );
  await call("/admin/plugins", "POST", {
    id: "com.colossal.announcement",
    action: "uninstall",
  });
  assert.ok(
    !(await call("/public")).data.plugins.some(
      (p) => p.id === "com.colossal.announcement",
    ),
  );
});
test("site settings update the public API and unsafe logo URLs are rejected", async () => {
  const settings = (await call("/admin/state")).data.settings;
  assert.equal(
    (
      await call("/admin/settings", "POST", {
        ...settings,
        title: "Test journal",
        accent: "#123456",
      })
    ).status,
    200,
  );
  assert.equal((await call("/public")).data.settings.title, "Test journal");
  assert.equal(
    (
      await call("/admin/settings", "POST", {
        ...settings,
        logo: "javascript:alert(1)",
      })
    ).status,
    400,
  );
});
test("editors can create content but cannot change settings, roles or plugins", async () => {
  await call("/admin/members", "POST", {
    email: "editor@example.com",
    role: "editor",
  });
  const editor = {
    "oai-authenticated-user-id": "editor-id",
    "oai-authenticated-user-email": "editor@example.com",
  };
  assert.equal(
    (await call("/admin/state", "GET", undefined, editor)).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/admin/content",
        "POST",
        {
          kind: "post",
          title: "Editor story",
          slug: "editor-story",
          body: "",
          excerpt: "",
          status: "draft",
        },
        editor,
      )
    ).status,
    200,
  );
  for (const endpoint of ["settings", "members", "plugins", "keys"])
    assert.equal(
      (await call("/admin/" + endpoint, "POST", {}, editor)).status,
      403,
    );
  assert.equal(
    (
      await call("/admin/state", "GET", undefined, {
        "oai-authenticated-user-id": "stranger",
        "oai-authenticated-user-email": "stranger@example.com",
      })
    ).status,
    403,
  );
});
test("read keys expose only published content and can be revoked", async () => {
  const r = await call("/admin/keys", "POST", { name: "Test integration" });
  assert.equal(r.status, 200);
  assert.ok(r.data.key.startsWith("cl_"));
  const token = { Authorization: "Bearer " + r.data.key };
  const content = await call("/content", "GET", undefined, token);
  assert.equal(content.status, 200);
  assert.ok(content.data.every((c) => c.status !== "draft"));
  const s = (await call("/admin/state")).data;
  assert.ok(!JSON.stringify(s.keys).includes(r.data.key));
  await call("/admin/keys/" + s.keys[0].id, "DELETE", {});
  assert.equal((await call("/content", "GET", undefined, token)).status, 401);
});
test("cross-origin mutations are denied", async () => {
  const r = await worker.fetch(
    new Request("https://cms.test/api/admin/settings", {
      method: "POST",
      headers: {
        ...owner,
        Origin: "https://untrusted.test",
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
    env,
  );
  assert.equal(r.status, 403);
});
