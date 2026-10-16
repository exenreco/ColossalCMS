import type { BlockNode } from "./theme-models";
import {
  normalizeTableData,
  tableSection,
  insertTableTrack,
  removeTableTrack,
  // @ts-ignore Node server runtime requires the extension.
} from "./table-block.ts";

export const TABLE_SECTIONS = [
  "core/table-header",
  "core/table-body",
  "core/table-footer",
];
const structural = [...TABLE_SECTIONS, "core/table-row", "core/table-cell"];
export function tablePlacement(parent: string, child: string): boolean {
  if (parent === "core/table") return TABLE_SECTIONS.includes(child);
  if (TABLE_SECTIONS.includes(parent)) return child === "core/table-row";
  if (parent === "core/table-row") return child === "core/table-cell";
  return !structural.includes(child);
}
const make = (
  type: string,
  children: BlockNode[] = [],
  settings = {},
): BlockNode => ({
  id: "blk_" + crypto.randomUUID(),
  type,
  settings,
  children,
});
const paragraph = (text: string): BlockNode => ({
  id: "blk_" + crypto.randomUUID(),
  type: "core/paragraph",
  settings: {
    html: String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\n", "<br>"),
  },
});
export function tableRows(node: BlockNode) {
  return (node.children || []).flatMap((section) => section.children || []);
}
function plain(node: BlockNode): string {
  const own = String(node.settings["html"] ?? node.settings["text"] ?? "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
  return [own, ...(node.children || []).map(plain)].filter(Boolean).join("\n");
}
/** Native child blocks own cell content; tableData holds styling and grid geometry. */
export function tableTreeData(node: BlockNode) {
  if (!Array.isArray(node.children))
    return normalizeTableData(node.settings["tableData"]);
  const rows = tableRows(node);
  return normalizeTableData({
    ...node.settings["tableData"],
    sections: (node.children || []).flatMap((section) =>
      (section.children || []).map(() =>
        section.type === "core/table-header"
          ? "head"
          : section.type === "core/table-footer"
            ? "foot"
            : "body",
      ),
    ),
    rows: rows.length
      ? rows.map((row) => (row.children || []).map(plain))
      : [[""]],
    headerRow: node.children.some(
      (section) =>
        section.type === "core/table-header" && section.children?.length,
    ),
    footerRow: node.children.some(
      (section) =>
        section.type === "core/table-footer" && section.children?.length,
    ),
  });
}
export function migrateTable(node: BlockNode, depth = 0) {
  if (!node || depth > 32) return;
  if (node.type === "core/table" && !Array.isArray(node.children)) {
    const data = normalizeTableData(node.settings["tableData"]);
    node.children = [];
    for (const section of ["head", "body", "foot"]) {
      const rows = data.rows.flatMap((cells, row) =>
        tableSection(data, row) === section
          ? [
              make(
                "core/table-row",
                cells.map((text) => make("core/table-cell", [paragraph(text)])),
              ),
            ]
          : [],
      );
      if (rows.length)
        node.children.push(
          make(
            "core/table-" +
              { head: "header", body: "body", foot: "footer" }[section],
            rows,
          ),
        );
    }
  }
  if (Array.isArray(node.children))
    for (const child of node.children) migrateTable(child, depth + 1);
}
export function normalizeTableDocument(document: any) {
  for (const root of [
    ...Object.values(document.templates || {}),
    ...Object.values(document.parts || {}),
  ])
    migrateTable(root as BlockNode);
}
export function tableDefaultChildren(
  type: string,
  settings: any,
): BlockNode[] | undefined {
  if (type === "core/table") {
    const node = { type, settings } as BlockNode;
    migrateTable(node);
    return node.children;
  }
  if (TABLE_SECTIONS.includes(type))
    return [make("core/table-row", [make("core/table-cell", [paragraph("")])])];
  if (type === "core/table-row")
    return [make("core/table-cell", [paragraph("")])];
  if (type === "core/table-cell") return [paragraph("")];
  return undefined;
}
/** Resize/merge options preserve all native blocks, including temporarily covered cells. */
export function setTableTreeData(node: BlockNode, value: any) {
  migrateTable(node);
  const before = tableTreeData(node);
  const after = normalizeTableData({ ...before, ...value, rows: before.rows });
  if (
    before.headerRow === after.headerRow &&
    before.footerRow === after.footerRow
  ) {
    node.settings["tableData"] = after;
    return;
  }
  after.sections = [];
  const nextRows = tableRows(node);
  const oldSections = node.children || [];
  node.children = ["head", "body", "foot"].flatMap((section) => {
    const type =
      "core/table-" + { head: "header", body: "body", foot: "footer" }[section];
    const children = nextRows.filter(
      (_, r) => tableSection(after, r) === section,
    );
    if (!children.length) return [];
    const node = oldSections.find((s) => s.type === type) || make(type);
    node.children = children;
    return [node];
  });
  node.settings["tableData"] = after;
}

/** Explicit track operations retain identity even when adjacent rows/cells are identical. */
export function editTableTrack(
  node: BlockNode,
  axis: "row" | "column",
  index: number,
  remove = false,
) {
  const before = tableTreeData(node);
  const data = remove
    ? removeTableTrack(before, axis, index)
    : insertTableTrack(before, axis, index);
  if (
    data.rows.length === before.rows.length &&
    data.rows[0].length === before.rows[0].length
  )
    return;
  if (axis === "column") {
    for (const row of tableRows(node)) {
      if (remove) row.children!.splice(index, 1);
      else
        row.children!.splice(
          index,
          0,
          make("core/table-cell", [paragraph("")]),
        );
    }
  } else if (remove) {
    const row = tableRows(node)[index];
    for (const section of node.children || [])
      section.children = section.children!.filter((child) => child !== row);
  } else {
    let section = node.children?.find(
      (section) => section.type === "core/table-body",
    );
    if (!section) {
      section = make("core/table-body");
      node.children!.splice(
        node.children!.findIndex((s) => s.type === "core/table-footer") < 0
          ? node.children!.length
          : node.children!.findIndex((s) => s.type === "core/table-footer"),
        0,
        section,
      );
    }
    const allRows = tableRows(node);
    const localIndex = section.children!.findIndex(
      (row) => allRows.indexOf(row) >= index,
    );
    section.children!.splice(
      localIndex < 0 ? section.children!.length : localIndex,
      0,
      make(
        "core/table-row",
        Array.from({ length: before.rows[0].length }, () =>
          make("core/table-cell", [paragraph("")]),
        ),
      ),
    );
  }
  node.settings["tableData"] = data;
}

export function tableStructureError(node: BlockNode, depth = 0): string {
  if (depth > 32) return "This block layout is too complex.";
  if (!node || (node.children && !Array.isArray(node.children)))
    return "Invalid table block structure.";
  if (node.type === "core/table") {
    const rows = tableRows(node);
    if (
      rows.length > 50 ||
      rows.some((row) => (row.children?.length || 0) > 12)
    )
      return "Tables support up to 50 rows and 12 columns.";
    for (const type of ["core/table-header", "core/table-footer"])
      if (node.children!.filter((section) => section.type === type).length > 1)
        return "A table can have one Header and one Footer section.";
    if (
      node.children!.some(
        (section, index, all) =>
          (section.type === "core/table-header" && index !== 0) ||
          (section.type === "core/table-footer" && index !== all.length - 1),
      )
    )
      return "Place the Table Header first and the Table Footer last.";
  }
  for (const child of node.children || []) {
    if (!tablePlacement(node.type, child.type))
      return "Invalid table block placement. Use sections, rows, and cells.";
    const error = tableStructureError(child, depth + 1);
    if (error) return error;
  }
  return "";
}
