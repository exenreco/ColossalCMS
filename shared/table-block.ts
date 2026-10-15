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
  return {
    rows,
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
  };
}
export type TableData = ReturnType<typeof normalizeTableData>;
