import { normalizeTableData } from "../shared/table-block.ts";
export function renderTableBlock(settings, id, esc, typographyAttributes) {
  const data = normalizeTableData(settings.tableData);
  const headerCount = data.headerRow ? 1 : 0;
  const footerIndex =
    data.footerRow && data.rows.length > headerCount
      ? data.rows.length - 1
      : -1;
  const row = (cells, index, section) =>
    "<tr>" +
    cells
      .map((text, column) => {
        const header =
          section === "head" || (data.headerColumn && column === 0);
        const tag = header ? "th" : "td";
        return `<${tag}${header ? ` scope="${section === "head" ? "col" : "row"}"` : ""}>${esc(text)}</${tag}>`;
      })
      .join("") +
    "</tr>";
  const caption = String(settings.caption || "").slice(0, 500);
  const head = data.headerRow
    ? `<thead>${row(data.rows[0], 0, "head")}</thead>`
    : "";
  const body = `<tbody>${data.rows.map((cells, index) => (index < headerCount || index === footerIndex ? "" : row(cells, index, "body"))).join("")}</tbody>`;
  const foot =
    footerIndex >= 0
      ? `<tfoot>${row(data.rows[footerIndex], footerIndex, "foot")}</tfoot>`
      : "";
  const html = `<div class="cl-table-scroll" tabindex="0" role="region" aria-label="${esc(caption || "Table")}"><table class="cl-data-table"${typographyAttributes(settings)}>${caption ? `<caption>${esc(caption)}</caption>` : ""}${head}${body}${foot}</table></div>`;
  const selector = /^[\w-]+$/.test(id)
    ? `[data-block-id="${id}"] .cl-data-table`
    : "";
  const css = selector
    ? `${selector}{width:100%;border-collapse:collapse;margin:0;table-layout:${data.fixedLayout ? "fixed" : "auto"};background:transparent}${selector} :is(th,td){font-family:inherit;font-size:inherit;line-height:inherit;letter-spacing:inherit;color:inherit;white-space:pre-wrap;overflow-wrap:anywhere;padding:${data.cellPadding}px;text-align:${data.align};vertical-align:${data.verticalAlign};border:${data.borders ? `${data.borderWidth}px ${data.borderStyle} ${data.borderColor}` : "0"}}${selector} thead th{background:${data.headerBackground};${data.headerColor ? `color:${data.headerColor};` : ""}font-weight:600}${selector} tbody tr:nth-child(odd)>:is(th,td){background:${data.striped ? data.oddColor : "transparent"}}${selector} tbody tr:nth-child(even)>:is(th,td){background:${data.striped ? data.evenColor : "transparent"}}${selector} tbody th{font-weight:600}${selector} tfoot :is(th,td){background:${data.footerBackground};font-weight:600}${selector} caption{text-align:${data.align};caption-side:top;padding:0 0 12px;font:inherit;color:inherit}`
    : "";
  return { html, css };
}
export const TABLE_BLOCK_CSS =
  ".theme-root .cl-table-scroll{width:100%;max-width:100%;overflow-x:auto}.theme-root .cl-table-scroll:focus-visible{outline:2px solid currentColor;outline-offset:3px}.theme-root .cl-data-table{min-width:min(100%,480px)}";
