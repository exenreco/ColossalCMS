import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import sharp from "sharp";
import { optimizeGlossyRender } from "../server/glossy-lcp.mjs";
import { publicHtml } from "../server/public-html.mjs";
import { buildGlossyStyles } from "../scripts/build-glossy-styles.mjs";
import assets from "../shared/glossy-hero-assets.json" with { type: "json" };
import { initialPublicRender } from "../shared/public-render.ts";
import { decodedPortraitCanvas } from "../shared/ice-scene/portrait-texture.ts";
import { hydrateStaticVeil } from "../shared/ice-scene/static-veil.ts";
import {
  imageAspect,
  throneFrame,
  throneFallbackStyle,
} from "../shared/ice-scene/scene-math.ts";
import {
  defaultTheme,
  compileDocument,
  renderTheme,
  sanitizeTemplate,
} from "../server/theme-engine.mjs";

const fixture = () => ({
  html: '<div data-scene-preset="ice-world" data-full-viewport="true" data-portrait-url="/themes/colossal-2027/ice-throne-royal.png"><img class="cl-portrait-fallback" src="/themes/colossal-2027/ice-throne-royal.png" alt="Ice throne"></div>',
  css: ".theme-root{font-family:Arial,Helvetica,sans-serif}",
  body: {
    themeId: "com.colossal.theme.colossal-2027",
    className: "c27-body",
    style: "",
  },
});

test("responsive artwork is rasterized into an exact GPU pixel buffer without another download", () => {
  const calls = [];
  const canvas = {
    getContext: () => ({ drawImage: (...args) => calls.push(args) }),
  };
  const image = {
    naturalWidth: 390,
    naturalHeight: 519,
    width: 345,
    height: 460,
    currentSrc: "/hero-640.webp",
    ownerDocument: { createElement: () => canvas },
  };
  assert.equal(decodedPortraitCanvas(image), canvas);
  assert.equal(canvas.width, 390);
  assert.equal(canvas.height, 519);
  assert.deepEqual(calls, [[image, 0, 0, 390, 519]]);
});

