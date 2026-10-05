import { resolve } from "node:path";
import { localDatabase } from "./local-database.mjs";
import {
  defaultTheme,
  CORE_THEME_ID,
  CMS_VERSION,
} from "../server/theme-engine.mjs";
import { migrateThemeDocument } from "../server/theme-migrations.mjs";
import { defaultSettings, sampleContent } from "../server/catalog.mjs";

/** Explicit local release reset. Never called during ordinary startup or deployment. */
export async function restoreReleaseDefaults(db) {
  const time = new Date().toISOString();
  const owner = await db
    .prepare("SELECT email FROM members WHERE id='owner'")
    .first();
  const author = owner?.email || "builtin@colossal.invalid";
  const theme = defaultTheme();
  const changes = [
    db.prepare("DELETE FROM revisions"),
    db.prepare("DELETE FROM content"),
    db
      .prepare("DELETE FROM theme_history WHERE theme_id=?")
      .bind("com.colossal.theme.brilliant"),
    db
      .prepare("DELETE FROM themes WHERE id=?")
      .bind("com.colossal.theme.brilliant"),
    db
      .prepare("DELETE FROM theme_history WHERE theme_id=?")
      .bind("com.colossal.theme.brilliant.export"),
    db
      .prepare("DELETE FROM themes WHERE id=?")
      .bind("com.colossal.theme.brilliant.export"),
    db.prepare("DELETE FROM config WHERE id='brilliant-routing-backup'"),
    db.prepare("UPDATE themes SET active=0"),
    db
      .prepare(
        "INSERT INTO themes (id,manifest,published,draft,active,is_core,revision,updated_at) VALUES (?,?,?,NULL,1,1,1,?) ON CONFLICT(id) DO UPDATE SET manifest=excluded.manifest,published=excluded.published,draft=NULL,active=1,is_core=1,revision=1,updated_at=excluded.updated_at",
      )
      .bind(
        CORE_THEME_ID,
        JSON.stringify(theme.manifest),
        JSON.stringify(theme),
        time,
      ),
    db
      .prepare(
        "INSERT INTO config (id,value) VALUES ('site',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      )
      .bind(
        JSON.stringify({
          ...defaultSettings,
          homePageId: "",
          postsPageId: "",
          notFoundPageId: "",
          postRouting: "home",
          siteIconId: "",
        }),
      ),
  ];
  // Preserve custom themes while adapting bundled prototype compatibility ranges.
  for (const row of (await db.prepare("SELECT * FROM themes").all()).results) {
    if (
      [
        CORE_THEME_ID,
        "com.colossal.theme.brilliant",
        "com.colossal.theme.brilliant.export",
      ].includes(row.id)
    )
      continue;
    const published = migrateThemeDocument(JSON.parse(row.published));
    const draft = row.draft
      ? migrateThemeDocument(JSON.parse(row.draft))
      : null;
    changes.push(
      db
        .prepare("UPDATE themes SET manifest=?,published=?,draft=? WHERE id=?")
        .bind(
          JSON.stringify(published.manifest),
          JSON.stringify(published),
          draft ? JSON.stringify(draft) : null,
          row.id,
        ),
    );
  }
  for (const entry of sampleContent)
    changes.push(
      db
        .prepare(
          "INSERT INTO content (id,kind,title,slug,excerpt,body,status,publish_at,updated_at,author,details,template_id) VALUES (?,?,?,?,?,?,?,?,?,?,'{}','')",
        )
        .bind(
          entry.id,
          entry.kind,
          entry.title,
          entry.slug,
          entry.excerpt,
          entry.body,
          entry.status,
          time,
          time,
          author,
        ),
    );
  await db.batch(changes);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/prepare-release.mjs")
) {
  if (process.argv[2] !== "--restore-local-defaults")
    throw new Error(
      "This resets local posts/pages. Pass --restore-local-defaults explicitly.",
    );
  const db = localDatabase(
    resolve(process.env.CMS_DATA_DIR || ".local", "colossal.sqlite"),
  );
  try {
    await restoreReleaseDefaults(db);
    console.log(
      "Local release " +
        CMS_VERSION +
        " defaults restored. Administrator credentials and connection settings preserved.",
    );
  } finally {
    db.close();
  }
}
