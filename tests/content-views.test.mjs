import test from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "../scripts/local-database.mjs";
import {
  contentViewCounts,
  contentViewAnalytics,
  recordContentView,
} from "../server/content-views.mjs";
import { mongoAdapter, parseSql } from "../scripts/mongo-database.mjs";
import worker from "../server/worker.mjs";
const day = 86400000;
test("views use an exact rolling 30-day window and discard old data without storing visitors", async () => {
  const db = localDatabase();
  try {
    const time = new Date("2026-10-12T12:00:00Z");
    const req = new Request("https://cms.test/page");
    const render = { viewContentId: "page", status: 200 };
    await Promise.all(
      Array.from({ length: 25 }, () =>
        recordContentView(db, req, render, time),
      ),
    );
    await recordContentView(
      db,
      req,
      render,
      new Date(time.getTime() - 30 * day),
    );
    await recordContentView(
      db,
      req,
      render,
      new Date(time.getTime() - 30 * day - 1),
    );
    await recordContentView(db, req, render, new Date(time.getTime() + 1));
    await recordContentView(
      db,
      req,
      { ...render, viewContentId: "post" },
      time,
    );
    assert.deepEqual(await contentViewCounts(db, time), { page: 26, post: 1 });
    const rows = (await db.prepare("SELECT * FROM content_views").all())
      .results;
    assert.equal(rows.length, 29);
    assert.deepEqual(Object.keys(rows[0]).sort(), [
      "content_id",
      "id",
      "viewed_at",
    ]);
  } finally {
    db.close();
  }
});
test("HEAD, preview, maintenance, 404 and speculative requests do not count", async () => {
  const db = localDatabase();
  try {
    const render = { viewContentId: "page", status: 200 };
    for (const overrides of [
      { preview: true },
      { maintenance: true },
      { maintenancePreview: true },
      { status: 404 },
      { status: 503 },
      { viewContentId: "" },
    ])
      await recordContentView(db, new Request("https://cms.test/page"), {
        ...render,
        ...overrides,
      });
    await recordContentView(
      db,
      new Request("https://cms.test/page", { method: "HEAD" }),
      render,
    );
    await recordContentView(
      db,
      new Request("https://cms.test/page", {
        headers: { "Sec-Purpose": "prefetch" },
      }),
      render,
    );
    assert.deepEqual(await contentViewCounts(db), {});
  } finally {
    db.close();
  }
});
test("MongoDB translates rolling view counts to a server-side aggregation", async () => {
  let pipeline;
  const db = mongoAdapter(
    {},
    {
      collection: () => ({
        aggregate: (value) => {
          pipeline = value;
          return { toArray: async () => [{ content_id: "page", views: 10 }] };
        },
      }),
    },
  );
  const sql =
    "SELECT content_id,COUNT(*) AS views FROM content_views WHERE viewed_at>=? AND viewed_at<=? GROUP BY content_id";
  const result = await db.prepare(sql).bind("start", "end").all();
  assert.deepEqual(result.results, [{ content_id: "page", views: 10 }]);
  assert.deepEqual(pipeline, [
    {
      $match: {
        $and: [
          { viewed_at: { $gte: "start" } },
          { viewed_at: { $lte: "end" } },
        ],
      },
    },
    { $group: { _id: "$content_id", views: { $sum: 1 } } },
    { $project: { _id: 0, content_id: "$_id", views: 1 } },
  ]);
  assert.throws(
    () => parseSql("SELECT content_id,COUNT(*) AS views FROM content_views"),
    /Unsupported/,
  );
});
test("public document loads count once, render API and previews do not, and deletion clears analytics", async () => {
  const DB = localDatabase();
  const owner = {
    "oai-authenticated-user-id": "views-owner",
    "oai-authenticated-user-email": "views@example.test",
  };
  const shell =
    "<html><head><title>CMS</title></head><body><cl-frontend></cl-frontend></body></html>";
  const env = {
    DB,
    ASSETS: {
      fetch: async () =>
        new Response(shell, { headers: { "Content-Type": "text/html" } }),
    },
  };
  const call = (path, method = "GET", body, identity = {}) =>
    worker.fetch(
      new Request("https://cms.test" + path, {
        method,
        headers: {
          Origin: "https://cms.test",
          "Content-Type": "application/json",
          ...identity,
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
  try {
    assert.equal(
      (await call("/api/admin/setup", "POST", {}, owner)).status,
      200,
    );
    const before = await (
      await call("/api/admin/state", "GET", undefined, owner)
    ).json();
    const page = before.content.find((c) => c.slug === "about");
    assert.equal((await call("/about")).status, 200);
    assert.equal((await call("/about", "HEAD")).status, 200);
    assert.equal((await call("/api/themes/render?path=/about")).status, 200);
    assert.equal((await call("/no-such-page")).status, 404);
    const preview = await (
      await call(
        "/api/themes/com.colossal.theme.default/preview",
        "POST",
        {},
        owner,
      )
    ).json();
    assert.equal(
      (await call("/about" + new URL(preview.url, "https://cms.test").search))
        .status,
      200,
    );
    const after = await (
      await call("/api/admin/state", "GET", undefined, owner)
    ).json();
    const updated = after.content.find((c) => c.id === page.id);
    assert.equal(updated.views30Days, 1);
    assert.equal(updated.updatedAt, page.updatedAt);
    assert.equal(
      (await call("/api/admin/content/" + page.id, "DELETE", {}, owner)).status,
      200,
    );
    assert.deepEqual(await contentViewCounts(DB), {});
  } finally {
    DB.close();
  }
});

test("dashboard views compare disjoint rolling windows and align daily UTC series", async () => {
  const db = localDatabase();
  try {
    const time = new Date("2026-10-12T12:00:00Z");
    const req = new Request("https://cms.test/page");
    const view = (id, age) =>
      recordContentView(
        db,
        req,
        { viewContentId: id, status: 200 },
        new Date(time.getTime() - age),
      );
    await view("page", 0);
    await view("page", 30 * day);
    await view("page", 30 * day + 1);
    await view("page", 60 * day);
    await view("page", 60 * day + 1);
    await view("post", day);
    await view("post", 31 * day);
    await view("deleted-entry", 0);
    const { counts, analytics } = await contentViewAnalytics(
      db,
      [
        { id: "page", kind: "page" },
        { id: "post", kind: "post" },
      ],
      time,
    );
    assert.deepEqual(counts, { page: 2, post: 1 });
    assert.equal(analytics.page.previous, 2);
    assert.equal(analytics.post.previous, 1);
    assert.equal(analytics.labels.length, 31);
    assert.equal(analytics.labels[0], "2026-09-12");
    assert.equal(analytics.previousLabels[0], "2026-08-13");
    assert.equal(analytics.page.currentSeries[0], 1);
    assert.equal(analytics.page.currentSeries[30], 1);
    assert.equal(analytics.page.previousSeries[0], 1);
    assert.equal(analytics.page.previousSeries[30], 1);
    assert.equal(analytics.post.currentSeries[29], 1);
    assert.equal(analytics.post.previousSeries[29], 1);
    const rows = (await db.prepare("SELECT * FROM content_views").all())
      .results;
    assert.equal(rows.length, 7);
  } finally {
    db.close();
  }
});

test("MongoDB daily aggregation uses UTC dates without transferring raw view events", async () => {
  let pipeline;
  const db = mongoAdapter(
    {},
    {
      collection: () => ({
        aggregate: (value) => {
          pipeline = value;
          return {
            toArray: async () => [
              { content_id: "page", day: "2026-10-12", views: 7 },
            ],
          };
        },
      }),
    },
  );
  const result = await db
    .prepare(
      "SELECT content_id,DATE(viewed_at) AS day,COUNT(*) AS views FROM content_views WHERE viewed_at>=? AND viewed_at<=? GROUP BY content_id,day",
    )
    .bind("start", "end")
    .all();
  assert.equal(result.results[0].views, 7);
  assert.deepEqual(pipeline[1], {
    $group: {
      _id: {
        content_id: "$content_id",
        day: { $substrBytes: ["$viewed_at", 0, 10] },
      },
      views: { $sum: 1 },
    },
  });
  assert.deepEqual(pipeline[2], {
    $project: {
      _id: 0,
      content_id: "$_id.content_id",
      day: "$_id.day",
      views: 1,
    },
  });
});
