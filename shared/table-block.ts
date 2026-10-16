export const DEFAULT_TABLE_DATA = {
  rows: [
    ["Header 1", "Header 2", "Header 3"],
    ["Cell 1", "Cell 2", "Cell 3"],
    ["Cell 4", "Cell 5", "Cell 6"],
  ],
  headerRow: true,
  headerColumn: false,
  footerRow: false,
  striped: true,
  headerBackground: "#80808020",
  headerColor: "",
  oddColor: "#8080800d",
  evenColor: "#80808000",
  footerBackground: "#80808020",
  borderColor: "#80808040",
  borders: true,
  borderWidth: 1,
  borderStyle: "solid",
  cellPadding: 12,
  align: "left",
  verticalAlign: "top",
  fixedLayout: false,
};
const color = (value: unknown, fallback: string) =>
  typeof value === "string" &&
  /^#(?:[a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/i.test(value)
    ? value
    : fallback;
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  Number.isFinite(Number(value))
    ? Math.min(max, Math.max(min, Number(value)))
    : fallback;
export interface TableMerge {
  row: number;
  column: number;
  rowSpan: number;
  colSpan: number;
}
export interface TableRange {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}
export function tableSection(
  data: {
    headerRow: boolean;
    footerRow: boolean;
    rows: string[][];
    sections?: string[];
  },
  row: number,
) {
  if (data.sections?.[row]) return data.sections[row];
  return data.headerRow && row === 0
    ? "head"
    : data.footerRow && row === data.rows.length - 1
      ? "foot"
      : "body";
}
export function normalizeTableData(value: any) {
  const source = value && typeof value === "object" ? value : {};
  const rawRows =
    Array.isArray(source.rows) && source.rows.length
      ? source.rows
      : DEFAULT_TABLE_DATA.rows;
  const width = Math.min(
    12,
    Math.max(
      1,
      ...rawRows
        .slice(0, 50)
        .map((row: unknown) => (Array.isArray(row) ? row.length : 1)),
    ),
  );
  const rows: string[][] = rawRows
    .slice(0, 50)
    .map((row: unknown) =>
      Array.from({ length: width }, (_, index) =>
        String(Array.isArray(row) ? (row[index] ?? "") : "").slice(0, 1000),
      ),
    );
  const result = {
    rows,
    sections: Array.isArray(source.sections)
      ? source.sections
          .slice(0, rows.length)
          .map((value: unknown) =>
            ["head", "body", "foot"].includes(String(value))
              ? String(value)
              : "body",
          )
      : [],
    headerRow: source.headerRow !== false,
    headerColumn: source.headerColumn === true,
    footerRow: source.footerRow === true,
    striped: source.striped !== false,
    headerBackground: color(
      source.headerBackground,
      DEFAULT_TABLE_DATA.headerBackground,
    ),
    headerColor: color(source.headerColor, ""),
    oddColor: color(source.oddColor, DEFAULT_TABLE_DATA.oddColor),
    evenColor: color(source.evenColor, DEFAULT_TABLE_DATA.evenColor),
    footerBackground: color(
      source.footerBackground,
      DEFAULT_TABLE_DATA.footerBackground,
    ),
    borderColor: color(source.borderColor, DEFAULT_TABLE_DATA.borderColor),
    borders: source.borders !== false,
    borderWidth: bounded(source.borderWidth, 1, 0, 8),
    borderStyle: ["solid", "dashed", "dotted"].includes(source.borderStyle)
      ? (source.borderStyle as string)
      : "solid",
    cellPadding: bounded(source.cellPadding, 12, 0, 48),
    align: ["left", "center", "right"].includes(source.align)
      ? (source.align as string)
      : "left",
    verticalAlign: ["top", "middle", "bottom"].includes(source.verticalAlign)
      ? (source.verticalAlign as string)
      : "top",
    fixedLayout: source.fixedLayout === true,
    columnWidths: Array.from({ length: width }, (_, index) =>
      source.columnWidths?.[index]
        ? Math.round(bounded(source.columnWidths[index], 0, 40, 1200))
        : 0,
    ),
    rowHeights: rows.map((_, index) =>
      source.rowHeights?.[index]
        ? Math.round(bounded(source.rowHeights[index], 0, 24, 800))
        : 0,
    ),
    merges: [] as TableMerge[],
  };
  for (const candidate of Array.isArray(source.merges)
    ? source.merges.slice(0, 600)
    : []) {
    if (
      !candidate ||
      ![
        candidate.row,
        candidate.column,
        candidate.rowSpan,
        candidate.colSpan,
      ].every(Number.isInteger)
    )
      continue;
    const { row, column, rowSpan, colSpan } = candidate;
    if (
      row < 0 ||
      column < 0 ||
      rowSpan < 1 ||
      colSpan < 1 ||
      row + rowSpan > rows.length ||
      column + colSpan > width ||
      rowSpan * colSpan < 2
    )
      continue;
    if (tableSection(result, row) !== tableSection(result, row + rowSpan - 1))
      continue;
    if (
      result.merges.some(
        (m) =>
          row < m.row + m.rowSpan &&
          row + rowSpan > m.row &&
          column < m.column + m.colSpan &&
          column + colSpan > m.column,
      )
    )
      continue;
    result.merges.push({ row, column, rowSpan, colSpan });
  }
  return result;
}
export type TableData = ReturnType<typeof normalizeTableData>;
export function tableMergeAt(data: TableData, row: number, column: number) {
  return data.merges.find(
    (m) =>
      row >= m.row &&
      row < m.row + m.rowSpan &&
      column >= m.column &&
      column < m.column + m.colSpan,
  );
}
export function tableCellCovered(data: TableData, row: number, column: number) {
  const merge = tableMergeAt(data, row, column);
  return !!merge && (merge.row !== row || merge.column !== column);
}
export function tableCellText(data: TableData, row: number, column: number) {
  const merge = tableMergeAt(data, row, column);
  if (!merge) return data.rows[row]?.[column] || "";
  return data.rows
    .slice(merge.row, merge.row + merge.rowSpan)
    .flatMap((r) => r.slice(merge.column, merge.column + merge.colSpan))
    .filter(Boolean)
    .join("\n");
}
export function setTableCellText(
  value: unknown,
  row: number,
  column: number,
  text: string,
) {
  const data = normalizeTableData(value),
    merge = tableMergeAt(data, row, column);
  if (!data.rows[row] || column < 0 || column >= data.rows[row].length)
    return data;
  if (merge) {
    for (let r = merge.row; r < merge.row + merge.rowSpan; r++)
      for (let c = merge.column; c < merge.column + merge.colSpan; c++)
        data.rows[r][c] = "";
    row = merge.row;
    column = merge.column;
  }
  data.rows[row][column] = text.slice(0, 1000);
  return data;
}
export function tableRange(range: TableRange): TableRange {
  return {
    startRow: Math.min(range.startRow, range.endRow),
    endRow: Math.max(range.startRow, range.endRow),
    startColumn: Math.min(range.startColumn, range.endColumn),
    endColumn: Math.max(range.startColumn, range.endColumn),
  };
}
export function mergeTableCells(value: unknown, range: TableRange) {
  const data = normalizeTableData(value),
    r = tableRange(range);
  if (
    !Object.values(r).every(Number.isInteger) ||
    r.startRow < 0 ||
    r.startColumn < 0 ||
    r.endRow >= data.rows.length ||
    r.endColumn >= data.rows[0].length
  )
    throw Error("Select cells inside the table.");
  if (r.startRow === r.endRow && r.startColumn === r.endColumn)
    throw Error("Select at least two cells to merge.");
  if (tableSection(data, r.startRow) !== tableSection(data, r.endRow))
    throw Error("Merge cells within the same header, body or footer section.");
  for (const m of data.merges) {
    const intersects =
      m.row <= r.endRow &&
      m.row + m.rowSpan > r.startRow &&
      m.column <= r.endColumn &&
      m.column + m.colSpan > r.startColumn;
    if (
      intersects &&
      !(
        m.row >= r.startRow &&
        m.row + m.rowSpan - 1 <= r.endRow &&
        m.column >= r.startColumn &&
        m.column + m.colSpan - 1 <= r.endColumn
      )
    )
      throw Error("Select the entire merged cell before merging again.");
  }
  data.merges = data.merges.filter(
    (m) =>
      !(
        m.row >= r.startRow &&
        m.row <= r.endRow &&
        m.column >= r.startColumn &&
        m.column <= r.endColumn
      ),
  );
  data.merges.push({
    row: r.startRow,
    column: r.startColumn,
    rowSpan: r.endRow - r.startRow + 1,
    colSpan: r.endColumn - r.startColumn + 1,
  });
  return data;
}
export function splitTableCells(value: unknown, range: TableRange) {
  const data = normalizeTableData(value),
    r = tableRange(range);
  data.merges = data.merges.filter(
    (m) =>
      !(
        m.row <= r.endRow &&
        m.row + m.rowSpan > r.startRow &&
        m.column <= r.endColumn &&
        m.column + m.colSpan > r.startColumn
      ),
  );
  return data;
}
export function insertTableTrack(
  value: unknown,
  axis: "row" | "column",
  index: number,
) {
  const d = normalizeTableData(value),
    row = axis === "row",
    length = row ? d.rows.length : d.rows[0].length;
  index = Math.max(0, Math.min(length, index));
  if (length >= (row ? 50 : 12)) return d;
  if (row) {
    d.rows.splice(index, 0, Array(d.rows[0].length).fill(""));
    d.rowHeights.splice(index, 0, 0);
  } else {
    d.rows.forEach((r) => r.splice(index, 0, ""));
    d.columnWidths.splice(index, 0, 0);
  }
  for (const m of d.merges) {
    const start = row ? m.row : m.column,
      span = row ? m.rowSpan : m.colSpan;
    if (index <= start) {
      if (row) m.row++;
      else m.column++;
    } else if (index < start + span) {
      if (row) m.rowSpan++;
      else m.colSpan++;
    }
  }
  return normalizeTableData(d);
}
export function removeTableTrack(
  value: unknown,
  axis: "row" | "column",
  index: number,
) {
  const d = normalizeTableData(value),
    row = axis === "row",
    length = row ? d.rows.length : d.rows[0].length;
  if (length <= 1 || index < 0 || index >= length) return d;
  if (row) {
    d.rows.splice(index, 1);
    d.rowHeights.splice(index, 1);
  } else {
    d.rows.forEach((r) => r.splice(index, 1));
    d.columnWidths.splice(index, 1);
  }
  d.merges = d.merges.filter((m) => {
    const start = row ? m.row : m.column,
      span = row ? m.rowSpan : m.colSpan;
    if (index < start) {
      if (row) m.row--;
      else m.column--;
    } else if (index < start + span) {
      if (span === 1) return false;
      if (row) m.rowSpan--;
      else m.colSpan--;
    }
    return true;
  });
  return normalizeTableData(d);
}
