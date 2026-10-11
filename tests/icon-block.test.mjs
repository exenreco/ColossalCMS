import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ICON_CATALOG,
  BLOCK_ICON_PATHS,
  APP_ICON_PATHS,
  EDITOR_ICON_PATHS,
  iconDrawing,
  searchIcons,
  renderIcon,
} from "../shared/icon-catalog.ts";
import {
  defaultTheme,
  validateDocument,
  renderTheme,
  renderContentCanvas,
  sanitizeTemplate,
} from "../server/theme-engine.mjs";
import { validateDetails } from "../server/v2-utils.mjs";

const context = { kind: "home", settings: {}, allContent: [], media: [] };
const icon = (settings = {}) => ({
  id: "blk_icon_fixture",
  type: "core/icon",
  settings,
});
const documentWithIcon = (settings) => {
  const document = defaultTheme();
  document.templates.home.children = [icon(settings)];
  return document;
};

test("icon picker catalog covers every bundled icon and searches labels and tokens", () => {
  const names = new Set(ICON_CATALOG.map((icon) => icon.name));
  assert.equal(names.size, ICON_CATALOG.length);
  for (const map of [BLOCK_ICON_PATHS, APP_ICON_PATHS, EDITOR_ICON_PATHS])
    for (const name of Object.keys(map)) assert.ok(names.has(name), name);
  assert.deepEqual(
    searchIcons("STAR").map((icon) => icon.name),
    ["star"],
  );
  assert.deepEqual(
    searchIcons("  up arrow ").map((icon) => icon.name),
    ["arrow-up", "arrow-up-right"],
  );
  assert.equal(searchIcons("no-such-icon").length, 0);
  assert.equal(searchIcons("").length, ICON_CATALOG.length);
  assert.deepEqual(iconDrawing("fas fa-star"), iconDrawing("star"));
  assert.deepEqual(iconDrawing("__proto__"), BLOCK_ICON_PATHS.block);
});

test("icon block renders local SVG, size and shared color appearance on public themes", () => {
  const rendered = renderTheme(
    validateDocument(
      documentWithIcon({ iconName: "shield", iconSize: 64, color: "#28775b" }),
      true,
    ),
    context,
  );
  assert.match(rendered.html, /<svg[^>]+class="theme-icon"/);
  assert.match(rendered.html, /viewbox="0 0 24 24"/);
  assert.match(rendered.html, /width="64" height="64"/);
  assert.match(rendered.html, /stroke="currentColor"/);
  assert.match(rendered.html, /color:#28775b/);
  assert.match(rendered.html, /aria-hidden="true"/);
  assert.match(rendered.html, /<path d="M12 2 3 6/);
  assert.doesNotMatch(rendered.html, /<script|src=|href=|Choose icon/);
});

test("meaningful icons expose escaped accessible labels and omit decorative hiding", () => {
  const rendered = renderTheme(
    validateDocument(
      documentWithIcon({
        iconName: "check",
        decorative: false,
        accessibleLabel: 'Complete "step" <one>',
      }),
      true,
    ),
    context,
  );
  assert.match(rendered.html, /role="img"/);
  assert.match(
    rendered.html,
    /aria-label="Complete &quot;step&quot; &lt;one&gt;"/,
  );
  assert.doesNotMatch(rendered.html, /aria-hidden/);
});

test("icon validation rejects unknown drawings, bounds sizes and supplies safe defaults", async () => {
  assert.throws(
    () =>
      validateDocument(
        documentWithIcon({ iconName: '<svg onload="alert(1)">' }),
        true,
      ),
    /bundled library/,
  );
  assert.equal(
    validateDocument(documentWithIcon({ iconSize: 9999 }), true).templates.home
      .children[0].settings.iconSize,
    512,
  );
  assert.equal(
    validateDocument(documentWithIcon({ iconSize: -50 }), true).templates.home
      .children[0].settings.iconSize,
    8,
  );
  assert.equal(
    validateDocument(documentWithIcon({ iconSize: "bad" }), true).templates.home
      .children[0].settings.iconSize,
    32,
  );
  assert.equal(
    validateDocument(documentWithIcon({}), true).templates.home.children[0]
      .settings.iconName,
    "star",
  );
  assert.doesNotMatch(
    renderIcon({ iconName: '" onload="bad()', iconSize: '32" onload="bad()' }),
    /onload|bad\(\)/,
  );
  await assert.rejects(
    validateDetails(
      { prepare: () => ({ first: async () => null }) },
      { contentBlocks: [icon({ iconName: "__proto__" })] },
    ),
    /bundled library/,
  );
});

test("SVG support is restricted to inert rendered icons; authored SVG and executable attributes stay stripped", () => {
  assert.doesNotMatch(
    sanitizeTemplate('<svg><path d="M0 0"></path></svg>'),
    /svg|path/,
  );
  const output = sanitizeTemplate(
    '<svg viewBox="0 0 24 24" onload="bad()"><script>bad()</script><use href="https://example.com/x.svg#x"></use><foreignObject><iframe src=x></iframe></foreignObject><path d="M0 0" onclick="bad()"></path></svg>',
    [],
    "render",
    true,
  );
  assert.match(output, /<svg viewbox="0 0 24 24">/);
  assert.match(output, /<path d="M0 0"/);
  assert.doesNotMatch(
    output,
    /onload|onclick|script|iframe|foreignobject|<use|href=|bad\(\)/,
  );
});

test("post and page icon blocks persist and render through their shared canvas", async () => {
  const details = await validateDetails(
    { prepare: () => ({ first: async () => null }) },
    {
      contentBlocks: [
        icon({
          iconName: "fas fa-moon",
          iconSize: 48,
          decorative: false,
          accessibleLabel: "Night mode",
        }),
      ],
    },
  );
  assert.equal(details.contentBlocks[0].settings.iconName, "moon");
  for (const kind of ["post", "page"]) {
    const rendered = renderContentCanvas(
      defaultTheme(),
      { ...context, kind, content: { title: "Icon content", details } },
      "blk_main_fixture",
    );
    assert.match(rendered.html, /<svg[^>]*width="48"/);
    assert.match(rendered.html, /aria-label="Night mode"/);
    assert.match(rendered.html, /<path d="M21 14/);
  }
});
