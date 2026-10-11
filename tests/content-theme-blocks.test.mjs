import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultTheme,
  renderContentCanvas,
  renderTheme,
} from "../server/theme-engine.mjs";
import { validateDetails, mediaIds } from "../server/v2-utils.mjs";

const db = {
  prepare: () => ({
    first: async () => null,
    bind: () => ({ first: async () => ({ type: "image" }) }),
  }),
};
const block = (id, type, settings = {}, children) => ({
  id: `blk_${id}`,
  type,
  settings,
  ...(children ? { children } : {}),
});

test("content canvas inherits the resolved template Body background while keeping Main settings separate", () => {
  const theme = defaultTheme();
  for (const [id, kind, color] of [
    ["canvas-page", "page", "#123456"],
    ["canvas-post", "post", "#234567"],
    ["canvas-home", "home", "#345678"],
  ]) {
    theme.manifest.templates.push({
      id,
      name: id,
      file: `templates/${id}.html`,
      appliesTo: [kind],
      isTypeDefault: true,
    });
    theme.templates[id] = block(
      "body" + kind + "fixture",
      "core/container",
      { background: color, padding: 80, classes: "canvas-body" },
      [],
    );
    theme.manifest.templates.forEach((template) => {
      if (template.id !== id && template.appliesTo.includes(kind))
        template.isTypeDefault = false;
    });
  }
  const preview = (kind, content = {}, settings = {}) =>
    renderContentCanvas(
      theme,
      {
        kind,
        content: {
          details: {
            contentMain: { background: "#abcdef", padding: 16 },
            contentBlocks: [],
          },
          ...content,
        },
        settings,
        allContent: [],
        media: [],
      },
      "blk_main-background",
    );
  assert.match(preview("page").body.style, /background-color:#123456/);
  assert.match(preview("post").body.style, /background-color:#234567/);
  const home = preview("page", { id: "home" }, { homePageId: "home" });
  assert.match(home.body.style, /background-color:#345678/);
  assert.equal(home.body.templateId, "canvas-home");
  assert.equal(home.body.className, "canvas-body");
  assert.doesNotMatch(home.body.style, /padding/);
  assert.match(home.html, /background-color:#abcdef/);
  assert.doesNotMatch(home.html, /theme-part-/);
  theme.manifest.templates.push({
    id: "custom-page",
    name: "Custom",
    file: "templates/custom.html",
    appliesTo: ["page"],
  });
  theme.templates["custom-page"] = block(
    "bodycustomfixture",
    "core/container",
    { background: "#456789" },
    [],
  );
  assert.match(
    preview("page", { templateId: "custom-page" }).body.style,
    /background-color:#456789/,
  );
  assert.match(
    preview("page", { templateId: "missing" }).body.style,
    /background-color:#123456/,
  );
});

test("post and page theme blocks validate and render nested layout settings", async () => {
  const blocks = [
    block("heading01", "core/heading", { text: "Block heading", level: "h3" }),
    block("columns01", "core/columns", { gap: 18, stackOnMobile: true }, [
      block("column001", "core/column", {}, [
        block("richtext1", "core/rich-text", { html: "<p>Left side</p>" }),
      ]),
      block("column002", "core/column", {}, [
        block("richtext2", "core/rich-text", {
          html: '<p>Right side<script>alert("bad")</script></p>',
        }),
      ]),
    ]),
  ];
  const details = await validateDetails(db, { contentBlocks: blocks });
  const rendered = renderTheme(defaultTheme(), {
    kind: "page",
    content: { title: "Blocks", body: "", details },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media: [],
  });
  assert.match(rendered.html, /<h3>Block heading<\/h3>/);
  assert.match(rendered.html, /Left side/);
  assert.match(rendered.html, /Right side/);
  assert.doesNotMatch(rendered.html, /<script>/);
  assert.match(rendered.css, /grid-template-columns/);
});

test("content block validation rejects malformed columns and tracks media", async () => {
  await assert.rejects(
    validateDetails(db, {
      contentBlocks: [block("column001", "core/column", {}, [])],
    }),
    /inside Columns/,
  );
  await assert.rejects(
    validateDetails(db, {
      contentBlocks: [
        block("columns01", "core/columns", {}, [
          block("heading01", "core/heading", {}),
        ]),
      ],
    }),
    /Column blocks only/,
  );
  const details = await validateDetails(db, {
    contentBlocks: [block("image0001", "core/image", { mediaId: "image-1" })],
  });
  assert.deepEqual(mediaIds(details), ["image-1"]);
  assert.deepEqual(
    mediaIds({
      contentBlocks: [],
      richText: {
        type: "doc",
        content: [{ type: "media", attrs: { mediaId: "old-image" } }],
      },
    }),
    [],
  );
});

test("post and page blocks accept Slider, Slide, and nested Overlay content", async () => {
  const details = await validateDetails(db, {
    contentBlocks: [
      block("slider0001", "core/slider", { height: 300 }, [
        block("slide00001", "core/slide", {}, [
          block("overlay001", "core/overlay", {}, [
            block("caption001", "core/heading", { text: "Slide caption" }),
          ]),
        ]),
      ]),
    ],
  });
  const rendered = renderTheme(defaultTheme(), {
    kind: "page",
    content: { title: "Slider page", body: "", details },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media: [],
  });
  assert.match(rendered.html, /cl-swiper/);
  assert.match(rendered.html, /cl-overlay-block/);
  assert.match(rendered.html, /Slide caption/);
  await assert.rejects(
    validateDetails(db, {
      contentBlocks: [block("slide00001", "core/slide", {}, [])],
    }),
    /inside a Slider/,
  );
});

test("content blocks accept definitions supplied by the active theme", async () => {
  const customDb = {
    prepare: () => ({
      first: async () => ({
        published: JSON.stringify({
          blocks: [{ type: "acme/callout", container: false }],
        }),
      }),
    }),
  };
  const details = await validateDetails(customDb, {
    contentBlocks: [
      block("callout01", "acme/callout", { text: "Custom theme block" }),
    ],
  });
  assert.equal(details.contentBlocks[0].type, "acme/callout");
});

test("content canvas renders only the current entry inside Main", async () => {
  const details = await validateDetails(db, {
    contentMain: { padding: { top: 24, right: 0, bottom: 0, left: 0 } },
    contentBlocks: [
      block("heading01", "core/heading", {
        text: "Only this page",
        level: "h2",
      }),
      block("columns01", "core/columns", {}, [
        block("column001", "core/column", {}, [
          block("richtext1", "core/rich-text", { html: "<p>Left</p>" }),
        ]),
        block("column002", "core/column", {}, [
          block("richtext2", "core/rich-text", { html: "<p>Right</p>" }),
        ]),
      ]),
    ],
  });
  const rendered = renderContentCanvas(
    defaultTheme(),
    {
      kind: "page",
      content: { title: "My page", details },
      settings: { title: "Site", tagline: "" },
      allContent: [],
      media: [],
    },
    "blk_main-root",
  );
  assert.match(rendered.html, /^<main[^>]*data-block-id="blk_main-root"/);
  assert.match(rendered.html, /padding:24px 0px 0px 0px/);
  assert.doesNotMatch(rendered.html, /My page|content-main-title/);
  assert.match(rendered.html, /Only this page/);
  assert.match(rendered.html, /Left/);
  assert.match(rendered.html, /Right/);
  assert.doesNotMatch(
    rendered.html,
    /theme-part-|theme-site-brand|Site navigation/,
  );
  assert.match(rendered.css, /grid-template-columns/);
  const publicPage = renderTheme(defaultTheme(), {
    kind: "page",
    content: { id: "page-1", title: "My page", details },
    settings: { title: "Site", tagline: "" },
    allContent: [],
    media: [],
  });
  assert.match(
    publicPage.html,
    /<main class="theme-block content-main"[^>]*padding:24px/,
  );
  assert.match(publicPage.html, /theme-part-header/);
});
