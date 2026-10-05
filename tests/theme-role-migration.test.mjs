import { test } from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "../scripts/local-database.mjs";
import {
  defaultTheme,
  resolveTemplateForContent,
  validateDocument,
} from "../server/theme-engine.mjs";
import { ensureThemes } from "../server/themes.mjs";
import { migrateThemeDocument } from "../server/theme-migrations.mjs";

test("existing published and draft themes gain role templates without losing custom blocks", async () => {
  const db = localDatabase();
  try {
    const legacy = defaultTheme();
    legacy.manifest.id = "test.legacy.roles";
    legacy.manifest.isCore = false;
    legacy.manifest.templates = legacy.manifest.templates.filter((t) =>
      ["default", "not-found"].includes(t.id),
    );
    legacy.templates = {
      default: legacy.templates.default,
      "not-found": legacy.templates["not-found"],
    };
    legacy.manifest.templates.find((t) => t.id === "default").name = "Default";
    legacy.manifest.templates.find((t) => t.id === "default").appliesTo = [
      "page",
      "post",
      "post-index",
      "search",
    ];
    legacy.manifest.templates.find((t) => t.id === "not-found").name =
      "Not Found";
    legacy.templates["not-found"].children[1].children = legacy.templates[
      "not-found"
    ].children[1].children.filter((b) => b.type !== "theme/part-content");
    legacy.templates.default.children[1].children.push({
      id: "custom-page-block",
      type: "core/heading",
      settings: { text: "Keep my layout", level: "h2" },
    });
    const draft = structuredClone(legacy);
    draft.css += ".theme-root{border-color:#123456}";
    await db
      .prepare(
        "INSERT INTO themes (id,manifest,published,draft,active,is_core,revision,updated_at) VALUES (?,?,?,?,0,0,1,?)",
      )
      .bind(
        legacy.manifest.id,
        JSON.stringify(legacy.manifest),
        JSON.stringify(legacy),
        JSON.stringify(draft),
        "2026-10-01",
      )
      .run();
    await ensureThemes(db);
    const row = await db
      .prepare("SELECT * FROM themes WHERE id=?")
      .bind(legacy.manifest.id)
      .first();
    assert.equal(row.revision, 2);
    for (const document of [JSON.parse(row.published), JSON.parse(row.draft)]) {
      assert.deepEqual(
        ["Home", "Page", "Posts", "Single", "Search", "404"].sort(),
        document.manifest.templates.map((t) => t.name).sort(),
      );
      assert.equal(
        document.templates.default.children[1].children.at(-1).settings.text,
        "Keep my layout",
      );
      assert.ok(
        document.templates["post-archive"].children[1].children.some(
          (b) => b.settings.text === "Keep my layout",
        ),
      );
      assert.ok(
        document.templates["post-archive"].children[1].children.some(
          (b) => b.type === "core/post-list",
        ),
      );
      assert.ok(
        document.templates["not-found"].children[1].children.some(
          (b) => b.type === "theme/part-content",
        ),
      );
      const again = migrateThemeDocument(document);
      assert.deepEqual(again.manifest, document.manifest);
      assert.deepEqual(again.templates, document.templates);
    }
    assert.match(JSON.parse(row.draft).css, /border-color:#123456/);
    await ensureThemes(db);
    assert.equal(
      (
        await db
          .prepare("SELECT revision FROM themes WHERE id=?")
          .bind(legacy.manifest.id)
          .first()
      ).revision,
      2,
    );
  } finally {
    db.close();
  }
});

test("a custom catch-all layout remains available beside six standard templates", () => {
  const legacy = defaultTheme();
  legacy.manifest.templates = legacy.manifest.templates.filter(
    (t) => t.id === "default",
  );
  legacy.templates = { default: legacy.templates.default };
  legacy.manifest.templates[0].name = "My original layout";
  legacy.manifest.templates[0].appliesTo = [
    "page",
    "post",
    "post-index",
    "search",
    "404",
  ];
  const migrated = migrateThemeDocument(legacy);
  for (const name of ["Home", "Page", "Posts", "Single", "Search", "404"])
    assert.ok(
      migrated.manifest.templates.some((t) => t.name === name),
      name,
    );
  assert.ok(
    migrated.manifest.templates.some((t) => t.name === "My original layout"),
  );
  assert.notEqual(
    resolveTemplateForContent(migrated, "page", "").template.id,
    "default",
  );
  assert.doesNotThrow(() => validateDocument(migrated, true));
});
