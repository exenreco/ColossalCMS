import test from "node:test";
import assert from "node:assert/strict";
import { colossal2027Theme } from "../server/colossal-2027.mjs";
import {
  moveGlossyFeaturedImageToSidebar,
  restoreGlossyCardFeaturedImages,
} from "../server/glossy-sidebar-featured-image.mjs";
import { renderTheme, validateDocument } from "../server/theme-engine.mjs";
const all = (node) => [node, ...(node.children || []).flatMap(all)];

test("Glossy keeps Featured Images in result cards and below Sidebar Search, without standalone template images", () => {
  const d = colossal2027Theme();
  const standalone = (node) =>
    node.type === "core/post-list"
      ? []
      : [node, ...(node.children || []).flatMap(standalone)];
  for (const [id, root] of Object.entries(d.templates))
    assert.equal(
      standalone(root).filter((n) => n.type === "core/featured-image").length,
      0,
      id,
    );
  const nodes = d.parts.sidebar.children;
  for (const id of ["post-archive", "search"])
    assert.ok(
      all(d.templates[id]).some((n) => n.type === "core/featured-image"),
    );
  assert.equal(
    nodes[nodes.findIndex((n) => n.type === "core/search") + 1].type,
    "core/featured-image",
  );
  assert.equal(
    all(d.parts.sidebar).filter((n) => n.type === "core/featured-image").length,
    1,
  );
  for (const template of ["default", "post-single"]) {
    const rendered = renderTheme(
      validateDocument(d, false),
      {
        kind: template === "default" ? "page" : "post",
        settings: {},
        allContent: [],
        media: [{ id: "featured", type: "image", url: "/feature.png" }],
        content: {
          id: "entry",
          title: "Current entry",
          body: "Content",
          details: { featuredImageId: "featured" },
        },
      },
      template,
    );
    assert.equal((rendered.html.match(/src="\/feature.png"/g) || []).length, 1);
    assert.match(
      rendered.html,
      /theme-part-sidebar[\s\S]*c27-sidebar-featured[\s\S]*feature.png/,
    );
  }
});

test("moving installed Featured Images preserves the configured image and unrelated content and is idempotent", () => {
  const image = {
    id: "existing-image",
    type: "core/featured-image",
    settings: {
      aspectRatio: "16/9",
      objectFit: "contain",
      classes: "authored",
    },
  };
  const heading = { id: "heading", type: "core/title", settings: {} };
  const d = {
    templates: {
      "post-single": { children: [heading, image] },
      search: {
        children: [
          {
            type: "core/post-list",
            children: [
              {
                type: "core/columns",
                children: [
                  {
                    type: "core/column",
                    settings: { classes: "c27-search-result-image" },
                    children: [
                      { id: "card-image", type: "core/featured-image" },
                    ],
                  },
                  {
                    type: "core/column",
                    settings: { classes: "copy" },
                    children: [structuredClone(heading)],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    parts: {
      sidebar: {
        children: [
          { id: "search", type: "core/search" },
          { id: "widget", type: "core/table-of-contents" },
        ],
      },
    },
    compiled: {},
  };
  moveGlossyFeaturedImageToSidebar(d);
  assert.equal(d.parts.sidebar.children[1], image);
  assert.equal(image.id, "existing-image");
  assert.equal(image.settings.aspectRatio, "16/9");
  assert.match(image.settings.classes, /authored/);
  assert.equal(d.templates["post-single"].children[0], heading);
  assert.equal(d.templates.search.children[0].children[0].children.length, 2);
  assert.equal(d.parts.sidebar.children[2].id, "widget");
  assert.equal(d.compiled, undefined);
  const once = structuredClone(d);
  moveGlossyFeaturedImageToSidebar(d);
  assert.deepEqual(d, once);
});

test("existing image-less cards regain their image column without duplicating images or changing Sidebar", () => {
  const d = colossal2027Theme();
  d.css =
    d.css.replace("/* Glossy restored card featured images */", "") +
    ".theme-root .c27-search-result-row>.theme-layout{grid-template-columns:minmax(0,1fr)}";
  const sidebar = structuredClone(d.parts.sidebar);
  const prune = (node) => {
    if (!node.children) return;
    node.children = node.children.filter(
      (n) =>
        n.type !== "core/featured-image" &&
        !String(n.settings?.classes || "").includes("c27-search-result-image"),
    );
    node.children.forEach(prune);
  };
  Object.values(d.templates).forEach(prune);
  restoreGlossyCardFeaturedImages(d);
  for (const id of ["post-archive", "search"]) {
    assert.equal(
      all(d.templates[id]).filter((n) => n.type === "core/featured-image")
        .length,
      1,
    );
    const row = all(d.templates[id]).find((n) =>
      String(n.settings?.classes || "").includes("c27-search-result-row"),
    );
    assert.equal(row.children[0].children[0].type, "core/featured-image");
    assert.equal(row.children.length, 2);
  }
  assert.deepEqual(d.parts.sidebar, sidebar);
  assert.ok(
    !d.css.includes(
      ".theme-root .c27-search-result-row>.theme-layout{grid-template-columns:minmax(0,1fr)}",
    ),
  );
  const once = structuredClone(d);
  restoreGlossyCardFeaturedImages(d);
  assert.deepEqual(d, once);
  validateDocument(d, false);
});
