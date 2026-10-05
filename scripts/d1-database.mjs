import { readdir, readFile } from "node:fs/promises";

export function d1Database(config, fetcher = fetch) {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.CLOUDFLARE_ACCOUNT_ID}/d1/database/${config.CLOUDFLARE_D1_DATABASE_ID}/query`;
  async function query(body) {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + config.CLOUDFLARE_API_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("D1 returned an invalid response.");
    }
    if (
      !response.ok ||
      !data.success ||
      !Array.isArray(data.result) ||
      data.result.some((r) => r.success === false)
    )
      throw new Error(
        "D1 query failed. Check database permissions and migration status.",
      );
    return data.result;
  }
  const prepare = (sql, params = []) => ({
    sql,
    params,
    bind: (...values) => prepare(sql, values),
    all: async () => (await query({ sql, params }))[0],
    first: async () => (await query({ sql, params }))[0]?.results?.[0] || null,
    run: async () => (await query({ sql, params }))[0],
  });
  return {
    prepare,
    batch: (statements) =>
      query({ batch: statements.map(({ sql, params }) => ({ sql, params })) }),
    close: async () => {},
  };
}

export async function migrateD1(db, log = () => {}) {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)",
    )
    .run();
  const wranglerTable = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations'",
    )
    .first();
  const wranglerApplied = wranglerTable
    ? new Set(
        (await db.prepare("SELECT name FROM d1_migrations").all()).results.map(
          (r) => r.name,
        ),
      )
    : new Set();
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (
      await db
        .prepare("SELECT name FROM local_migrations WHERE name=?")
        .bind(file)
        .first()
    ) {
      log("Migration already applied: " + file);
      continue;
    }
    if (wranglerApplied.has(file)) {
      await db
        .prepare("INSERT INTO local_migrations (name) VALUES (?)")
        .bind(file)
        .run();
      log("Adopted existing Wrangler migration: " + file);
      continue;
    }
    log("Applying migration: " + file);
    const sql = await readFile("drizzle/" + file, "utf8");
    await db.batch([
      ...sql
        .split("--> statement-breakpoint")
        .filter((s) => s.trim())
        .map((s) => db.prepare(s)),
      db.prepare("INSERT INTO local_migrations (name) VALUES (?)").bind(file),
    ]);
    log("Migration complete: " + file);
  }
}
