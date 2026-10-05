import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { defaultTheme, validateDocument } from "../server/theme-engine.mjs";

test("legacy icon migration preserves core, copied themes, drafts and history and is idempotent", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      "CREATE TABLE themes (id TEXT, manifest TEXT, published TEXT, draft TEXT, revision INTEGER, active INTEGER)",
    );
    db.exec("CREATE TABLE theme_history (id TEXT, snapshot TEXT)");
    const original = defaultTheme();
    // This historical SQL migration predates the V2.0.5 block catalog.
    original.manifest.blocks = original.manifest.blocks.filter(
      (b) =>
        ![
          "core/group",
          "core/row",
          "core/column",
          "core/content",
          "core/gltf",
          "core/slider",
          "core/slide",
          "core/overlay",
        ].includes(b.type),
    );
    original.manifest.version = "2.0.1";
    original.manifest.requires.colossal = ">=0.0.1";
    original.templates.default.children[1].settings.padding = { top: 71 };
    original.manifest.blocks[0].icon = "custom-container-icon";
    const legacy = structuredClone(original);
    legacy.manifest.blocks.slice(1).forEach((b) => delete b.icon);
    legacy.manifest.blocks[1].icon = " ";
    const draft = structuredClone(legacy);
    draft.templates.default.children[1].settings.padding.top = 99;
    const draftExpected = structuredClone(original);
    draftExpected.templates.default.children[1].settings.padding.top = 99;
    for (const id of ["core", "copy"])
      db.prepare("INSERT INTO themes VALUES (?,?,?,?,7,1)").run(
        id,
        JSON.stringify(legacy.manifest),
        JSON.stringify(legacy),
        id === "copy" ? JSON.stringify(draft) : null,
      );
    db.prepare("INSERT INTO theme_history VALUES (?,?)").run(
      "history",
      JSON.stringify(legacy),
    );
    const sql = readFileSync(
      new URL("../drizzle/0003_theme_core_icons.sql", import.meta.url),
      "utf8",
    );
    db.exec(sql);
    const rows = db.prepare("SELECT * FROM themes").all();
    for (const row of rows) {
      assert.deepEqual(JSON.parse(row.manifest), original.manifest);
      assert.deepEqual(JSON.parse(row.published), original);
      assert.equal(row.revision, 7);
      assert.equal(row.active, 1);
      assert.deepEqual(
        row.draft && JSON.parse(row.draft),
        row.id === "copy" ? draftExpected : null,
      );
      validateDocument(JSON.parse(row.published), true);
    }
    assert.deepEqual(
      JSON.parse(
        db.prepare("SELECT snapshot FROM theme_history").get().snapshot,
      ),
      original,
    );
    db.exec(sql);
    assert.deepEqual(db.prepare("SELECT * FROM themes").all(), rows);

    // Migration does not invent metadata for unknown/custom blocks.
    legacy.manifest.blocks.push({
      type: "custom/unknown",
      file: "blocks/unknown.html",
    });
    db.prepare("INSERT INTO themes VALUES (?,?,?,?,7,0)").run(
      "custom",
      JSON.stringify(legacy.manifest),
      JSON.stringify(legacy),
      null,
    );
    db.exec(sql);
    const custom = JSON.parse(
      db.prepare("SELECT published FROM themes WHERE id='custom'").get()
        .published,
    );
    assert.equal(custom.manifest.blocks.at(-1).icon, undefined);
    assert.throws(() => validateDocument(custom, true), /must declare an icon/);
  } finally {
    db.close();
  }
});
