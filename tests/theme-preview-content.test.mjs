import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultTheme,
  resolveTemplateForContent,
} from "../server/theme-engine.mjs";
import { templatePreviewContent } from "../server/theme-preview-content.mjs";

test("new templates preview sample content instead of an unrelated page", () => {
  const document = defaultTheme();
  const template = { id: "custom", name: "Custom layout", appliesTo: ["page"] };
  document.manifest.templates.push(template);
  document.templates.custom = structuredClone(document.templates.default);
  const previous = { kind: "page", title: "Previous page", templateId: "" };
  const context = { allContent: [previous] };
  const sample = templatePreviewContent(document, template, context);
  assert.equal(sample.title, "Sample title · Custom layout");
  assert.equal(sample.id, undefined);
  assert.equal(previous.title, "Previous page");
  const assigned = {
    kind: "page",
    title: "Assigned page",
    templateId: "custom",
  };
  context.allContent.push(assigned);
  assert.equal(templatePreviewContent(document, template, context), assigned);
});

test("default templates preview their content and prioritize explicit assignments", () => {
  const document = defaultTheme();
  const template = resolveTemplateForContent(document, "page", "").template;
  const automatic = { kind: "page", title: "Default page", templateId: "" };
  const assigned = {
    kind: "page",
    title: "Assigned page",
    templateId: template.id,
  };
  assert.equal(
    templatePreviewContent(document, template, { allContent: [automatic] }),
    automatic,
  );
  assert.equal(
    templatePreviewContent(document, template, {
      allContent: [automatic, assigned],
    }),
    assigned,
  );
});

test("Home, Posts and 404 template previews use the published pages assigned to those routes", () => {
  const document = defaultTheme();
  const pages = [
    {
      id: "assigned-home",
      kind: "page",
      title: "Real home",
      templateId: "",
      details: {
        contentBlocks: [
          {
            id: "hero",
            type: "core/paragraph",
            settings: { html: "Home hero copy" },
          },
        ],
      },
    },
    { id: "assigned-posts", kind: "page", title: "Real posts", templateId: "" },
    {
      id: "assigned-404",
      kind: "page",
      title: "Real missing page",
      templateId: "",
    },
  ];
  const context = {
    allContent: pages,
    settings: {
      homePageId: pages[0].id,
      postsPageId: pages[1].id,
      notFoundPageId: pages[2].id,
    },
  };
  for (const [scope, page] of [
    ["home", pages[0]],
    ["post-index", pages[1]],
    ["404", pages[2]],
  ]) {
    const template = resolveTemplateForContent(document, scope, "").template;
    assert.equal(templatePreviewContent(document, template, context), page);
  }
  const customHome = { id: "new-home", name: "New Home", appliesTo: ["home"] };
  document.manifest.templates.push(customHome);
  assert.equal(
    templatePreviewContent(document, customHome, context).title,
    "Sample title · New Home",
  );
});
