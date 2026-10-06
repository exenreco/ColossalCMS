import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  colossal2027Theme,
  COLOSSAL_2027_ID,
} from "../server/colossal-2027.mjs";
import {
  renderTheme,
  validateDocument,
  themeMediaIds,
  compileBlock,
  sanitizeTemplate,
  CORE_THEME_ID,
} from "../server/theme-engine.mjs";
import { ensureThemes, publicThemeRender } from "../server/themes.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { mediaIds } from "../server/v2-utils.mjs";
import { initialize } from "../server/worker.mjs";

test("Colossal 2027 is seeded inactive without replacing a site's theme, edits, or content", async () => {
  const db = localDatabase();
  try {
    await initialize(db, { email: "owner@example.test" });
    const first = await db
      .prepare("SELECT * FROM themes WHERE id=?")
      .bind(COLOSSAL_2027_ID)
      .first();
    assert.equal(first.active, 0);
    assert.equal(first.is_core, 1);
    assert.equal(
      (await db.prepare("SELECT id FROM themes WHERE active=1").first()).id,
      CORE_THEME_ID,
    );
    const doc = JSON.parse(first.published);
    doc.css += ".theme-root .custom-edit{color:#123456}";
    await db
      .prepare("UPDATE themes SET published=?,draft=?,revision=9 WHERE id=?")
      .bind(JSON.stringify(doc), JSON.stringify(doc), COLOSSAL_2027_ID)
      .run();
    const content = (await db.prepare("SELECT * FROM content").all()).results;
    await ensureThemes(db);
    const preserved = await db
      .prepare("SELECT * FROM themes WHERE id=?")
      .bind(COLOSSAL_2027_ID)
      .first();
    assert.equal(preserved.revision, 9);
    assert.equal(preserved.published, JSON.stringify(doc));
    assert.equal(preserved.draft, JSON.stringify(doc));
    assert.deepEqual(
      (await db.prepare("SELECT * FROM content").all()).results,
      content,
    );
  } finally {
    db.close();
  }
});

test("portfolio theme uses its editable landing template at / while standard content routes stay intact", async () => {
  const db = localDatabase();
  try {
    await initialize(db, { email: "owner@example.test" });
    await db.prepare("UPDATE themes SET active=0").run();
    await db
      .prepare("UPDATE themes SET active=1 WHERE id=?")
      .bind(COLOSSAL_2027_ID)
      .run();
    const response = await publicThemeRender(
      new Request("https://cms.test/api/themes/render?path=/"),
      { DB: db },
    );
    const home = await response.json();
    assert.equal(home.templateId, "home");
    assert.match(
      home.html,
      /data-portrait-url="\/themes\/colossal-2027\/ice-portrait.png"/,
    );
    assert.match(home.html, /Ideas into/);
    const d = colossal2027Theme();
    const ctx = {
      settings: {},
      allContent: [],
      media: [],
      content: {
        title: "Real page content",
        body: "User-authored text",
        details: {},
      },
      kind: "page",
      path: "/about",
    };
    const page = renderTheme(d, ctx);
    assert.match(page.html, /Real page content/);
    assert.match(page.html, /User-authored text/);
    assert.doesNotMatch(page.html, /data-portrait-url/);
    assert.equal(d.parts.footer.children[0].children.length, 3);
    assert.match(home.css, /position:sticky/);
    assert.match(home.css, /prefers-reduced-motion:reduce/);
    assert.ok(d.manifest.templates.some((t) => t.name === "Projects"));
    assert.ok(d.manifest.templates.some((t) => t.name === "Resume"));
  } finally {
    db.close();
  }
});

test("portrait controls clamp values, retain fallback artwork, and track image references", () => {
  const d = colossal2027Theme();
  const scene = d.templates.home.children[1].children[1].children[0];
  Object.assign(scene.settings, {
    portraitImage: "portrait",
    fragmentCount: 900,
    lightIntensity: 999,
    motionStrength: -4,
    iceTint: "red;bad()",
    pointerInteractive: false,
  });
  const result = renderTheme(
    validateDocument(d, true),
    {
      settings: {},
      allContent: [],
      content: { details: {} },
      media: [
        { id: "portrait", type: "image", url: "/api/media/portrait/file" },
      ],
      kind: "home",
    },
    "home",
  );
  assert.match(result.html, /data-fragment-count="40"/);
  assert.match(result.html, /data-light-intensity="5"/);
  assert.match(result.html, /data-motion-strength="0"/);
  assert.match(result.html, /data-pointer-interactive="false"/);
  assert.match(result.html, /data-ice-tint="#c5e5ff"/);
  assert.match(result.html, /<img src="\/api\/media\/portrait\/file"/);
  assert.ok(themeMediaIds(d).includes("portrait"));
  assert.ok(mediaIds({ contentBlocks: [scene] }).includes("portrait"));
  scene.settings.portraitUrl = "javascript:alert(1)";
  assert.throws(() => validateDocument(d, true), /portrait URL|HTTPS/);
  scene.settings.portraitUrl = "https://user:password@example.test/art.png";
  assert.throws(() => validateDocument(d, true), /credentials/);
});

test("glass controls produce bounded sanitized styles and the ice artwork ships with alpha", async () => {
  const html = compileBlock(
    {
      id: "blk_glass_sample",
      type: "core/container",
      children: [],
      settings: {
        glassEnabled: true,
        glassBlur: 300,
        glassSaturation: 800,
        background: "#ffffff14",
        radius: 22,
        position: "sticky",
        offsets: { top: 18 },
      },
    },
    colossal2027Theme(),
  );
  assert.match(html, /backdrop-filter:blur\(48px\) saturate\(200%\)/);
  assert.match(sanitizeTemplate(html), /backdrop-filter/);
  assert.match(sanitizeTemplate(html), /border-radius:22px/);
  assert.match(sanitizeTemplate(html), /position:sticky;top:18px/);
  assert.doesNotMatch(
    compileBlock(
      {
        id: "blk_plain_sample",
        type: "core/container",
        children: [],
        settings: { glassEnabled: false },
      },
      colossal2027Theme(),
    ),
    /backdrop-filter/,
  );
  const png = await readFile("public/themes/colossal-2027/ice-portrait.png");
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png[25], 6); // PNG RGBA: alpha is preserved in the shipped asset.
});
