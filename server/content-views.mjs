const windowMs = 30 * 24 * 60 * 60 * 1000;

/** Count document loads, not render API calls or previews. No visitor identifiers are stored. */
export async function recordContentView(
  db,
  request,
  rendered,
  time = new Date(),
) {
  if (
    request.method !== "GET" ||
    !rendered.viewContentId ||
    rendered.preview ||
    rendered.maintenance ||
    rendered.maintenancePreview ||
    rendered.status !== 200 ||
    /prefetch|prerender/i.test(
      request.headers.get("Sec-Purpose") ||
        request.headers.get("Purpose") ||
        "",
    )
  )
    return;
  await db
    .prepare(
      "INSERT INTO content_views (id,content_id,viewed_at) VALUES (?,?,?)",
    )
    .bind(crypto.randomUUID(), rendered.viewContentId, time.toISOString())
    .run();
}

export async function contentViewCounts(db, time = new Date()) {
  const cutoff = new Date(time.getTime() - windowMs).toISOString();
  const result = await db
    .prepare(
      "SELECT content_id,COUNT(*) AS views FROM content_views WHERE viewed_at>=? AND viewed_at<=? GROUP BY content_id",
    )
    .bind(cutoff, time.toISOString())
    .all();
  await db
    .prepare("DELETE FROM content_views WHERE viewed_at<?")
    .bind(new Date(time.getTime() - 2 * windowMs).toISOString())
    .run();
  return Object.fromEntries(
    result.results.map((r) => [r.content_id, Number(r.views)]),
  );
}

/** Aggregate on the database; only per-content daily totals leave SQLite/D1/MongoDB. */
export async function contentViewAnalytics(db, content, time = new Date()) {
  const end = time.toISOString();
  const start = new Date(time.getTime() - windowMs).toISOString();
  const previousStart = new Date(time.getTime() - 2 * windowMs).toISOString();
  const [current, previous] = await Promise.all([
    db
      .prepare(
        "SELECT content_id,DATE(viewed_at) AS day,COUNT(*) AS views FROM content_views WHERE viewed_at>=? AND viewed_at<=? GROUP BY content_id,day",
      )
      .bind(start, end)
      .all(),
    db
      .prepare(
        "SELECT content_id,DATE(viewed_at) AS day,COUNT(*) AS views FROM content_views WHERE viewed_at>=? AND viewed_at<? GROUP BY content_id,day",
      )
      .bind(previousStart, start)
      .all(),
  ]);
  const labels = Array.from({ length: 31 }, (_, index) =>
    new Date(Date.parse(start) + index * 86400000).toISOString().slice(0, 10),
  );
  const previousLabels = labels.map((date) =>
    new Date(Date.parse(date) - windowMs).toISOString().slice(0, 10),
  );
  const analytics = {
    start,
    end,
    previousStart,
    labels,
    previousLabels,
    page: {
      current: 0,
      previous: 0,
      currentSeries: Array(31).fill(0),
      previousSeries: Array(31).fill(0),
    },
    post: {
      current: 0,
      previous: 0,
      currentSeries: Array(31).fill(0),
      previousSeries: Array(31).fill(0),
    },
  };
  const kinds = new Map(content.map((c) => [c.id, c.kind]));
  const counts = {};
  for (const [period, result] of [
    ["current", current],
    ["previous", previous],
  ]) {
    const dates = period === "current" ? labels : previousLabels;
    for (const row of result.results) {
      const kind = kinds.get(row.content_id);
      if (kind !== "page" && kind !== "post") continue;
      const views = Number(row.views);
      analytics[kind][period] += views;
      const index = dates.indexOf(row.day);
      if (index >= 0) analytics[kind][period + "Series"][index] += views;
      if (period === "current")
        counts[row.content_id] = (counts[row.content_id] || 0) + views;
    }
  }
  await db
    .prepare("DELETE FROM content_views WHERE viewed_at<?")
    .bind(previousStart)
    .run();
  return { counts, analytics };
}
