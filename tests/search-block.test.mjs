import test from "node:test";
import assert from "node:assert/strict";
import { colossal2027Theme } from "../server/colossal-2027.mjs";
import { validateDocument, renderTheme } from "../server/theme-engine.mjs";
const context = {
  kind: "home",
  settings: {},
  allContent: [],
  media: [],
  query: 'a"<script>bad</script>',
};
test("Search is an editable menu block with native GET submission and accessible expanding controls", () => {
  const d = colossal2027Theme();
  const found = [];
  const visit = (n) => {
    if (n.type === "core/search") found.push(n);
    n.children?.forEach(visit);
  };
  visit(d.parts.header);
  assert.equal(found.length, 1);
  assert.equal(found[0].settings.presentation, "expand");
  const result = renderTheme(validateDocument(d, false), context, "home");
  assert.match(
    result.html,
    /class="theme-search theme-search-glass" data-search-mode="expand" action="\/search" method="get" role="search"/,
  );
  assert.match(result.html, /aria-label="Open search"/);
  assert.match(result.html, /name="q"/);
  assert.doesNotMatch(result.html, /<script>bad/);
  assert.match(result.css, /\.theme-search\[data-search-open\]/);
});
test("Search can stay expanded with its inspector presentation control", () => {
  const d = colossal2027Theme();
  d.parts.sidebar.children = [
    {
      id: "inline-search",
      type: "core/search",
      settings: {
        presentation: "inline",
        placeholder: "Find a project",
        buttonLabel: "Find",
      },
    },
  ];
  d.templates["post-single"].children[1].children[1].children[0] = {
    id: "sidebar",
    type: "theme/part-sidebar",
    settings: {},
  };
  const result = renderTheme(
    validateDocument(d, false),
    { ...context, kind: "post" },
    "post-single",
  );
  assert.match(result.html, /data-search-mode="inline"/);
  assert.match(result.html, /placeholder="Find a project"/);
  assert.match(result.html, /aria-label="Find"/);
});

test("Search styles are selectable and Glossy's Search template uses the darker reference", () => {
  const d = colossal2027Theme();
  const search = renderTheme(
    validateDocument(d, false),
    { ...context, kind: "search" },
    "search",
  );
  assert.match(search.html, /theme-search-dark/);
  assert.match(search.html, /data-search-mode="inline"/);
  const visit = (n) => {
    if (n.type === "core/search") n.settings.searchStyle = "light-outline";
    n.children?.forEach(visit);
  };
  visit(d.templates.search);
  const light = renderTheme(
    validateDocument(d, false),
    { ...context, kind: "search" },
    "search",
  );
  assert.match(light.html, /theme-search-light-outline/);
  assert.match(
    light.css,
    /theme-search-light-outline\{background:#fff;color:#4b4b4b;border:2px solid #4b4b4b/,
  );
});