test("fallback veil tracks page scroll and viewport height and detaches after removal", () => {
  const listeners = new Map(),
    properties = new Map();
  const view = {
    scrollY: 0,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const host = {
    isConnected: true,
    clientHeight: 844,
    querySelector: () => ({}),
    ownerDocument: { defaultView: view },
    style: { setProperty: (key, value) => properties.set(key, value) },
  };
  hydrateStaticVeil(host);
  assert.equal(properties.get("--scene-height"), "844px");
  view.scrollY = 1000;
  listeners.get("scroll")();
  assert.equal(properties.get("--scene-scroll-y"), "1000px");
  host.clientHeight = 740;
  listeners.get("resize")();
  assert.equal(properties.get("--scene-height"), "740px");
  host.isConnected = false;
  listeners.get("scroll")();
  assert.equal(listeners.size, 0);
});

test("decoded artwork proportions ignore CSS sizing and static framing matches the perspective model", () => {
  const image = {
    naturalWidth: 1086,
    naturalHeight: 1448,
    width: 1920,
    height: 1080,
  };
  assert.equal(imageAspect(image), 0.75);
  assert.equal(imageAspect({ width: 640, height: 800 }), 0.8);
  for (const [width, height] of [
    [1920, 1080],
    [1106, 1242],
    [390, 844],
  ]) {
    const distance = 12 / 1.12;
    const aspect = imageAspect(image);
    const narrow = width / height < 0.9;
    const style = throneFallbackStyle(aspect, narrow);
    const [percent, vh] = style
      .match(/width:min\(([\d.]+)%,([\d.]+)vh\)/)
      .slice(1)
      .map(Number);
    const fallbackWidth = Math.min(
      (width * percent) / 100,
      (height * vh) / 100,
    );
    const worldHeight = 2 * Math.tan((38 * Math.PI) / 360) * (distance - 1);
    const frame = throneFrame(width / height, aspect, distance - 1);
    assert.ok(
      Math.abs(fallbackWidth - (frame.width / worldHeight) * height) < 0.001,
    );
    const [left, top] = [
      Number(style.match(/left:([\d.]+)%/)[1]),
      Number(style.match(/top:([\d.]+)%/)[1]),
    ];
    assert.ok(
      Math.abs(
        (left / 100) * width - (width / 2 + (frame.x / worldHeight) * height),
      ) < 0.001,
    );
    assert.ok(
      Math.abs(
        (top / 100) * height - (height / 2 - (frame.y / worldHeight) * height),
      ) < 0.001,
    );
  }
  const optimized = optimizeGlossyRender(fixture());
  assert.match(optimized.html, /data-static-frame="glossy-scene-0"/);
  assert.match(optimized.css, /@media\(max-aspect-ratio:9\/10\)/);
});

test("Glossy copies retain their identity and custom design while receiving delivery optimizations", () => {
  const copy = fixture();
  copy.body.themeId = "com.colossal.theme.copy-glossy-child-theme-753bc3b0";
  copy.css += ".c27-header-inner{gap:18px}.c27-hero{color:#abcdef}";
  const before = JSON.stringify(copy);
  const optimized = optimizeGlossyRender(copy);
  assert.equal(optimized.frontendMode, "enhance");
  assert.equal(optimized.body.themeId, copy.body.themeId);
  assert.match(optimized.css, /color:#abcdef/);
  assert.match(optimized.html, /fetchpriority="high"/);
  assert.equal(JSON.stringify(copy), before);
  const unrelated = { ...copy, css: ".my-header{color:red}" };
  assert.equal(optimizeGlossyRender(unrelated), unrelated);
});

test("enhanced documents omit duplicate content and CSS, place startup data after content, and retain preview compatibility", () => {
  const rendered = optimizeGlossyRender(fixture());
  rendered.html += "<main>VISIBLE_PAGE_CONTENT</main>";
  rendered.adsEnabled = true;
  const shell =
    '<html><head><title>Test</title></head><body><cl-frontend></cl-frontend><script type="module" src="main.js"></script></body></html>';
  const html = publicHtml(shell, rendered);
  const json = html.match(
    /<script type="application\/json" id="theme-render">([\s\S]*?)<\/script>/,
  )[1];
  const data = JSON.parse(json);
  assert.equal(data.bootstrap, "enhance-v1");
  assert.equal(data.html, undefined);
  assert.equal(data.css, undefined);
  assert.ok(json.length < 500);
  assert.equal((html.match(/VISIBLE_PAGE_CONTENT/g) || []).length, 1);
  assert.ok(
    html.indexOf('id="theme-render"') > html.indexOf("VISIBLE_PAGE_CONTENT"),
  );
  const parsed = initialPublicRender({
    getElementById: () => ({ textContent: json }),
  });
  assert.equal(parsed.frontendMode, "enhance");
  assert.equal(parsed.adsEnabled, true);
  assert.equal(parsed.body.themeId, rendered.body.themeId);
  const preview = { ...rendered, preview: true };
  const previewJson = publicHtml(shell, preview).match(
    /<script type="application\/json" id="theme-render">([\s\S]*?)<\/script>/,
  )[1];
  assert.equal(JSON.parse(previewJson).html, rendered.html);
});

test("native content images reserve their intrinsic aspect ratio before loading", () => {
  const document = defaultTheme();
  document.templates.home.children = [
    {
      id: "blk_image-dimensions",
      type: "core/image",
      settings: { mediaId: "image", size: "medium" },
    },
  ];
  compileDocument(document);
  const html = renderTheme(document, {
    kind: "home",
    settings: {},
    allContent: [],
    media: [
      {
        id: "image",
        type: "image",
        url: "/api/media/image/file",
        mime: "image/png",
        updatedAt: "version",
        altText: "Content image",
        metadata: { width: 1200, height: 800 },
      },
    ],
  }).html;
  assert.match(html, /width="1200" height="800"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
  assert.match(html, /srcset="/);
  assert.match(html, /sizes="/);
  assert.doesNotMatch(
    sanitizeTemplate(
      '<img src="/safe.png" srcset="javascript:alert(1) 1x" onerror="bad()">',
      [],
      "render",
      true,
    ),
    /javascript:|onerror/,
  );
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
