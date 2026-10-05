import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
/** A minimal D1-compatible adapter for the local SQLite database and integration tests. */
export function localDatabase(filename = ":memory:") {
  const sqlite = new DatabaseSync(filename);
  sqlite.exec("PRAGMA foreign_keys=ON");
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)",
  );
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    if (
      !sqlite
        .prepare("SELECT name FROM local_migrations WHERE name=?")
        .get(file)
    ) {
      sqlite.exec(readFileSync("drizzle/" + file, "utf8"));
      sqlite.prepare("INSERT INTO local_migrations VALUES (?)").run(file);
    }
  const wrapper = (sql, args = []) => ({
    bind: (...values) => wrapper(sql, values),
    first: async () => sqlite.prepare(sql).get(...args) || null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => sqlite.prepare(sql).run(...args),
  });
  return {
    prepare: (sql) => wrapper(sql),
    batch: async (statements) => {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
    close: () => sqlite.close(),
  };
}
