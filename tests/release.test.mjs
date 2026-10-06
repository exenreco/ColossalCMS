import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import semver from "semver";
import { localDatabase } from "../scripts/local-database.mjs";
import { restoreReleaseDefaults } from "../scripts/prepare-release.mjs";
import { passwordAuth } from "../scripts/password-auth.mjs";
import { seedBuiltInData } from "../scripts/data-migration.mjs";
import { catalog, sampleContent } from "../server/catalog.mjs";
import {
  CMS_VERSION,
  CORE_THEME_ID,
  defaultTheme,
  validateDocument,
} from "../server/theme-engine.mjs";

test("release version, bundled manifests and default theme agree and Brilliant is not installed", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(pkg.version, "0.0.1");
  assert.equal(CMS_VERSION, pkg.version);
  for (const plugin of catalog) {
    assert.equal(plugin.version, CMS_VERSION);
    assert.ok(semver.satisfies(CMS_VERSION, plugin.requires.colossal));
  }
  const db = localDatabase();
  try {
    await seedBuiltInData(db);
    const themes = (await db.prepare("SELECT * FROM themes").all()).results;
    assert.equal(themes.length, 2);
    assert.ok(themes.some((t) => t.id === CORE_THEME_ID));
    assert.ok(themes.some((t) => t.id === "com.colossal.theme.colossal-2027"));
    assert.equal(
      validateDocument(defaultTheme(), true).manifest.version,
      CMS_VERSION,
    );
  } finally {
    db.close();
  }
});

test("release restoration replaces content and Brilliant while preserving administrator access and custom themes", async () => {
  const db = localDatabase();
  try {
    await seedBuiltInData(db);
    const setupToken = "isolated-release-owner-token-32-characters";
    const auth = passwordAuth(db, { setupToken });
    await auth.setup(
      "release@example.test",
      "release administrator password",
      setupToken,
    );
    const login = await auth.login(
      "release@example.test",
      "release administrator password",
    );
    const request = new Request("https://cms.test", {
      headers: { cookie: login.cookie },
    });
    const credentials = await db
      .prepare("SELECT * FROM auth_credentials")
      .first();
    await db
      .prepare(
        "UPDATE content SET title='Edited welcome',details='{}' WHERE id='welcome'",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO content (id,kind,title,slug,excerpt,body,status,publish_at,updated_at,author) VALUES ('brilliant-home','page','Portfolio','portfolio','','','published','','','owner')",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO revisions (id,content_id,snapshot,created_at,author) VALUES ('revision','welcome','{}','','owner')",
      )
      .run();
    for (const id of [
      "com.colossal.theme.brilliant",
      "com.colossal.theme.brilliant.export",
      "custom-theme",
    ]) {
      const doc = defaultTheme();
      doc.manifest.id = id;
      doc.manifest.name = id;
      await db
        .prepare(
          "INSERT INTO themes (id,manifest,published,active,is_core,revision,updated_at) VALUES (?,?,?,0,0,1,'')",
        )
        .bind(id, JSON.stringify(doc.manifest), JSON.stringify(doc))
        .run();
    }
    await db
      .prepare("UPDATE themes SET active=0 WHERE id=?")
      .bind(CORE_THEME_ID)
      .run();
    await db
      .prepare(
        "UPDATE themes SET active=1 WHERE id='com.colossal.theme.brilliant'",
      )
      .run();
    await restoreReleaseDefaults(db);
    const content = (await db.prepare("SELECT * FROM content").all()).results;
    assert.deepEqual(
      content.map((c) => c.id).sort(),
      sampleContent.map((c) => c.id).sort(),
    );
    for (const original of sampleContent)
      assert.equal(
        content.find((c) => c.id === original.id).body,
        original.body,
      );
    assert.equal(
      (await db.prepare("SELECT * FROM revisions").all()).results.length,
      0,
    );
    assert.equal(
      await db
        .prepare(
          "SELECT id FROM themes WHERE id='com.colossal.theme.brilliant'",
        )
        .first(),
      null,
    );
    assert.equal(
      (await db.prepare("SELECT * FROM themes").all()).results.length,
      3,
    );
    assert.ok(
      await db.prepare("SELECT id FROM themes WHERE id='custom-theme'").first(),
    );
    assert.equal(
      (await db.prepare("SELECT id FROM themes WHERE active=1").first()).id,
      CORE_THEME_ID,
    );
    assert.deepEqual(
      await db.prepare("SELECT * FROM auth_credentials").first(),
      credentials,
    );
    assert.equal((await auth.identify(request)).id, "owner");
    await restoreReleaseDefaults(db);
    assert.equal(
      (await db.prepare("SELECT * FROM content").all()).results.length,
      3,
    );
  } finally {
    db.close();
  }
});
