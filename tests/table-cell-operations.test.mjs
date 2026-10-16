import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTableData,
  mergeTableCells,
  splitTableCells,
  tableCellText,
  tableCellCovered,
  setTableCellText,
  insertTableTrack,
  removeTableTrack,
} from "../shared/table-block.ts";
import {
  defaultTheme,
  validateDocument,
  renderTheme,
} from "../server/theme-engine.mjs";
const data = () =>
  normalizeTableData({
    rows: [
      ["H1", "H2", "H3"],
      ["A", "B", "C"],
      ["D", "E", "F"],
      ["Total", "10", "20"],
    ],
    footerRow: true,
  });
const range = { startRow: 1, endRow: 2, startColumn: 0, endColumn: 1 };
test("rectangular merges preserve cell content for split and editing a merged cell replaces the combined content", () => {
  const original = data(),
    merged = mergeTableCells(original, range);
  assert.deepEqual(merged.rows, original.rows);
  assert.equal(tableCellText(merged, 1, 0), "A\nB\nD\nE");
  assert.equal(tableCellCovered(merged, 2, 1), true);
  assert.equal(tableCellCovered(merged, 1, 0), false);
  assert.deepEqual(
    splitTableCells(merged, {
      startRow: 2,
      endRow: 2,
      startColumn: 1,
      endColumn: 1,
    }).rows,
    original.rows,
  );
  const edited = setTableCellText(merged, 1, 0, "Replaced");
  assert.equal(tableCellText(edited, 1, 0), "Replaced");
  assert.deepEqual(splitTableCells(edited, range).rows.slice(1, 3), [
    ["Replaced", "", "C"],
    ["", "", "F"],
  ]);
  assert.equal(edited.merges.length, 1);
});
test("merges reject partial overlaps, invalid selections, and crossing header or footer boundaries", () => {
  for (const invalid of [
    { ...range, startRow: 0 },
    { ...range, endRow: 3 },
    { ...range, endRow: 99 },
    { ...range, startColumn: -1 },
    { startRow: 1, endRow: 1, startColumn: 0, endColumn: 0 },
  ])
    assert.throws(() => mergeTableCells(data(), invalid), /Select|Merge/);
  const merged = mergeTableCells(data(), range);
  assert.throws(
    () =>
      mergeTableCells(merged, {
        startRow: 1,
        endRow: 1,
        startColumn: 1,
        endColumn: 2,
      }),
    /entire merged/,
  );
  assert.equal(
    mergeTableCells(merged, { ...range, endColumn: 2 }).merges.length,
    1,
  );
  const safe = normalizeTableData({
    ...data(),
    merges: [
      { row: 1, column: 0, rowSpan: 2, colSpan: 2 },
      { row: 1, column: 1, rowSpan: 1, colSpan: 2 },
      { row: 0, column: 0, rowSpan: 2, colSpan: 1 },
      { row: 1, column: 2, rowSpan: 99, colSpan: 1 },
    ],
  });
  assert.deepEqual(safe.merges, [
    { row: 1, column: 0, rowSpan: 2, colSpan: 2 },
  ]);
});
test("row/column insertion and deletion keep merges and track sizes aligned", () => {
  const merged = mergeTableCells(
    { ...data(), columnWidths: [100, 200, 300], rowHeights: [40, 50, 60, 70] },
    range,
  );
  const inserted = insertTableTrack(merged, "row", 2);
  assert.equal(inserted.merges[0].rowSpan, 3);
  assert.deepEqual(inserted.rowHeights, [40, 50, 0, 60, 70]);
  const restored = removeTableTrack(inserted, "row", 2);
  assert.deepEqual(restored, merged);
  const column = insertTableTrack(merged, "column", 0);
  assert.equal(column.merges[0].column, 1);
  assert.deepEqual(column.columnWidths, [0, 100, 200, 300]);
  assert.deepEqual(removeTableTrack(column, "column", 0), merged);
  assert.equal(removeTableTrack(merged, "row", 1).merges[0].rowSpan, 1);
  assert.equal(
    normalizeTableData({
      columnWidths: [Infinity, -50, 5000],
      rowHeights: [5000, -5],
    }).columnWidths[2],
    1200,
  );
});
test("public table output retains real spans, logical coordinates, column widths and row heights", () => {
  const d = defaultTheme(),
    merged = mergeTableCells(
      {
        ...data(),
        columnWidths: [120, 180, 240],
        rowHeights: [40, 70, 80, 50],
      },
      range,
    );
  d.templates.default.children.splice(1, 0, {
    id: "blk_table_spans",
    type: "core/table",
    settings: { tableData: merged },
  });
  const result = renderTheme(
    validateDocument(d, true),
    {
      kind: "page",
      settings: {},
      content: { title: "Example", body: "" },
      allContent: [],
      media: [],
    },
    "default",
  );
  assert.match(
    result.html,
    /data-table-row="1" data-table-column="0" rowspan="2" colspan="2"/,
  );
  assert.match(result.html, /<col style="width:120px"/);
  assert.match(result.html, /<tr[^>]*style="[^"]*height:70px/);
  assert.doesNotMatch(result.html, /data-table-row="2" data-table-column="1"/);
  assert.match(result.css, /width:540px/);
  assert.doesNotMatch(
    result.html,
    /cl-table-resize|contenteditable|Merge cells/,
  );
});
