import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";

const DB = localDatabase();
const env = {
  DB,
  STORAGE: {
    put: async () => {},
    get: async () => null,
    delete: async () => {},
  },
  ASSETS: { fetch: async () => new Response("asset") },
};
const owner = {
  "oai-authenticated-user-id": "v205-owner",
  "oai-authenticated-user-email": "owner@example.test",
};
async function call(path, method = "GET", body) {
  const response = await worker.fetch(
    new Request("https://cms.test/api" + path, {
      method,
      headers: {
        ...owner,
        Origin: "https://cms.test",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
  return { status: response.status, data: await response.json() };
}
before(async () =>
  assert.equal((await call("/admin/setup", "POST", {})).status, 200),
);
after(() => DB.close());

test("Home, Posts and 404 roles drive routes and template scopes", async () => {
  const ids = [];
  for (const [title, slug] of [
    ["Home v205", "home-v205"],
    ["Blog v205", "blog-v205"],
    ["Missing v205", "missing-v205"],
  ]) {
    const made = await call("/admin/content", "POST", {
      kind: "page",
      title,
      slug,
      body: slug === "missing-v205" ? "Custom 404 page body" : title,
      excerpt: "",
      status: "published",
    });
    assert.equal(made.status, 200, JSON.stringify(made.data));
    ids.push(made.data.id);
  }
  const settings = (await call("/admin/state")).data.settings;
  const assign = await call("/admin/settings", "POST", {
    ...settings,
    routingVersion: 2,
    homePageId: ids[0],
    postsPageId: ids[1],
    notFoundPageId: ids[2],
    postRouting: "page",
  });
  assert.equal(assign.status, 200, JSON.stringify(assign.data));
  const home = await call("/themes/render?path=/");
  assert.equal(home.status, 200);
  assert.equal(home.data.templateId, "home");
  assert.match(home.data.html, /Home v205/);
  const posts = await call("/themes/render?path=/blog-v205");
  assert.equal(posts.status, 200);
  assert.equal(posts.data.templateId, "post-archive");
  const missing = await call("/themes/render?path=/absent-v205");
  assert.equal(missing.status, 200);
  assert.equal(missing.data.status, 404);
  assert.equal(missing.data.templateId, "not-found");
  assert.match(missing.data.html, /Missing v205/);
  assert.match(missing.data.html, /Custom 404 page body/);
  assert.doesNotMatch(missing.data.html, /href="\/missing-v205"/);
  const missingSlug = await call("/themes/render?path=/missing-v205");
  assert.equal(missingSlug.data.status, 404);
  const list = (await call("/admin/state")).data.content.filter((c) =>
    ids.includes(c.id),
  );
  assert.equal(list.length, 3);
  const invalid = await call("/admin/settings", "POST", {
    ...settings,
    routingVersion: 2,
    homePageId: ids[0],
    postsPageId: ids[0],
    notFoundPageId: ids[2],
    postRouting: "page",
  });
  assert.equal(invalid.status, 400);
  const archive = await call("/admin/content", "POST", {
    ...list.find((c) => c.id === ids[1]),
    templateId: "post-archive",
  });
  assert.equal(archive.status, 200, JSON.stringify(archive.data));
  const deleteHome = await call("/admin/content/" + ids[0], "DELETE", {});
  assert.equal(deleteHome.status, 200);
  const state = (await call("/admin/state")).data;
  assert.equal(state.settings.homePageId, "");
  assert.equal(state.settings.postsPageId, "");
  assert.ok(state.notices.some((n) => n.message.includes("Home v205")));
});
