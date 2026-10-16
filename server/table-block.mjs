import {
  normalizeTableData,
  tableCellCovered,
  tableMergeAt,
  tableCellText,
} from "../shared/table-block.ts";
import { tableTreeData, tableRows } from "../shared/table-tree.ts";
export function renderTableBlock(
  settings,
  id,
  esc,
  typographyAttributes,
  node,
  compile,
  styleSettings = () => "",
) {
  const native = Array.isArray(node?.children);
  const data = native
    ? tableTreeData(node)
    : normalizeTableData(settings.tableData);
  const nativeRows = native ? tableRows(node) : [];
  const attributes = (block, extraStyle = "") =>
    block
      ? ` style="${esc(styleSettings(block.settings || {}))}${extraStyle}" data-block-id="${esc(block.id)}"${block._sourceId ? ` data-source-block-id="${esc(block._sourceId)}"` : ""} class="theme-block ${esc(String(block.settings?.classes || "").replace(/[^\w\s-]/g, ""))}"`
      : "";
  const cellContent = (r, c) =>
    (nativeRows[r]?.children?.[c]?.children || []).map(compile).join("");
  const headerCount = data.headerRow ? 1 : 0;
  const footerIndex =
    data.footerRow && data.rows.length > headerCount
      ? data.rows.length - 1
      : -1;
  const row = (cells, index, section) =>
    `<tr${native ? attributes(nativeRows[index], data.rowHeights[index] ? `;height:${data.rowHeights[index]}px` : "") : data.rowHeights[index] ? ` style="height:${data.rowHeights[index]}px"` : ""}>` +
    (native ? cells.slice(0, nativeRows[index]?.children?.length || 0) : cells)
      .map((text, column) => {
        if (tableCellCovered(data, index, column)) return "";
        const merge = tableMergeAt(data, index, column);
        const cellSettings =
          nativeRows[index]?.children?.[column]?.settings || {};
        const header =
          cellSettings.cellType === "header" ||
          (cellSettings.cellType !== "data" &&
            (section === "head" || (data.headerColumn && column === 0)));
        const scope =
          cellSettings.scope === "column"
            ? "col"
            : cellSettings.scope === "row"
              ? "row"
              : section === "head"
                ? "col"
                : "row";
        const tag = header ? "th" : "td";
        let content = native
          ? cellContent(index, column)
          : esc(tableCellText(data, index, column));
        if (native && merge) {
          content = "";
          for (let r = index; r < index + merge.rowSpan; r++)
            for (let c = column; c < column + merge.colSpan; c++)
              content += cellContent(r, c);
        }
        return `<${tag}${attributes(nativeRows[index]?.children?.[column])} data-table-row="${index}" data-table-column="${column}"${merge ? ` rowspan="${merge.rowSpan}" colspan="${merge.colSpan}"` : ""}${header ? ` scope="${scope}"` : ""}>${content}</${tag}>`;
      })
      .join("") +
    "</tr>";
  const caption = String(settings.caption || "").slice(0, 500);
  let head =
    !native && data.headerRow
      ? `<thead>${row(data.rows[0], 0, "head")}</thead>`
      : "";
  let body = native
    ? ""
    : `<tbody>${data.rows.map((cells, index) => (index < headerCount || index === footerIndex ? "" : row(cells, index, "body"))).join("")}</tbody>`;
  let foot =
    !native && footerIndex >= 0
      ? `<tfoot>${row(data.rows[footerIndex], footerIndex, "foot")}</tfoot>`
      : "";
  if (native) {
    let index = 0;
    const sections = node.children
      .map((section) => {
        const tag =
          section.type === "core/table-header"
            ? "thead"
            : section.type === "core/table-footer"
              ? "tfoot"
              : "tbody";
        return `<${tag}${attributes(section)}>${(section.children || [])
          .map(() => {
            const r = index++;
            return row(
              data.rows[r] || [""],
              r,
              tag === "thead" ? "head" : tag === "tfoot" ? "foot" : "body",
            );
          })
          .join("")}</${tag}>`;
      })
      .join("");
    head = sections;
    body = "";
    foot = "";
  }
  const cols = `<colgroup>${data.columnWidths.map((width) => `<col${width ? ` style="width:${width}px"` : ""}>`).join("")}</colgroup>`;
  const html = `<div class="cl-table-scroll" tabindex="0" role="region" aria-label="${esc(caption || "Table")}"><table class="cl-data-table"${typographyAttributes(settings)}>${caption ? `<caption>${esc(caption)}</caption>` : ""}${cols}${head}${body}${foot}</table></div>`;
  const selector = /^[\w-]+$/.test(id)
    ? `[data-block-id="${id}"] .cl-data-table`
    : "";
  const sized = data.columnWidths.some(Boolean);
  const width = sized
    ? data.columnWidths.reduce((total, w) => total + (w || 100), 0) + "px"
    : "100%";
  const css = selector
    ? `${selector}{width:${width};min-width:${data.rows[0].length * 60}px;border-collapse:collapse;margin:0;table-layout:${data.fixedLayout || sized ? "fixed" : "auto"};background:transparent}${selector} :is(th,td){font-family:inherit;font-size:inherit;line-height:inherit;letter-spacing:inherit;color:inherit;white-space:pre-wrap;overflow-wrap:anywhere;padding:${data.cellPadding}px;text-align:${data.align};vertical-align:${data.verticalAlign};border:${data.borders ? `${data.borderWidth}px ${data.borderStyle} ${data.borderColor}` : "0"}}${selector} thead th{background:${data.headerBackground};${data.headerColor ? `color:${data.headerColor};` : ""}font-weight:600}${selector} tbody tr:nth-child(odd)>:is(th,td){background:${data.striped ? data.oddColor : "transparent"}}${selector} tbody tr:nth-child(even)>:is(th,td){background:${data.striped ? data.evenColor : "transparent"}}${selector} tbody th{font-weight:600}${selector} tfoot :is(th,td){background:${data.footerBackground};font-weight:600}${selector} caption{text-align:${data.align};caption-side:top;padding:0 0 12px;font:inherit;color:inherit}`
    : "";
  return { html, css };
}
export const TABLE_BLOCK_CSS =
  ".theme-root .cl-table-scroll{width:100%;max-width:100%;overflow-x:auto}.theme-root .cl-table-scroll:focus-visible{outline:2px solid currentColor;outline-offset:3px}.theme-root .cl-data-table{min-width:min(100%,480px)}";
