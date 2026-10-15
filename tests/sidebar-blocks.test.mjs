import test from "node:test";
import assert from "node:assert/strict";
import {
  renderProjectDetails,
  renderTableOfContents,
} from "../server/sidebar-blocks.mjs";
import { colossal2027Theme } from "../server/colossal-2027.mjs";
import { renderTheme } from "../server/theme-engine.mjs";
import { migrateGlasseyDocument } from "../server/glassey-migration.mjs";

test("Project details reads per-entry metadata, hides empty values and rejects unsafe links", () => {
  const content = {
    details: {
      panelData: {
        projectType: "Application",
        projectYear: "2026",
        projectTechnologies: "Angular, TypeScript, Angular",
        projectLiveUrl: "javascript:alert(1)",
        projectRepositoryUrl: "https://github.com/example/project",
      },
    },
  };
  const html = renderProjectDetails(
    { source: "content", projectType: "Wrong shared value" },
    content,
  );
  assert.match(html, /Application/);
  assert.match(html, /2026/);
  assert.match(html, /Angular/);
  assert.equal((html.match(/>Angular</g) || []).length, 1);
  assert.match(html, /View source/);
  assert.doesNotMatch(html, /javascript|Wrong shared value|View live site/);
  assert.equal(renderProjectDetails({}, { details: {} }), "");
  const custom = renderProjectDetails({
    source: "custom",
    technologies: "<script>bad</script>",
    liveUrl: "https://user:password@example.com",
  });
  assert.match(custom, /&lt;script&gt;/);
  assert.doesNotMatch(custom, /href=|<script>/);
});
test("TOC controls are bounded, script-free and available in Glossy's shared sidebar", () => {
  const markup = renderTableOfContents({
    minLevel: "h2",
    maxLevel: "h3",
    scrollOffset: 999,
    numbered: true,
  });
  assert.match(markup, /data-toc-offset="300"/);
  assert.match(markup, /data-toc-numbered="true"/);
  const d = colossal2027Theme();
  assert.ok(
    d.parts.sidebar.children.some(
      (node) => node.type === "core/table-of-contents",
    ),
  );
  assert.ok(
    d.parts.sidebar.children.some(
      (node) => node.type === "core/project-details",
    ),
  );
  const result = renderTheme(d, {
    kind: "post",
    content: {
      title: "Project",
      body: "Details",
      details: { panelData: { projectType: "Website" } },
    },
    settings: {},
    allContent: [],
    media: [],
  });
  assert.match(result.html, /data-toc-min="2"/);
  assert.match(result.html, /Website/);
  assert.doesNotMatch(result.html, /<script/);
  const before = structuredClone(d);
  migrateGlasseyDocument(d);
  assert.deepEqual(d, before);
});
