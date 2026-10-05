import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";

/** Derive Mongo validators and defaults from the same migrations used by SQLite/D1. */
export function productionSchema() {
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync("drizzle")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      db.exec(readFileSync("drizzle/" + file, "utf8"));
    return Object.fromEntries(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )
        .all()
        .map(({ name }) => {
          const columns = db.prepare(`PRAGMA table_info("${name}")`).all();
          const indexes = db
            .prepare(`PRAGMA index_list("${name}")`)
            .all()
            .map((i) => ({
              name: i.name,
              unique: Boolean(i.unique),
              fields: db
                .prepare(`PRAGMA index_info("${i.name}")`)
                .all()
                .map((c) => c.name),
            }));
          return [name, { columns, indexes }];
        }),
    );
  } finally {
    db.close();
  }
}

export function mongoValidator(table) {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: table.columns
        .filter((c) => c.notnull || c.pk)
        .map((c) => c.name),
      properties: Object.fromEntries(
        table.columns.map((c) => [
          c.name,
          {
            bsonType:
              c.type.toLowerCase() === "integer"
                ? ["int", "long", "double"]
                : c.notnull || c.pk
                  ? "string"
                  : ["string", "null"],
          },
        ]),
      ),
    },
  };
}

export function rowDefaults(table) {
  return Object.fromEntries(
    table.columns
      .filter((c) => c.dflt_value !== null)
      .map((c) => {
        const raw = c.dflt_value;
        return [
          c.name,
          raw.startsWith("'")
            ? raw.slice(1, -1).replaceAll("''", "'")
            : Number(raw),
        ];
      }),
  );
}
