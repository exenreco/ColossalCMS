import test from "node:test";
import assert from "node:assert/strict";
import {
  collectBlockPatterns,
  renderPatternPreview,
} from "../server/block-patterns.mjs";
import {
  validateBlockPatterns,
  clonePatternBlocks,
} from "../shared/block-patterns.ts";
import { defaultTheme, validateDocument } from "../server/theme-engine.mjs";
import { applyOutlineCommand } from "../shared/outline-document.ts";
import definitions from "../shared/theme-blocks.json" with { type: "json" };
import worker from "../server/worker.mjs";
import { localDatabase } from "../scripts/local-database.mjs";
const sample = {
  id: "hero",
  name: "Theme hero",
  category: "Heroes",
  blocks: [
    {
      id: "sample",
      type: "core/paragraph",
      settings: { html: "Pattern copy" },
    },
  ],
};
const context = {
  settings: { title: "Studio", tagline: "Hello" },
  allContent: [],
  media: [],
  content: { title: "Example", details: {} },
};
test("core, theme and active plugin patterns keep separate namespaces and categories", () => {
  const theme = defaultTheme();
  theme.manifest.patterns = [sample];
  const patterns = collectBlockPatterns(theme, [
    { id: "test.active", name: "Active", active: true, patterns: [sample] },
    {
      id: "test.inactive",
      name: "Inactive",
      active: false,
      patterns: [sample],
    },
  ]);
  assert.equal(patterns.filter((p) => p.id === "hero").length, 3);
  assert.equal(new Set(patterns.map((p) => p.key)).size, patterns.length);
  assert.ok(!patterns.some((p) => p.source.id === "test.inactive"));
  assert.ok(patterns.every((p) => p.name && p.category && p.blocks.length));
});
test("registration bounds trees and requires names, categories and unique IDs", () => {
  for (const value of [
    [{ ...sample, name: "" }],
    [{ ...sample, category: "<script>" }],
    [sample, sample],
    [{ ...sample, blocks: [...sample.blocks, ...sample.blocks] }],
  ])
    assert.throws(() => validateBlockPatterns(value));
  assert.throws(() =>
    validateDocument(
      {
        ...defaultTheme(),
        manifest: {
          ...defaultTheme().manifest,
          patterns: [{ ...sample, name: "" }],
        },
      },
      true,
    ),
  );
});
test("pattern instances have fresh IDs, remain editable and do not mutate registrations", () => {
  const before = JSON.stringify(sample);
  const first = clonePatternBlocks(sample),
    second = clonePatternBlocks(sample);
  assert.notEqual(first[0].id, second[0].id);
  assert.equal(JSON.stringify(sample), before);
  const root = {
    id: "root",
    type: "core/container",
    settings: {},
    children: [...first, ...second],
  };
  applyOutlineCommand(
    root,
    { type: "update", id: first[0].id, settings: { html: "Edited instance" } },
    definitions,
  );
  assert.equal(second[0].settings.html, "Pattern copy");
});
test("all starter patterns render actual previews and unsafe HTML is sanitized", () => {
  const theme = defaultTheme();
  for (const pattern of collectBlockPatterns(theme)) {
    const rendered = renderPatternPreview(pattern, theme, context);
    assert.ok(rendered.html.includes("data-block-id"));
    assert.ok(rendered.css);
  }
  const unsafe = {
    ...sample,
    blocks: [
      {
        id: "unsafe",
        type: "core/rich-text",
        settings: {
          html: '<p>Safe copy</p><script>alert(1)</script><img src="x" onerror="alert(1)">',
        },
      },
    ],
  };
  const rendered = renderPatternPreview(unsafe, theme, context);
  assert.match(rendered.html, /Safe copy/);
  assert.doesNotMatch(rendered.html, /<script|onerror=/);
});
test("authenticated pattern API lists and previews without changing saved themes", async () => {
  const DB = localDatabase();
  const headers = {
    Origin: "https://cms.test",
    "Content-Type": "application/json",
    "oai-authenticated-user-id": "owner",
    "oai-authenticated-user-email": "owner@example.test",
  };
  const call = (path, method = "GET", body, auth = true) =>
    worker.fetch(
      new Request("https://cms.test/api" + path, {
        method,
        headers: auth ? headers : {},
        body: body ? JSON.stringify(body) : undefined,
      }),
      { DB },
    );
  try {
    await call("/admin/setup", "POST", {});
    assert.equal(
      (await call("/admin/editor/patterns", "GET", undefined, false)).status,
      401,
    );
    const list = await (await call("/admin/editor/patterns")).json();
    assert.ok(list.patterns.length >= 3);
    const before = await DB.prepare(
      "SELECT published,draft FROM themes WHERE active=1",
    ).first();
    const response = await call("/admin/editor/patterns/preview", "POST", {
      pattern: list.patterns[0],
    });
    assert.equal(response.status, 200);
    assert.match((await response.json()).html, /Make something remarkable/);
    assert.equal(
      (
        await call("/admin/editor/patterns/preview", "POST", {
          pattern: { ...sample, category: "" },
        })
      ).status,
      400,
    );
    assert.deepEqual(
      await DB.prepare(
        "SELECT published,draft FROM themes WHERE active=1",
      ).first(),
      before,
    );
  } finally {
    DB.close();
  }
});
