import test from "node:test";
import assert from "node:assert/strict";
import {
  sharedPartDefinitions,
  sharedPartPlacementError,
  sharedPartsError,
} from "../shared/shared-part-blocks.ts";
import {
  defaultTheme,
  renderTheme,
  renderContentCanvas,
  validateDocument,
  CORE_THEME_ID,
} from "../server/theme-engine.mjs";
import { validateDetails } from "../server/v2-utils.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import worker from "../server/worker.mjs";

const block = (id, type, settings = {}, children) => ({
  id: "blk_" + id,
  type,
  settings,
  ...(children ? { children } : {}),
});
const container = (id, children) => block(id, "core/container", {}, children);
const reference = (id, name, settings = {}) =>
  block(id, "theme/part-" + name, settings);
const context = {
  kind: "home",
  path: "/",
  settings: { title: "Shared site" },
  media: [],
  content: { title: "Current page", details: {} },
  allContent: [],
};
const uniqueIds = (html) => {
  const ids = [...html.matchAll(/ data-block-id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
};

test("all existing parts become discoverable blocks and self-references are unavailable", () => {
  const document = defaultTheme();
  const blocks = sharedPartDefinitions(document.parts);
  assert.deepEqual(
    blocks.map((b) => b.label),
    ["Header", "Footer", "Sidebar", "Content"],
  );
  assert.ok(
    blocks.every(
      (b) =>
        b.category === "Shared Parts" && b.fields.length === 0 && !b.container,
    ),
  );
  const editing = sharedPartDefinitions(document.parts, "header");
  assert.equal(
    editing.find((b) => b.type === "theme/part-header").disabled,
    true,
  );
  assert.equal(
    editing.find((b) => b.type === "theme/part-footer").disabled,
    undefined,
  );
  const contentBlocks = sharedPartDefinitions(document.parts, "", true);
  assert.equal(
    contentBlocks.find((b) => b.type === "theme/part-content").disabled,
    true,
  );
});

test("repeated shared blocks have editable instance wrappers, independent appearance, and unique descendant identities", () => {
  const document = defaultTheme();
  document.parts.header = container("shared_header", [
    block("shared_heading", "core/heading", {
      text: "Linked greeting",
      anchor: "greeting",
    }),
  ]);
  document.templates.home.children = [
    reference("header_first", "header", {
      background: "#123456",
      padding: { top: 12 },
      classes: "first-use",
    }),
    container("header_layout", [
      reference("header_second", "header", { background: "#654321" }),
    ]),
  ];
  validateDocument(document, true);
  delete document.compiled;
  const rendered = renderTheme(document, context, "home");
  uniqueIds(rendered.html);
  assert.equal((rendered.html.match(/Linked greeting/g) || []).length, 2);
  assert.match(
    rendered.html,
    /data-block-id="blk_header_first"[^>]*theme-part-header[^>]*background-color:#123456/,
  );
  assert.match(
    rendered.html,
    /data-block-id="blk_header_second"[^>]*background-color:#654321/,
  );
  assert.match(rendered.html, /data-source-block-id="blk_shared_heading"/);
  const anchors = [...rendered.html.matchAll(/ id="(greeting[^"]*)"/g)].map(
    (m) => m[1],
  );
  assert.equal(new Set(anchors).size, 2);
  document.parts.header.children[0].settings.text = "Updated everywhere";
  delete document.compiled;
  const updated = renderTheme(document, context, "home");
  assert.equal((updated.html.match(/Updated everywhere/g) || []).length, 2);
  assert.doesNotMatch(updated.html, /Linked greeting/);
});

test("shared blocks inside Post list retain each result's context and unique render identities", () => {
  const document = defaultTheme();
  document.parts.sidebar = container("shared_result", [
    block("shared_title", "core/title"),
  ]);
  document.templates.home.children = [
    block("shared_list", "core/post-list", { limit: 2 }, [
      reference("result_reference", "sidebar"),
    ]),
  ];
  validateDocument(document, true);
  delete document.compiled;
  const rendered = renderTheme(
    document,
    {
      ...context,
      allContent: ["First", "Second"].map((title, i) => ({
        id: "p" + i,
        kind: "post",
        status: "published",
        title,
        slug: "p" + i,
        publishAt: "2026-10-08T12:00:00Z",
        details: {},
      })),
    },
    "home",
  );
  assert.match(rendered.html, /First/);
  assert.match(rendered.html, /Second/);
  uniqueIds(rendered.html);
});

test("direct and indirect shared part cycles are rejected before rendering", () => {
  const document = defaultTheme();
  document.parts.footer.children = [reference("footer_header", "header")];
  assert.match(
    sharedPartPlacementError(
      reference("header_footer", "footer"),
      document.parts,
      "header",
    ),
    /circular/,
  );
  document.parts.header.children.push(reference("header_footer", "footer"));
  assert.match(sharedPartsError(document.parts), /circular/);
  assert.throws(() => validateDocument(document, true), /circular/);
  assert.match(
    sharedPartPlacementError(
      reference("missing_ref", "unknown"),
      document.parts,
    ),
    /Unknown/,
  );
});

test("posts and pages can explicitly use shared blocks without recursive page-body references", async () => {
  const document = defaultTheme();
  const db = {
    prepare: () => ({
      first: async () => ({ published: JSON.stringify(document) }),
    }),
  };
  const details = await validateDetails(db, {
    contentBlocks: [reference("content_header", "header")],
  });
  for (const kind of ["post", "page"]) {
    const rendered = renderContentCanvas(document, {
      ...context,
      kind,
      content: { title: "Entry", details },
    });
    assert.match(rendered.html, /data-block-id="blk_content_header"/);
    assert.match(rendered.html, /Shared site/);
  }
  await assert.rejects(
    validateDetails(db, {
      contentBlocks: [reference("body_recursive", "content")],
    }),
    /page body/,
  );
  await assert.rejects(
    validateDetails(db, {
      contentBlocks: [reference("body_missing", "missing")],
    }),
    /Unknown/,
  );
});

test("HTTP outline commands insert, duplicate, paste and remove shared blocks while preserving the shared source", async () => {
  const DB = localDatabase();
  const call = (path, method = "GET", body) =>
    worker.fetch(
      new Request("https://cms.test/api" + path, {
        method,
        headers: {
          "oai-authenticated-user-id": "shared-owner",
          "oai-authenticated-user-email": "shared@example.test",
          Origin: "https://cms.test",
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      { DB },
    );
  try {
    await call("/admin/setup", "POST", {});
    const core = await (await call("/themes/" + CORE_THEME_ID)).json();
    const clone = await (
      await call("/themes/" + CORE_THEME_ID + "/clone", "POST", {
        revision: core.revision,
        name: "Shared block commands",
      })
    ).json();
    const path = "/themes/" + clone.id;
    const initial = await (await call(path)).json();
    const rootId = initial.published.templates.home.id;
    let revision = initial.revision;
    const command = async (value, extra = {}) => {
      const response = await call(path + "/outline", "POST", {
        revision,
        templateId: "home",
        command: value,
        ...extra,
      });
      assert.equal(
        response.status,
        200,
        JSON.stringify(await response.clone().json()),
      );
      const result = await response.json();
      revision = result.revision;
      return result;
    };
    const inserted = await command({
      type: "insert",
      parentId: rootId,
      index: 0,
      blockType: "theme/part-header",
      settings: { background: "#123456" },
    });
    const id = inserted.root.children[0].id;
    assert.equal(inserted.root.children[0].removable, true);
    await command({ type: "duplicate", id });
    const draft = (await (await call(path)).json()).draft;
    await command({
      type: "paste",
      parentId: rootId,
      index: 0,
      node: draft.templates.home.children[0],
    });
    await command({ type: "remove", id });
    const record = await (await call(path)).json();
    assert.deepEqual(record.draft.parts.header, initial.published.parts.header);
    assert.deepEqual(
      record.published.templates.home,
      initial.published.templates.home,
    );
    const partRoot = record.draft.parts.header.id;
    const before = JSON.stringify(record.draft);
    const rejected = await call(path + "/outline", "POST", {
      revision,
      part: "header",
      command: {
        type: "insert",
        blockType: "theme/part-header",
        parentId: partRoot,
        index: 0,
      },
    });
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json()).error, /circular/);
    assert.equal(
      JSON.stringify((await (await call(path)).json()).draft),
      before,
    );
  } finally {
    DB.close();
  }
});
