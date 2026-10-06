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
import { migrateThemeDocument } from "../server/theme-migrations.mjs";
import {
  throneFrame,
  scrollProgress,
  seededRandom,
  moonCornerFrame,
  easeTo,
  flakeMotion,
} from "../shared/ice-scene/scene-math.ts";
import { modelFieldVisible } from "../shared/model-field-visibility.ts";

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
      /data-portrait-url="\/themes\/colossal-2027\/ice-throne-royal.png"/,
    );
    assert.match(home.html, /data-scene-preset="ice-world"/);
    assert.match(home.html, /data-full-viewport="true"/);
    assert.match(home.html, /data-moon-enabled="true"/);
    assert.match(home.html, /data-moon-placement="top-left"/);
    assert.match(home.html, /data-scene-veil-enabled="true"/);
    assert.match(home.html, /data-scene-pixels-enabled="true"/);
    assert.match(home.html, /data-snow-enabled="true"/);
    assert.match(home.html, /data-wind-enabled="true"/);
    assert.match(home.css, /height:100vh/);
    assert.match(home.css, /width:100vw/);
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
    moonSize: 900,
    moonElevation: -500,
    moonTint: "red;bad()",
    snowDensity: 100000,
    windStrength: -20,
    sceneSpeed: 100,
    backgroundZoom: 3,
    sceneVeilOpacity: 99,
    scenePixelSize: -1,
    snowSize: 99,
    snowSpeed: -1,
    snowFlutter: 100,
    moonPlacement: "javascript:bad()",
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
  assert.match(result.html, /data-moon-size="7"/);
  assert.match(result.html, /data-moon-elevation="-4"/);
  assert.match(result.html, /data-moon-tint="#b9dcef"/);
  assert.match(result.html, /data-snow-density="1800"/);
  assert.match(result.html, /data-wind-strength="0"/);
  assert.match(result.html, /data-scene-speed="3"/);
  assert.match(result.html, /data-background-zoom="0.25"/);
  assert.match(result.html, /data-scene-veil-opacity="0.85"/);
  assert.match(result.html, /data-scene-pixel-size="1"/);
  assert.match(result.html, /data-snow-size="2"/);
  assert.match(result.html, /data-snow-speed="0.25"/);
  assert.match(result.html, /data-snow-flutter="3"/);
  assert.match(result.html, /data-moon-placement="top-left"/);
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
  for (const asset of ["ice-portrait", "ice-throne", "ice-throne-royal"]) {
    const png = await readFile(`public/themes/colossal-2027/${asset}.png`);
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png[25], 6); // PNG RGBA: alpha is preserved in the shipped asset.
  }
});

test("older Colossal 2027 trees gain the ice world once without replacing authored content or artwork", () => {
  const legacy = colossal2027Theme();
  delete legacy.manifest.bundledRevision;
  const hero = legacy.templates.home.children[1];
  hero.settings.classes = "c27-hero";
  const scene = hero.children[1].children[0];
  scene.settings.portraitUrl = "/themes/colossal-2027/ice-portrait.png";
  scene.settings.portraitImage = "custom-portrait";
  legacy.css = ".theme-root .custom-edit{color:#123456}";
  hero.children[0].children[1].settings.text = "My own headline";
  const original = structuredClone(legacy);
  const upgraded = migrateThemeDocument(legacy);
  assert.deepEqual(legacy, original);
  assert.equal(upgraded.manifest.bundledRevision, 3);
  assert.equal(upgraded.templates.home.children[1].id, hero.id);
  assert.deepEqual(upgraded.parts, legacy.parts);
  assert.deepEqual(upgraded.templates.page, legacy.templates.page);
  assert.equal(
    upgraded.templates.home.children[1].children[0].children[1].settings.text,
    "My own headline",
  );
  assert.equal(
    upgraded.templates.home.children[1].children[1].children[0].settings
      .portraitImage,
    "custom-portrait",
  );
  assert.match(upgraded.css, /custom-edit/);
  assert.deepEqual(migrateThemeDocument(upgraded), upgraded);
  scene.settings.portraitUrl = "https://example.test/my-throne.png";
  assert.equal(
    migrateThemeDocument(legacy).templates.home.children[1].children[1]
      .children[0].settings.portraitUrl,
    scene.settings.portraitUrl,
  );
});

test("throne framing preserves artwork proportions and keeps every edge inside wide, short, and narrow viewports", () => {
  for (const [width, height] of [
    [1920, 1080],
    [915, 915],
    [1280, 600],
    [390, 844],
    [320, 740],
    [700, 850],
  ]) {
    for (const imageAspect of [0.74, 1, 2]) {
      const distance = 11;
      const frame = throneFrame(width / height, imageAspect, distance);
      const halfHeight = Math.tan((38 * Math.PI) / 360) * distance;
      const halfWidth = (halfHeight * width) / height;
      assert.ok(Math.abs(frame.width / frame.height - imageAspect) < 1e-10);
      assert.ok(Math.abs(frame.x) + frame.width / 2 <= halfWidth);
      assert.ok(Math.abs(frame.y) + frame.height / 2 <= halfHeight);
    }
  }
  assert.equal(scrollProgress(700, 700, 1), 1);
  assert.equal(scrollProgress(350, 700, 1), 0.5);
  assert.equal(scrollProgress(5000, 700, 4), 1);
  assert.equal(scrollProgress(5000, 700, 4, true), 0);
  const first = seededRandom(823),
    second = seededRandom(823);
  assert.deepEqual(
    Array.from({ length: 10 }, first),
    Array.from({ length: 10 }, second),
  );
});

