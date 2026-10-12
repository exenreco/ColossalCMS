import test from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "../scripts/local-database.mjs";
import {
  analyticsTarget,
  analyticsViewCounts,
  recordDocumentView,
} from "../server/view-analytics.mjs";
import { mongoAdapter } from "../scripts/mongo-database.mjs";
import { productionSchema } from "../scripts/production-schema.mjs";

test("core plugin analytics count intentional maintenance responses, exclude previews, and isolate targets", async () => {
  const db = localDatabase();
  try {
    const time = new Date("2026-10-12T12:00:00Z"),
      day = 86400000;
    const request = new Request("https://cms.test/");
    const rendered = {
      status: 503,
      maintenance: true,
      analyticsTarget: analyticsTarget("maintenance", "midnight"),
    };
    await recordDocumentView(db, request, rendered, time);
    await recordDocumentView(db, request, rendered, new Date(+time - 30 * day));
    await recordDocumentView(
      db,
      request,
      rendered,
      new Date(+time - 30 * day - 1),
    );
    await recordDocumentView(
      db,
      request,
      rendered,
      new Date(+time - 60 * day - 1),
    );
    await recordDocumentView(db, request, rendered, new Date(+time + 1));
    await recordDocumentView(
      db,
      request,
      {
        status: 200,
        analyticsTarget: analyticsTarget("another-plugin", "midnight"),
      },
      time,
    );
    for (const overrides of [
      { preview: true },
      { maintenancePreview: true },
      { status: 404 },
      { status: 503, maintenance: false },
    ])
      await recordDocumentView(
        db,
        request,
        { ...rendered, ...overrides },
        time,
      );
    for (const init of [
      { method: "HEAD" },
      { headers: { "Sec-Purpose": "prefetch" } },
      { headers: { Purpose: "prerender" } },
    ])
      await recordDocumentView(
        db,
        new Request(request.url, init),
        rendered,
        time,
      );
    assert.deepEqual(
      (await analyticsViewCounts(db, "maintenance", time)).counts,
      { midnight: 2 },
    );
    assert.deepEqual(
      (await analyticsViewCounts(db, "another-plugin", time)).counts,
      { midnight: 1 },
    );
    const rows = (await db.prepare("SELECT * FROM analytics_views").all())
      .results;
    assert.equal(rows.length, 5);
    assert.deepEqual(Object.keys(rows[0]).sort(), [
      "id",
      "target_id",
      "target_type",
      "viewed_at",
    ]);
    assert.equal(
      (await db.prepare("SELECT COUNT(*) AS n FROM content_views").first()).n,
      0,
    );
    assert.throws(() => analyticsTarget("bad type", "id"));
  } finally {
    db.close();
  }
});

test("MongoDB provisions and aggregates plugin analytics using the common schema", async () => {
  assert.ok(productionSchema().analytics_views);
  let pipeline;
  const db = mongoAdapter(
    {},
    {
      collection: () => ({
        aggregate(value) {
          pipeline = value;
          return { toArray: async () => [{ target_id: "midnight", views: 4 }] };
        },
        deleteMany: async () => ({ deletedCount: 0 }),
      }),
    },
  );
  assert.deepEqual((await analyticsViewCounts(db, "maintenance")).counts, {
    midnight: 4,
  });
  assert.equal(pipeline[0].$match.$and[0].target_type.$eq, "maintenance");
  assert.deepEqual(pipeline[1], {
    $group: { _id: "$target_id", views: { $sum: 1 } },
  });
});
