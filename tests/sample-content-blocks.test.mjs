import test from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "../scripts/local-database.mjs";
import { initialize } from "../server/worker.mjs";
import { sampleContent, migrateSampleContent } from "../server/catalog.mjs";
import { validateDetails } from "../server/v2-utils.mjs";

test("new workspaces seed native paragraph blocks for every sample page and post", async () => {
  const db = localDatabase();
  try {
    await initialize(db, { email: "owner@example.test" });
    for (const sample of sampleContent) {
      const row = await db
        .prepare("SELECT * FROM content WHERE id=?")
        .bind(sample.id)
        .first();
      const details = JSON.parse(row.details);
      assert.deepEqual(details, sample.details);
      assert.equal(
        details.contentBlocks.length,
        sample.body.split(/\n\n+/).length,
      );
      assert.ok(
        details.contentBlocks.every((block) => block.type === "core/paragraph"),
      );
      assert.equal(
        details.contentBlocks.map((block) => block.settings.html).join("\n\n"),
        sample.body,
      );
      await validateDetails(db, details);
    }
  } finally {
    db.close();
  }
});

test("existing samples upgrade once while preserving edited bodies, native blocks, and formatting", async () => {
  const db = localDatabase();
  try {
    await initialize(db, { email: "owner@example.test" });
    await db
      .prepare("UPDATE content SET details=? WHERE id='about'")
      .bind(JSON.stringify({ contentMain: { background: "#123456" } }))
      .run();
    await db
      .prepare(
        "UPDATE content SET body='My edited story',details='{}' WHERE id='welcome'",
      )
      .run();
    const formatted = JSON.stringify({
      richText: { type: "doc", content: [] },
    });
    await db
      .prepare("UPDATE content SET details=? WHERE id='next-chapter'")
      .bind(formatted)
      .run();
    await initialize(db, { email: "owner@example.test" });
    const migrated = await db
      .prepare("SELECT * FROM content WHERE id='about'")
      .first();
    assert.deepEqual(JSON.parse(migrated.details), {
      contentMain: { background: "#123456" },
      ...sampleContent.find((sample) => sample.id === "about").details,
    });
    assert.equal(
      (
        await db
          .prepare("SELECT details FROM content WHERE id='welcome'")
          .first()
      ).details,
      "{}",
    );
    assert.equal(
      (
        await db
          .prepare("SELECT details FROM content WHERE id='next-chapter'")
          .first()
      ).details,
      formatted,
    );
    await migrateSampleContent(db);
    assert.equal(
      (await db.prepare("SELECT details FROM content WHERE id='about'").first())
        .details,
      migrated.details,
    );
  } finally {
    db.close();
  }
});
