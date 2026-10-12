import { recordContentView } from "./content-views.mjs";

const day = 86400000;
export function analyticsTarget(type, id) {
  if (
    !/^[a-z][a-z0-9._-]{0,79}$/.test(type || "") ||
    typeof id !== "string" ||
    !id ||
    id.length > 200
  )
    throw new Error("Invalid analytics target.");
  return { type, id };
}

/** Called by the document delivery layer only; plugins declare targets, never write events. */
export async function recordDocumentView(
  db,
  request,
  rendered,
  time = new Date(),
) {
  if (!rendered.analyticsTarget)
    return recordContentView(db, request, rendered, time);
  if (
    request.method !== "GET" ||
    rendered.preview ||
    rendered.maintenancePreview ||
    !(
      rendered.status === 200 ||
      (rendered.status === 503 && rendered.maintenance)
    ) ||
    /prefetch|prerender/i.test(
      request.headers.get("Sec-Purpose") ||
        request.headers.get("Purpose") ||
        "",
    )
  )
    return;
  const target = analyticsTarget(
    rendered.analyticsTarget.type,
    rendered.analyticsTarget.id,
  );
  await db
    .prepare(
      "INSERT INTO analytics_views (id,target_type,target_id,viewed_at) VALUES (?,?,?,?)",
    )
    .bind(crypto.randomUUID(), target.type, target.id, time.toISOString())
    .run();
}

/** Shared read API: 30-day totals by target, with 60-day retention and no visitor identifiers. */
export async function analyticsViewCounts(db, type, time = new Date()) {
  analyticsTarget(type, "validation");
  const start = new Date(time.getTime() - 30 * day).toISOString();
  const result = await db
    .prepare(
      "SELECT target_id,COUNT(*) AS views FROM analytics_views WHERE target_type=? AND viewed_at>=? AND viewed_at<=? GROUP BY target_id",
    )
    .bind(type, start, time.toISOString())
    .all();
  await db
    .prepare("DELETE FROM analytics_views WHERE viewed_at<?")
    .bind(new Date(time.getTime() - 60 * day).toISOString())
    .run();
  return {
    type,
    days: 30,
    start,
    end: time.toISOString(),
    counts: Object.fromEntries(
      result.results.map((row) => [row.target_id, Number(row.views)]),
    ),
  };
}