test("shared Inspector only exposes world controls for ice scenes and hides disabled component settings", () => {
  const showModelField = (key, settings) =>
    modelFieldVisible("core/gltf", settings, key);
  const world = {
    source: "portrait",
    scenePreset: "ice-world",
    fullViewport: true,
    moonEnabled: false,
    snowEnabled: false,
    windEnabled: false,
  };
  assert.equal(showModelField("scenePreset", world), true);
  assert.equal(showModelField("fullViewport", world), true);
  for (const field of [
    "moonSize",
    "moonPlacement",
    "moonElevation",
    "moonTint",
    "snowDensity",
    "snowSize",
    "snowSpeed",
    "snowFlutter",
    "windStrength",
    "height",
  ]) {
    assert.equal(showModelField(field, world), false);
  }
  assert.equal(
    showModelField("height", { ...world, fullViewport: false }),
    true,
  );
  assert.equal(
    showModelField("moonSize", { ...world, moonEnabled: true }),
    true,
  );
  assert.equal(
    showModelField("snowDensity", { ...world, snowEnabled: true }),
    true,
  );
  assert.equal(
    showModelField("windStrength", { ...world, windEnabled: true }),
    true,
  );
  assert.equal(showModelField("moonEnabled", { source: "url" }), false);
  assert.equal(
    showModelField("sceneVeilOpacity", { ...world, sceneVeilEnabled: false }),
    false,
  );
  assert.equal(
    showModelField("scenePixelSize", { ...world, scenePixelsEnabled: false }),
    false,
  );
  assert.equal(
    showModelField("scenePixelSize", {
      ...world,
      sceneVeilEnabled: true,
      scenePixelsEnabled: true,
    }),
    true,
  );
  assert.equal(
    showModelField("moonEnabled", {
      source: "portrait",
      scenePreset: "portrait",
    }),
    false,
  );
});

test("the corner moon is cropped by both viewport edges with roughly half its surface visible", () => {
  for (const aspect of [1440 / 900, 390 / 844, 915 / 918]) {
    const distance = 28,
      radius = 4.5;
    const corner = moonCornerFrame(aspect, distance, radius);
    const halfHeight = Math.tan((38 * Math.PI) / 360) * distance;
    const halfWidth = halfHeight * aspect;
    assert.ok(corner.x - radius < -halfWidth);
    assert.ok(corner.y + radius > halfHeight);
    const random = seededRandom(87);
    let total = 0,
      visible = 0;
    for (let i = 0; i < 20000; i++) {
      const x = (random() * 2 - 1) * radius,
        y = (random() * 2 - 1) * radius;
      if (x * x + y * y > radius * radius) continue;
      total++;
      if (
        corner.x + x >= -halfWidth &&
        corner.x + x <= halfWidth &&
        corner.y + y <= halfHeight &&
        corner.y + y >= -halfHeight
      )
        visible++;
    }
    assert.ok(visible / total > 0.45 && visible / total < 0.65);
  }
});

test("camera easing is independent of display refresh rate and flakes have individual falling-leaf motion", () => {
  const response = (fps) => {
    let position = 0;
    for (let i = 0; i < fps; i++) position = easeTo(position, 1, 1 / fps);
    return position;
  };
  assert.ok(Math.abs(response(30) - response(60)) < 1e-10);
  assert.ok(response(60) > 0.999);
  assert.equal(easeTo(0, 1, 0), 0);
  const a = flakeMotion(2, 0, 0.5, 1, 1, 1.3);
  const b = flakeMotion(2, 2, 1.6, 1, 1, 1.3);
  assert.notDeepEqual(a, b);
  for (const motion of [a, b]) {
    assert.ok(motion.y < 0);
    assert.ok(Math.abs(motion.flip) <= 0.75);
    assert.ok(Object.values(motion).every(Number.isFinite));
  }
  assert.equal(flakeMotion(2, 0, 0.5, 0, 1, 0).x, 0);
  const stillFlake = flakeMotion(2, 1, 0.5, 0, 1, 0);
  assert.equal(stillFlake.angle, 1);
  assert.equal(stillFlake.flip, 1);
});

test("revision two themes receive the glass refresh while retaining custom scene controls", () => {
  const document = colossal2027Theme();
  document.manifest.bundledRevision = 2;
  const scene = document.templates.home.children[1].children[1].children[0];
  Object.assign(scene.settings, {
    portraitUrl: "/themes/colossal-2027/ice-throne.png",
    snowDensity: 700,
    fragmentCount: 8,
    windStrength: 2,
    sceneVeilOpacity: 0.6,
  });
  const updated = migrateThemeDocument(document);
  const next = updated.templates.home.children[1].children[1].children[0];
  assert.equal(
    next.settings.portraitUrl,
    "/themes/colossal-2027/ice-throne-royal.png",
  );
  assert.equal(next.settings.snowDensity, 160);
  assert.equal(next.settings.fragmentCount, 0);
  assert.equal(next.settings.windStrength, 2);
  assert.equal(next.settings.sceneVeilOpacity, 0.6);
  assert.deepEqual(migrateThemeDocument(updated), updated);
});
