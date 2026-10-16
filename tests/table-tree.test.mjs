import test from "node:test";
import assert from "node:assert/strict";
import { parseDocument } from "htmlparser2";
import { findAll, textContent } from "domutils";
import {
  defaultTheme,
  validateDocument,
  renderTheme,
} from "../server/theme-engine.mjs";
import { validateDetails } from "../server/v2-utils.mjs";
import {
  migrateTable,
  tableRows,
  tableTreeData,
  setTableTreeData,
  editTableTrack,
  tableDefaultChildren,
} from "../shared/table-tree.ts";
import { mergeTableCells, splitTableCells } from "../shared/table-block.ts";
import { applyOutlineCommand } from "../shared/outline-document.ts";
import { readFileSync } from "node:fs";
const definitions = JSON.parse(
  readFileSync(new URL("../shared/theme-blocks.json", import.meta.url)),
);
const block = (type, settings = {}, children) => ({
  id: "blk_" + crypto.randomUUID(),
  type,
  settings,
  ...(children ? { children } : {}),
});
const paragraph = (text) => block("core/paragraph", { html: text });
const cell = (children) => block("core/table-cell", {}, children);
const row = (cells) => block("core/table-row", {}, cells);
function fixture() {
  return block(
    "core/table",
    {
      tableData: {
        headerRow: true,
        columnWidths: [240, 320],
        rowHeights: [50, 90, 80],
      },
    },
    [
      block("core/table-header", {}, [
        row([cell([paragraph("Name")]), cell([paragraph("Details")])]),
      ]),
      block("core/table-body", {}, [
        row([
          cell([
            block("core/heading", { text: "Project", level: "h3" }),
            block("core/button", { text: "Visit", href: "/about" }),
          ]),
          cell([
            paragraph("Native content"),
            block("core/image", { mediaId: "sample-image", alt: "Sample" }),
          ]),
        ]),
        row([cell([paragraph("Another")]), cell([paragraph("Second row")])]),
      ]),
    ],
  );
}
function render(table) {
  const doc = defaultTheme();
  doc.templates.default.children.splice(1, 0, table);
  return renderTheme(
    validateDocument(doc, true),
    {
      kind: "page",
      content: { title: "Example", details: {} },
      settings: {},
      allContent: [],
      media: [
        {
          id: "sample-image",
          type: "image",
          url: "/sample.png",
          name: "Sample",
        },
      ],
    },
    "default",
  );
}
test("native table children render semantic sections/rows/cells with independently selectable nested blocks", () => {
  const table = fixture(),
    result = render(table),
    tree = parseDocument(result.html);
  const elements = findAll(
    (n) => ["thead", "tbody", "tr", "th", "td"].includes(n.name),
    tree.children,
  );
  assert.ok(elements.every((n) => n.attribs["data-block-id"]));
  assert.equal(elements.filter((n) => n.name === "tr").length, 3);
  assert.ok(
    findAll((n) => n.name === "h3", tree.children).some(
      (n) => textContent(n) === "Project",
    ),
  );
  assert.match(result.html, /Visit/);
  assert.match(result.html, /Native content/);
  assert.ok(
    findAll((n) => n.name === "td", tree.children).some(
      (n) => findAll((c) => c.name === "img", n.children).length,
    ),
  );
  assert.ok(
    elements
      .filter((n) => n.name === "tr")
      .every((n) =>
        n.children
          .filter((c) => c.type === "tag")
          .every((c) => ["th", "td"].includes(c.name)),
      ),
  );
});
test("legacy tables migrate once, preserving literal text, sizing and merge geometry", () => {
  const table = block("core/table", {
    tableData: {
      rows: [
        ["Head", "Other"],
        ["<unsafe>", "B"],
      ],
      columnWidths: [160, 220],
      rowHeights: [45, 75],
      merges: [{ row: 1, column: 0, rowSpan: 1, colSpan: 2 }],
    },
  });
  migrateTable(table);
  const snapshot = structuredClone(table);
  migrateTable(table);
  assert.deepEqual(table, snapshot);
  assert.equal(tableTreeData(table).rows[1][0], "<unsafe>");
  assert.deepEqual(tableTreeData(table).columnWidths, [160, 220]);
  assert.equal(tableTreeData(table).merges.length, 1);
  assert.match(render(table).html, /&lt;unsafe&gt;/);
});
test("resize, merge and split retain every nested block and cell identity", () => {
  const table = fixture(),
    children = structuredClone(table.children);
  let data = tableTreeData(table);
  data.columnWidths[0] = 380;
  setTableTreeData(table, data);
  data = mergeTableCells(tableTreeData(table), {
    startRow: 1,
    endRow: 2,
    startColumn: 0,
    endColumn: 1,
  });
  setTableTreeData(table, data);
  const result = render(table);
  assert.match(result.html, /rowspan="2" colspan="2"/);
  assert.match(result.html, /Second row/);
  assert.match(result.html, /Visit/);
  setTableTreeData(
    table,
    splitTableCells(tableTreeData(table), {
      startRow: 1,
      endRow: 2,
      startColumn: 0,
      endColumn: 1,
    }),
  );
  assert.deepEqual(table.children, children);
  assert.equal(tableTreeData(table).columnWidths[0], 380);
});
test("track operations preserve arbitrary inner blocks even when text summaries are identical", () => {
  const table = fixture(),
    cells = tableRows(table)[1].children;
  cells[0].children = [block("core/icon", { iconName: "star" })];
  cells[1].children = [block("core/icon", { iconName: "github" })];
  const preserved = structuredClone(cells[1]);
  editTableTrack(table, "column", 0, true);
  assert.deepEqual(tableRows(table)[1].children[0], preserved);
  editTableTrack(table, "column", 0);
  assert.deepEqual(tableRows(table)[1].children[1], preserved);
  const originalRow = structuredClone(tableRows(table)[2]);
  editTableTrack(table, "row", 2);
  assert.deepEqual(tableRows(table)[3], originalRow);
  editTableTrack(table, "row", 2, true);
  assert.deepEqual(tableRows(table)[2], originalRow);
});
test("header sections support multiple rows and preserve them through sizing changes", () => {
  const table = fixture();
  table.children[0].children.push(
    row([cell([paragraph("Subheading")]), cell([paragraph("Value")])]),
  );
  const data = tableTreeData(table);
  assert.deepEqual(data.sections, ["head", "head", "body", "body"]);
  const merged = mergeTableCells(data, {
    startRow: 0,
    endRow: 1,
    startColumn: 0,
    endColumn: 0,
  });
  setTableTreeData(table, merged);
  assert.equal(table.children[0].children.length, 2);
  assert.match(render(table).html, /rowspan="2"/);
  assert.throws(
    () =>
      mergeTableCells(tableTreeData(table), {
        startRow: 1,
        endRow: 2,
        startColumn: 0,
        endColumn: 0,
      }),
    /section|header|footer/i,
  );
});
test("editor commands create table subtrees and permit cell children while rejecting invalid placements", () => {
  const root = block("core/container", {}, []);
  applyOutlineCommand(
    root,
    { type: "insert", parentId: root.id, index: 0, blockType: "core/table" },
    definitions,
  );
  const table = root.children[0];
  assert.ok(table.children?.length);
  const cell = tableRows(table)[1].children[0];
  applyOutlineCommand(
    root,
    { type: "insert", parentId: cell.id, index: 1, blockType: "core/button" },
    definitions,
  );
  assert.equal(cell.children[1].type, "core/button");
  assert.throws(
    () =>
      applyOutlineCommand(
        root,
        {
          type: "insert",
          parentId: table.id,
          index: 0,
          blockType: "core/paragraph",
        },
        definitions,
      ),
    /accept|nest|destination|placed/i,
  );
  assert.throws(
    () =>
      applyOutlineCommand(
        root,
        {
          type: "insert",
          parentId: root.id,
          index: 0,
          blockType: "core/table-cell",
        },
        definitions,
      ),
    /accept|nest|destination|placed/i,
  );
});
test("theme and content validation enforce table structure and preserve native content", async () => {
  const table = fixture();
  const db = {
    prepare: () => ({
      bind: () => ({ first: async () => ({ type: "image" }) }),
      first: async () => ({ type: "image" }),
    }),
  };
  const details = await validateDetails(db, { contentBlocks: [table] });
  assert.deepEqual(details.contentBlocks[0].children, table.children);
  const invalid = fixture();
  invalid.children[1].children[0].children.push(paragraph("Invalid cell"));
  assert.throws(() => render(invalid), /table block placement/i);
  await assert.rejects(
    () => validateDetails(db, { contentBlocks: [invalid] }),
    /table block placement/i,
  );
  const large = fixture();
  large.children[1].children[0].children = Array.from({ length: 13 }, () =>
    cell([paragraph("x")]),
  );
  assert.throws(() => render(large), /12 columns/);
});

test("outline insertion accepts legacy table settings and initializes the requested child content", () => {
  const root = block("core/container", {}, []);
  applyOutlineCommand(
    root,
    {
      type: "insert",
      parentId: root.id,
      index: 0,
      blockType: "core/table",
      settings: { tableData: { rows: [["Custom", "Grid"]], headerRow: false } },
    },
    definitions,
  );
  assert.deepEqual(tableTreeData(root.children[0]).rows, [["Custom", "Grid"]]);
});
