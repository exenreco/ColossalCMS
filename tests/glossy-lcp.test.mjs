import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import sharp from "sharp";
import { optimizeGlossyRender } from "../server/glossy-lcp.mjs";
import { publicHtml } from "../server/public-html.mjs";
import { buildGlossyStyles } from "../scripts/build-glossy-styles.mjs";
import assets from "../shared/glossy-hero-assets.json" with { type: "json" };

const fixture = () => ({
  html: '<div data-scene-preset="ice-world" data-full-viewport="true" data-portrait-url="/themes/colossal-2027/ice-throne-royal.png"><img class="cl-portrait-fallback" src="/themes/colossal-2027/ice-throne-royal.png" alt="Ice throne"></div>',
  css: ".theme-root{font-family:Arial,Helvetica,sans-serif}",
  body: {
    themeId: "com.colossal.theme.colossal-2027",
    className: "c27-body",
    style: "",
  },
});
test("Glossy hero is prioritized, responsive and visible before JavaScript; unrelated themes and previews are preserved", async () => {
  const source = fixture(),
    result = optimizeGlossyRender(source);
  assert.match(result.html, /loading="eager"/);
  assert.match(result.html, /fetchpriority="high"/);
  assert.match(result.html, /data-progressive-scene="true"/);
  assert.match(result.html, /srcset="[^"]+640w/);
  assert.match(result.html, /width="1086" height="1448"/);
  assert.match(result.css, /opacity:1!important/);
  assert.match(result.html, /cl-scene-static-veil/);
  assert.equal(result.fontProfile, "system");
  assert.equal(optimizeGlossyRender(source, true), source);
  const other = {
    ...source,
    body: { ...source.body, themeId: "another-theme" },
  };
  assert.equal(optimizeGlossyRender(other), other);
  const custom = { ...source, css: 'h1{font-family:"Manrope"}' };
  assert.equal(optimizeGlossyRender(custom).fontProfile, "custom");
  const shell =
    '<html><head><title>Test</title><style>@font-face{font-family:"DM Sans";src:url(dm.woff2)}body{margin:0}</style><link rel="stylesheet" href="styles.css" data-glossy-href="system.css"></head><body><cl-frontend></cl-frontend></body></html>';
  const html = publicHtml(shell, result);
  assert.match(html, /<head><link rel="preload" as="image"/);
  assert.match(html, /imagesrcset="[^"]+640w/);
  assert.match(html, /imagesizes="100vw"/);
  assert.match(html, /rel="stylesheet" href="system.css"/);
  assert.doesNotMatch(html, /dm\.woff2/);
  assert.match(
    publicHtml(shell, optimizeGlossyRender(custom)),
    /rel="stylesheet" href="styles.css"/,
  );
  for (const [original, variant] of Object.entries(assets)) {
    const bytes = await readFile("public" + variant.src),
      info = await sharp(bytes).metadata();
    assert.equal(info.format, "webp");
    assert.equal(info.hasAlpha, true);
    assert.equal(info.width, variant.width);
    assert.equal(info.height, variant.height);
    assert.ok(bytes.length < (await readFile("public" + original)).length / 2);
  }
});

test("Glossy stylesheet removes only unused bundled font faces while preserving controls and the default stylesheet", async () => {
  const root = await mkdtemp(resolve(".local/glossy-css-test-"));
  try {
    const css =
      '@font-face{font-family:"Manrope";src:url(manrope.woff2)}@font-face{font-family:"DM Sans";src:url(dm.woff2)}@font-face{font-family:Custom;src:url(custom.woff2)}.button{border:1px solid red}';
    await writeFile(join(root, "styles.css"), css);
    await writeFile(
      join(root, "index.html"),
      '<head><link rel="stylesheet" href="styles.css"></head>',
    );
    await buildGlossyStyles(root);
    const html = await readFile(join(root, "index.html"), "utf8");
    const alternate = html.match(/data-glossy-href="([^"]+)"/)[1];
    const optimized = await readFile(join(root, alternate), "utf8");
    assert.doesNotMatch(optimized, /Manrope|DM Sans/);
    assert.match(optimized, /font-family:Custom/);
    assert.match(optimized, /\.button\{border:1px solid red\}/);
    assert.equal(await readFile(join(root, "styles.css"), "utf8"), css);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
