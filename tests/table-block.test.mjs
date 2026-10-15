import test from "node:test";
import assert from "node:assert/strict";
import { parseDocument } from "htmlparser2";
import { findAll, textContent } from "domutils";
import {
  defaultTheme,
  validateDocument,
  renderTheme,
  renderContentCanvas,
} from "../server/theme-engine.mjs";
import {
  normalizeTableData,
  DEFAULT_TABLE_DATA,
} from "../shared/table-block.ts";
import { validateDetails } from "../server/v2-utils.mjs";
const context = {
  kind: "page",
  content: { id: "table-page", title: "Table", details: {} },
  settings: {},
  allContent: [],
  media: [],
};
const node = (tableData = {}, caption = "Comparison") => ({
  id: "blk_table_sample",
  type: "core/table",
  settings: {
    caption,
    tableData: { ...structuredClone(DEFAULT_TABLE_DATA), ...tableData },
  },
});
function render(block) {
  const d = defaultTheme();
  d.templates.default.children.splice(1, 0, block);
  return renderTheme(validateDocument(d, true), context, "default");
}
test("Table renders semantic header, row headers, footer, caption, safe cells and independent odd/even colors", () => {
  const result = render(
    node({
      headerColumn: true,
      footerRow: true,
      rows: [
        ["Name", "Value"],
        ["A", "<script>alert(1)</script>"],
        ["B", "20"],
        ["Total", "30"],
      ],
      oddColor: "#123456",
      evenColor: "#abcdef",
      headerBackground: "#222222",
      headerColor: "#ffffff",
      borderStyle: "dashed",
      cellPadding: 16,
    }),
  );
  const tree = parseDocument(result.html);
  assert.equal(
    findAll((n) => n.name === "caption", tree.children).map(textContent)[0],
    "Comparison",
  );
  assert.equal(findAll((n) => n.name === "thead", tree.children).length, 1);
  assert.equal(findAll((n) => n.name === "tfoot", tree.children).length, 1);
  assert.equal(
    findAll((n) => n.name === "th" && n.attribs.scope === "row", tree.children)
      .length,
    3,
  );
  assert.equal(
    findAll((n) => n.name === "th" && n.attribs.scope === "col", tree.children)
      .length,
    2,
  );
  assert.doesNotMatch(result.html, /<script>/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.match(result.css, /nth-child\(odd\)[^{]*\{background:#123456/);
  assert.match(result.css, /nth-child\(even\)[^{]*\{background:#abcdef/);
  assert.match(result.css, /background:#222222;color:#ffffff/);
  assert.match(result.css, /padding:16px/);
  assert.match(result.css, /1px dashed #80808040/);
  assert.match(result.css, /overflow-x:auto/);
});
test("Table controls support headerless, unstriped, borderless and equal-width output; unsafe values are bounded", () => {
  const result = render(
    node({
      headerRow: false,
      footerRow: false,
      striped: false,
      borders: false,
      fixedLayout: true,
      oddColor: "red;display:none",
      headerBackground: "url(https://unsafe.test)",
      cellPadding: 999,
      borderWidth: 999,
      rows: [["Only cell"]],
    }),
  );
  assert.doesNotMatch(result.html, /<thead>|<tfoot>/);
  assert.match(result.css, /table-layout:fixed/);
  assert.match(result.css, /padding:48px/);
  assert.match(result.css, /border:0/);
  assert.doesNotMatch(result.css, /unsafe.test|red;display:none/);
  const data = normalizeTableData({ rows: [["a"], ["b", "c"]] });
  assert.deepEqual(data.rows, [
    ["a", ""],
    ["b", "c"],
  ]);
  assert.equal(
    normalizeTableData({
      rows: Array.from({ length: 60 }, () => Array(15).fill("x")),
    }).rows.length,
    50,
  );
  assert.equal(
    normalizeTableData({ rows: [Array(15).fill("x")] }).rows[0].length,
    12,
  );
});
test("native Table block persists in page/post details and renders through the shared content canvas", async () => {
  const table = node({
    rows: [
      ["Item", "Amount"],
      ["Sample", "10"],
    ],
  });
  const db = {
    prepare: () => ({
      bind: () => ({ first: async () => null }),
      first: async () => null,
    }),
  };
  const details = await validateDetails(db, { contentBlocks: [table] });
  assert.equal(details.contentBlocks[0].type, "core/table");
  const d = defaultTheme();
  const result = renderContentCanvas(d, {
    ...context,
    content: { ...context.content, details },
  });
  assert.match(result.html, /<table/);
  assert.match(result.html, /Sample/);
  assert.match(result.css, /nth-child\(odd\)/);
});
