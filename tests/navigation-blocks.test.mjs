import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultTheme,
  validateDocument,
  renderTheme,
  renderContentCanvas,
} from "../server/theme-engine.mjs";
import { validateDetails } from "../server/v2-utils.mjs";
import { migrateThemeDocument } from "../server/theme-migrations.mjs";
import { normalizeMenuDocument } from "../shared/context-blocks.ts";
import { applyOutlineCommand } from "../shared/outline-document.ts";
import definitions from "../shared/theme-blocks.json" with { type: "json" };
import {
  navigationSettingsError,
  safeNavigationHref,
} from "../shared/navigation-blocks.ts";

const button = (settings = {}) => ({
  id: "blk_button_fixture",
  type: "core/button",
  settings: {
    text: "Contact",
    href: "/contact",
    iconName: "arrow-right",
    iconPosition: "after",
    ...settings,
  },
});
const menu = (settings = {}, children = []) => ({
  id: "blk_menu_fixture",
  type: "core/menu",
  settings,
  children,
});
const ctx = {
  kind: "home",
  settings: { homePageId: "home" },
  allContent: [
    {
      id: "home",
      kind: "page",
      slug: "home",
      title: "Home",
      status: "published",
    },
    {
      id: "about",
      kind: "page",
      slug: "about",
      title: "About",
      status: "published",
    },
    {
      id: "draft",
      kind: "page",
      slug: "draft",
      title: "Secret draft",
      status: "draft",
    },
  ],
  media: [],
};
const document = (node) => {
  const doc = defaultTheme();
  doc.templates.home.children = [node];
  return doc;
};
const render = (node) =>
  renderTheme(validateDocument(document(node), true), ctx);

test("Custom Link blocks support menu insertion, dropdown nesting, typography, content saves and safe URLs", async () => {
  const doc = document(
    menu({ automaticPages: false }, [
      {
        id: "blk_parent_custom_link",
        type: "core/menu-item",
        settings: { label: "Resources", href: "#" },
        children: [],
      },
    ]),
  );
  const root = doc.templates.home;
  applyOutlineCommand(
    root,
    {
      type: "insert",
      parentId: "blk_menu_fixture",
      index: 1,
      blockType: "core/custom-link",
    },
    definitions,
  );
  const link = root.children[0].children[1];
  link.settings = {
    label: "GitHub & docs",
    href: "https://github.com/exenreco",
    newTab: true,
    color: "#123456",
    fontSize: 24,
  };
  applyOutlineCommand(
    root,
    {
      type: "move",
      id: link.id,
      parentId: "blk_parent_custom_link",
      index: 0,
    },
    definitions,
  );
  assert.equal(root.children[0].children[0].children[0].id, link.id);
  const html = renderTheme(validateDocument(doc, true), ctx).html;
  assert.match(html, /theme-menu-dropdown/);
  assert.match(
    html,
    /href="https:\/\/github.com\/exenreco" target="_blank" rel="noopener noreferrer">GitHub &amp; docs/,
  );
  assert.match(html, /font-size:24px/);
  const details = await validateDetails(
    { prepare: () => ({ first: async () => null }) },
    { contentBlocks: root.children },
  );
  const canvas = renderContentCanvas(
    defaultTheme(),
    { ...ctx, kind: "page", content: { title: "Page", details } },
    "blk_main_customlink",
  );
  assert.match(canvas.html, /GitHub &amp; docs/);
  assert.throws(
    () =>
      render({
        ...link,
        settings: { ...link.settings, href: "javascript:alert(1)" },
      }),
    /safe custom link/,
  );
  await assert.rejects(
    validateDetails(
      { prepare: () => ({ first: async () => null }) },
      {
        contentBlocks: [{ ...link, settings: { href: "javascript:alert(1)" } }],
      },
    ),
    /safe custom link/,
  );
});

test("empty media and icon blocks never publish editor prompts or placeholders", () => {
  for (const node of [
    { id: "blk_empty_image", type: "core/image", settings: {} },
    { id: "blk_empty_media", type: "core/media", settings: {} },
    { id: "blk_empty_icon", type: "core/icon", settings: { iconName: "" } },
    {
      id: "blk_empty_model",
      type: "core/gltf",
      settings: { source: "url", url: "", alt: "" },
      children: [],
    },
  ]) {
    const html = render(node).html;
    assert.doesNotMatch(
      html,
      /Choose (?:an image|a media|a model)|cl-editor-block-placeholder/,
    );
    if (node.type === "core/icon") assert.doesNotMatch(html, /<svg/);
  }
});

