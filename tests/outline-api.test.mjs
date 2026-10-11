import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
import { CORE_THEME_ID, renderTheme } from "../server/theme-engine.mjs";

const owner = {
  "oai-authenticated-user-id": "outline-owner",
  "oai-authenticated-user-email": "outline@example.test",
};
const heading = (id, text) => ({
  id,
  type: "core/heading",
  settings: { text, level: "h2" },
});
const container = (id, children) => ({
  id,
  type: "core/container",
  settings: {},
  children,
});
async function fixture() {
  const DB = localDatabase();
  const call = (
    path,
    method = "GET",
    body,
    identity = owner,
    origin = "https://cms.test",
  ) =>
    worker.fetch(
      new Request("https://cms.test/api" + path, {
        method,
        headers: {
          ...identity,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      { DB },
    );
  await call("/admin/setup", "POST", {});
  const core = await (await call("/themes/" + CORE_THEME_ID)).json();
  const cloned = await (
    await call("/themes/" + CORE_THEME_ID + "/clone", "POST", {
      revision: core.revision,
      name: "Outline fixture",
    })
  ).json();
  const record = await (await call("/themes/" + cloned.id)).json();
  const document = record.published;
  document.templates.home = container("outline-root", [
    { id: "header-reference", type: "theme/part-header", settings: {} },
    container("group-a", [
      heading("heading-one", "First heading"),
      heading("heading-two", "Second heading"),
    ]),
    container("group-b", [heading("destination-heading", "Existing content")]),
    { id: "footer-reference", type: "theme/part-footer", settings: {} },
  ]);
  await DB.prepare("UPDATE themes SET published=?,manifest=? WHERE id=?")
    .bind(
      JSON.stringify(document),
      JSON.stringify(document.manifest),
      cloned.id,
    )
    .run();
  return {
    DB,
    call,
    id: cloned.id,
    path: "/themes/" + cloned.id + "/outline",
    document,
    revision: record.revision,
  };
}
const json = async (response) => ({
  status: response.status,
  body: await response.json(),
});

test("template previews select the signed template or shared part without changing the active theme", async () => {
  const f = await fixture();
  try {
    const preview = await json(
      await f.call("/themes/" + f.id + "/preview", "POST", {
        templateId: "home",
      }),
    );
    const token = new URL(
      preview.body.url,
      "https://cms.test",
    ).searchParams.get("themePreview");
    const result = await json(
      await f.call(
        "/themes/render?themePreview=" + encodeURIComponent(token),
        "GET",
        undefined,
        {},
      ),
    );
    assert.equal(result.status, 200);
    assert.match(result.body.html, /First heading/);
    const page = await json(
      await f.call("/themes/" + f.id + "/preview", "POST", {
        templateId: "default",
      }),
    );
    const pageToken = new URL(
      page.body.url,
      "https://cms.test",
    ).searchParams.get("themePreview");
    const pageResult = await json(
      await f.call(
        "/themes/render?themePreview=" +
          encodeURIComponent(pageToken) +
          "&templateId=home",
        "GET",
        undefined,
        {},
      ),
    );
    assert.doesNotMatch(pageResult.body.html, /First heading/);
    const part = await json(
      await f.call("/themes/" + f.id + "/preview", "POST", {
        templateId: "home",
        part: "header",
      }),
    );
    const partToken = new URL(
      part.body.url,
      "https://cms.test",
    ).searchParams.get("themePreview");
    const partResult = await json(
      await f.call(
        "/themes/render?themePreview=" + encodeURIComponent(partToken),
        "GET",
        undefined,
        {},
      ),
    );
    assert.doesNotMatch(partResult.body.html, /First heading/);
    assert.equal(
      (
        await f.call("/themes/" + f.id + "/preview", "POST", {
          templateId: "missing",
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await f.call("/themes/" + f.id + "/preview", "POST", {
          part: "missing",
        })
      ).status,
      404,
    );
  } finally {
    f.DB.close();
  }
});

test("outline reads current trees and writes only drafts with versioned labels, icons, and unchanged published content", async () => {
  const f = await fixture();
  try {
    const before = await json(await f.call(f.path));
    assert.equal(before.body.apiVersion, 1);
    assert.equal(before.body.root.label, "Body");
    assert.equal(before.body.status, "published");
    assert.equal(before.body.root.children[0].movable, true);
    assert.equal(before.body.root.children[0].removable, true);
    const renamed = await json(
      await f.call(f.path, "POST", {
        revision: f.revision,
        command: { type: "rename", id: "heading-one", label: "Welcome title" },
      }),
    );
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.revision, f.revision + 1);
    assert.equal(
      renamed.body.root.children[1].children[0].label,
      "Welcome title",
    );
    const icon = await json(
      await f.call(f.path, "POST", {
        revision: renamed.body.revision,
        command: { type: "icon", id: "heading-one", icon: "fas fa-star" },
      }),
    );
    assert.equal(icon.body.root.children[1].children[0].icon, "fas fa-star");
    const record = await (await f.call("/themes/" + f.id)).json();
    assert.equal(
      record.published.templates.home.children[1].children[0].editor,
      undefined,
    );
    assert.deepEqual(
      record.draft.templates.home.children[1].children[0].editor,
      { label: "Welcome title", icon: "fas fa-star" },
    );
    const published = await json(await f.call(f.path + "?draft=false"));
    assert.equal(published.body.root.children[1].children[0].label, "Heading");
    const output = renderTheme(
      record.draft,
      {
        settings: {},
        allContent: [],
        media: [],
        content: { title: "", body: "", details: {} },
        kind: "home",
        path: "/",
      },
      "home",
    );
    assert.doesNotMatch(output.html, /Welcome title/);
    assert.match(output.html, /First heading/);
  } finally {
    f.DB.close();
  }
});

test("outline moves shared parts anywhere, duplicates entire branches with fresh identities and rejects invalid drops without writes", async () => {
  const f = await fixture();
  try {
    const duplicated = await json(
      await f.call(f.path, "POST", {
        revision: f.revision,
        command: { type: "duplicate", id: "group-a" },
      }),
    );
    assert.equal(duplicated.status, 200);
    const branch = duplicated.body.root.children[2];
    assert.notEqual(branch.id, "group-a");
    assert.equal(
      new Set([
        ...branch.children.map((child) => child.id),
        "heading-one",
        "heading-two",
      ]).size,
      4,
    );
    const moved = await json(
      await f.call(f.path, "POST", {
        revision: duplicated.body.revision,
        command: {
          type: "move",
          id: "header-reference",
          parentId: "group-b",
          index: 1,
        },
      }),
    );
    assert.equal(moved.status, 200);
    assert.equal(
      moved.body.root.children.find((child) => child.id === "group-b")
        .children[1].id,
      "header-reference",
    );
    const saved = (
      await f.DB.prepare("SELECT * FROM themes WHERE id=?").bind(f.id).first()
    ).draft;
    for (const command of [
      { type: "move", id: "group-a", parentId: "group-a", index: 0 },
      { type: "move", id: "outline-root", parentId: "group-b", index: 0 },
      { type: "move", id: "heading-one", parentId: "group-b", index: -1 },
    ]) {
      assert.equal(
        (
          await f.call(f.path, "POST", {
            revision: moved.body.revision,
            command,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await f.DB.prepare("SELECT * FROM themes WHERE id=?")
            .bind(f.id)
            .first()
        ).draft,
        saved,
      );
    }
    const columns = await json(
      await f.call(f.path, "POST", {
        revision: moved.body.revision,
        command: {
          type: "insert",
          blockType: "core/columns",
          parentId: "outline-root",
          index: 0,
        },
      }),
    );
    const placed = await json(
      await f.call(f.path, "POST", {
        revision: columns.body.revision,
        command: {
          type: "move",
          id: "heading-one",
          parentId: columns.body.selectedId,
          index: 0,
        },
      }),
    );
    assert.equal(placed.status, 200);
    assert.equal(placed.body.root.children[0].children[0].type, "core/column");
    assert.equal(
      placed.body.root.children[0].children[0].children[0].id,
      "heading-one",
    );
  } finally {
    f.DB.close();
  }
});

test("outline HTTP authentication, origin, concurrency, and shared-part scope match the theme editor", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call(f.path, "GET", undefined, {})).status, 401);
    await f.DB.prepare(
      "INSERT INTO members (id,email,role) VALUES ('outline-editor','editor@example.test','editor')",
    ).run();
    assert.equal(
      (
        await f.call(f.path, "GET", undefined, {
          "oai-authenticated-user-id": "outline-editor",
          "oai-authenticated-user-email": "editor@example.test",
        })
      ).status,
      403,
    );
    const body = {
      revision: f.revision,
      command: { type: "rename", id: "heading-one", label: "Renamed" },
    };
    assert.equal(
      (await f.call(f.path, "POST", body, owner, "https://other.test")).status,
      403,
    );
    assert.equal(
      (await f.call(f.path, "POST", { ...body, apiVersion: 2 })).status,
      400,
    );
    assert.equal((await f.call(f.path + "?part=missing")).status, 404);
    assert.equal((await f.call(f.path + "?templateId=missing")).status, 404);
    const part = await json(await f.call(f.path + "?part=header"));
    const updated = await json(
      await f.call(f.path, "POST", {
        revision: f.revision,
        part: "header",
        command: {
          type: "update",
          id: part.body.root.id,
          settings: { background: "#123456" },
        },
      }),
    );
    assert.equal(updated.status, 200);
    const record = await (await f.call("/themes/" + f.id)).json();
    assert.equal(record.draft.parts.header.settings.background, "#123456");
    assert.deepEqual(record.draft.templates.home, f.document.templates.home);
    assert.equal((await f.call(f.path, "POST", body)).status, 409);
  } finally {
    f.DB.close();
  }
});

test("outline command writes validate metadata and sanitize content without accepting forged settings or invalid block types", async () => {
  const f = await fixture();
  try {
    for (const command of [
      { type: "rename", id: "heading-one", label: "<script>bad</script>" },
      { type: "icon", id: "heading-one", icon: "javascript:bad" },
      {
        type: "insert",
        parentId: "group-b",
        index: 0,
        blockType: "unknown/executable",
      },
      {
        type: "update",
        id: "heading-one",
        settings: JSON.parse('{"__proto__":{"polluted":true}}'),
      },
      {
        type: "update",
        id: "heading-one",
        settings: { nested: { constructor: "bad" } },
      },
      { type: "rename", id: "outline-root", label: "Invalid root label" },
    ])
      assert.equal(
        (await f.call(f.path, "POST", { revision: f.revision, command }))
          .status,
        400,
      );
    assert.equal(
      (await f.DB.prepare("SELECT * FROM themes WHERE id=?").bind(f.id).first())
        .draft,
      null,
    );
    const inserted = await json(
      await f.call(f.path, "POST", {
        revision: f.revision,
        command: {
          type: "insert",
          parentId: "group-b",
          index: 0,
          blockType: "core/rich-text",
          settings: { html: "<p>Safe text</p><script>alert(1)</script>" },
        },
      }),
    );
    assert.equal(inserted.status, 200);
    const record = await (await f.call("/themes/" + f.id)).json();
    assert.equal(
      record.draft.templates.home.children[2].children[0].settings.html,
      "<p>Safe text</p>",
    );
  } finally {
    f.DB.close();
  }
});