test("Button icons appear before or after text and inherit shared appearance", () => {
  let html = render(
    button({
      iconPosition: "before",
      fontSize: 24,
      color: "#112233",
      newTab: true,
    }),
  ).html;
  assert.ok(html.indexOf("<svg") < html.indexOf("<span>Contact"));
  assert.match(html, /target="_blank"/);
  assert.match(html, /color:#112233/);
  html = render(button()).html;
  assert.ok(html.indexOf("<span>Contact") < html.indexOf("<svg"));
  assert.doesNotMatch(render(button({ iconPosition: "none" })).html, /<svg/);
});
test("Menu resolves selected pages, dropdowns, home URL and Button children", () => {
  const result = render(
    menu(
      {
        orientation: "vertical",
        align: "right",
        mobileBreakpoint: "640",
        items: [
          {
            id: "a",
            label: "Start",
            pageId: "home",
            children: [{ id: "b", label: "About us", pageId: "about" }],
          },
          { id: "c", label: "Hidden", pageId: "draft" },
        ],
      },
      [button()],
    ),
  );
  assert.match(result.html, /href="\/"[^>]*>Start/);
  assert.match(result.html, /theme-menu-dropdown/);
  assert.match(result.html, /href="\/about"[^>]*>About us/);
  assert.doesNotMatch(result.html, /Hidden|Secret draft/);
  assert.match(result.html, /theme-button/);
  assert.match(result.html, /--menu-direction:column/);
  assert.match(result.html, /--menu-align:flex-end/);
  assert.match(result.css, /@media\(max-width:640px\)/);
  assert.match(result.html, /aria-expanded="false"/);
});
test("Existing menus migrate without losing automatic pages or appearance", () => {
  const legacy = menu({ orientation: "vertical", color: "#123456" });
  delete legacy.children;
  const migrated = migrateThemeDocument(document(legacy));
  assert.deepEqual(migrated.templates.home.children[0].children, []);
  assert.equal(migrated.templates.home.children[0].settings.color, "#123456");
  assert.match(renderTheme(migrated, ctx).html, /About/);
  assert.deepEqual(migrateThemeDocument(migrated), migrated);
  assert.doesNotMatch(render(menu({ items: [] })).html, /About/);
});
test("Menu and Button reject unsafe links, duplicate menu IDs and invalid children", async () => {
  for (const href of [
    "javascript:alert(1)",
    "//evil.test",
    "/\\evil.test",
    "data:text/html,bad",
  ])
    assert.equal(safeNavigationHref(href), "");
  assert.throws(
    () => render(button({ href: "javascript:alert(1)" })),
    /safe button link/,
  );
  assert.ok(
    navigationSettingsError("core/menu", {
      items: [
        { id: "a", label: "One" },
        { id: "a", label: "Two" },
      ],
    }),
  );
  assert.throws(
    () =>
      render(
        menu({}, [
          {
            id: "blk_bad_child",
            type: "core/paragraph",
            settings: { text: "Bad" },
          },
        ]),
      ),
    /Button, and Search blocks only/,
  );
  await assert.rejects(
    validateDetails(
      { prepare: () => ({ first: async () => null }) },
      { contentBlocks: [button({ href: "javascript:bad()" })] },
    ),
    /safe button link/,
  );
});
test("Posts and pages persist Menu children and render Buttons in their own canvas", async () => {
  const details = await validateDetails(
    { prepare: () => ({ first: async () => null }) },
    {
      contentBlocks: [
        menu(
          { items: [{ id: "about-menu", label: "About", pageId: "about" }] },
          [button()],
        ),
      ],
    },
  );
  for (const kind of ["post", "page"]) {
    const output = renderContentCanvas(
      defaultTheme(),
      { ...ctx, kind, content: { title: "Fixture", details } },
      "blk_main_fixture",
    );
    assert.match(output.html, /theme-button/);
    assert.match(output.html, /href="\/about"/);
  }
});

test("legacy menu item arrays become nested blocks and preserve links and Button children", () => {
  const doc = document(
    menu(
      {
        items: [
          {
            id: "parent",
            label: "Explore",
            href: "/explore",
            children: [{ id: "child", label: "About", pageId: "about" }],
          },
        ],
      },
      [button()],
    ),
  );
  const upgraded = migrateThemeDocument(doc);
  const parent = upgraded.templates.home.children[0].children[0];
  assert.equal(parent.type, "core/menu-item");
  assert.equal(parent.children[0].settings.pageId, "about");
  assert.equal(
    upgraded.templates.home.children[0].children[1].type,
    "core/button",
  );
  assert.equal(upgraded.templates.home.children[0].settings.items, undefined);
  assert.deepEqual(migrateThemeDocument(upgraded), upgraded);
  const html = renderTheme(upgraded, ctx).html;
  assert.match(html, /theme-menu-dropdown/);
  assert.match(html, new RegExp(`data-block-id="${parent.children[0].id}"`));
});
test("automatic menus turn current pages into editable blocks and migration is idempotent", () => {
  const doc = document(menu());
  assert.ok(normalizeMenuDocument(doc, ctx.allContent, ctx.settings));
  const node = doc.templates.home.children[0];
  assert.equal(node.settings.automaticPages, false);
  assert.ok(node.children.every((child) => child.type === "core/menu-item"));
  assert.ok(node.children.some((child) => child.settings.pageId === "about"));
  assert.equal(normalizeMenuDocument(doc, ctx.allContent, ctx.settings), false);
});
test("Menu Items use normal tree commands, placement restrictions and shared typography", () => {
  const root = document(menu({ automaticPages: false })).templates.home;
  const selected = applyOutlineCommand(
    root,
    {
      type: "insert",
      parentId: "blk_menu_fixture",
      index: 0,
      blockType: "core/menu-item",
    },
    definitions,
  );
  const item = root.children[0].children[0];
  assert.equal(item.id, selected);
  applyOutlineCommand(
    root,
    {
      type: "insert",
      parentId: item.id,
      index: 0,
      blockType: "core/menu-item",
    },
    definitions,
  );
  item.settings = {
    label: "Styled link",
    href: "/about",
    fontSize: 24,
    color: "#123456",
  };
  const doc = defaultTheme();
  doc.templates.home = root;
  const html = renderTheme(validateDocument(doc, true), ctx).html;
  assert.match(html, /class="theme-menu-link" style="[^"]*color:#123456/);
  assert.match(html, /font-size:24px/);
  assert.throws(
    () =>
      applyOutlineCommand(
        root,
        { type: "move", id: item.id, parentId: root.id, index: 0 },
        definitions,
      ),
    /destination/,
  );
  assert.throws(
    () =>
      render({
        id: "blk_bad_menuitem",
        type: "core/menu-item",
        settings: { href: "/about" },
        children: [],
      }),
    /inside a Menu/,
  );
});
