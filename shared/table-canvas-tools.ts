import { tableTreeData, setTableTreeData } from "./table-tree";
import type { ThemeEditorState } from "./theme-editor-state";
import {
  normalizeTableData,
  tableRange,
  tableMergeAt,
  type TableRange,
} from "./table-block";

export function installTableCanvasTools(
  table: HTMLTableElement,
  id: string,
  state: ThemeEditorState,
  options: {
    signal: AbortSignal;
    select: (id: string) => void;
    edited: () => void;
    resizing: (active: boolean) => void;
  },
) {
  const doc = table.ownerDocument;
  const read = () =>
    state.find(id)?.children
      ? tableTreeData(state.find(id)!)
      : normalizeTableData(state.find(id)?.settings["tableData"]);
  const commit = (data: ReturnType<typeof read>) => {
    const node = state.find(id);
    if (node?.type !== "core/table") return;
    state.commit(() => {
      if (node.children) setTableTreeData(node, data);
      else node.settings["tableData"] = data;
    });
    options.edited();
  };
  const selected = (): TableRange =>
    state.tableSelection()?.id === id
      ? state.tableSelection()!
      : { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 };
  doc.getElementById("cl-table-authoring-styles")?.remove();
  const style = doc.createElement("style");
  style.id = "cl-table-authoring-styles";
  style.textContent = `.cl-data-table :is(td,th){position:relative}.cl-table-cell-selected{box-shadow:inset 0 0 0 2px #56df95!important}.cl-table-resize{position:absolute;display:block;z-index:12;touch-action:none;user-select:none}.cl-table-resize-column{right:-4px;top:4px;bottom:4px;width:8px;cursor:col-resize}.cl-table-resize-row{bottom:-4px;left:4px;right:4px;height:8px;cursor:row-resize}.cl-table-resize:hover,.cl-table-resize:focus-visible{background:#56df9580;outline:1px solid #56df95}`;
  doc.head.append(style);
  table.parentElement
    ?.querySelector(":scope > .cl-table-canvas-tools")
    ?.remove();
  const highlight = () => {
    const range = tableRange(selected());
    for (const cell of Array.from(
      Array.from(
        table.querySelectorAll<HTMLTableCellElement>("[data-table-row]"),
      ).filter((cell) => cell.closest("table") === table),
    )) {
      const row = Number(cell.dataset["tableRow"]),
        column = Number(cell.dataset["tableColumn"]);
      cell.classList.toggle(
        "cl-table-cell-selected",
        row <= range.endRow &&
          row + cell.rowSpan - 1 >= range.startRow &&
          column <= range.endColumn &&
          column + cell.colSpan - 1 >= range.startColumn,
      );
    }
  };
  const choose = (cell: HTMLTableCellElement, extend: boolean) => {
    const row = Number(cell.dataset["tableRow"]),
      column = Number(cell.dataset["tableColumn"]),
      before = selected();
    state.tableSelection.set({
      id,
      startRow: extend ? before.startRow : row,
      startColumn: extend ? before.startColumn : column,
      endRow: row + cell.rowSpan - 1,
      endColumn: column + cell.colSpan - 1,
    });
    if (extend || !cell.hasAttribute("data-block-id")) options.select(id);
    highlight();
  };
  let activeCleanup: (() => void) | undefined;
  for (const cell of Array.from(
    Array.from(
      table.querySelectorAll<HTMLTableCellElement>("[data-table-row]"),
    ).filter((cell) => cell.closest("table") === table),
  )) {
    cell
      .querySelectorAll(".cl-table-resize")
      .forEach((handle) => handle.remove());
    cell.addEventListener(
      "pointerdown",
      (event) => {
        if ((event.target as Element).closest(".cl-table-resize")) return;
        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          doc.getSelection()?.removeAllRanges();
        }
        choose(cell, event.shiftKey);
      },
      { signal: options.signal },
    );
    cell.addEventListener(
      "focus",
      () => {
        choose(cell, false);
      },
      { signal: options.signal },
    );
    for (const axis of ["column", "row"] as const) {
      const index =
        Number(cell.dataset[axis === "column" ? "tableColumn" : "tableRow"]) +
        (axis === "column" ? cell.colSpan : cell.rowSpan) -
        1;
      const handle = doc.createElement("span");
      handle.contentEditable = "false";
      handle.tabIndex = 0;
      handle.className = `cl-table-resize cl-table-resize-${axis}`;
      handle.setAttribute("role", "separator");
      handle.setAttribute(
        "aria-orientation",
        axis === "column" ? "vertical" : "horizontal",
      );
      handle.setAttribute("aria-label", `Resize ${axis} ${index + 1}`);
      const measured = () =>
        axis === "column"
          ? Array.from(table.querySelectorAll("col")).map((c) =>
              Math.max(40, Math.round(c.getBoundingClientRect().width)),
            )
          : Array.from(table.rows).map((r) =>
              Math.max(24, Math.round(r.getBoundingClientRect().height)),
            );
      handle.setAttribute("aria-valuemin", axis === "column" ? "40" : "24");
      handle.setAttribute("aria-valuemax", axis === "column" ? "1200" : "800");
      handle.setAttribute("aria-valuenow", String(measured()[index]));
      handle.addEventListener(
        "keydown",
        (event) => {
          const positive = axis === "column" ? "ArrowRight" : "ArrowDown",
            negative = axis === "column" ? "ArrowLeft" : "ArrowUp";
          if (![positive, negative].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const data = read();
          const values = measured();
          values[index] = Math.min(
            axis === "column" ? 1200 : 800,
            Math.max(
              axis === "column" ? 40 : 24,
              values[index] + (event.key === positive ? 10 : -10),
            ),
          );
          if (axis === "column") {
            data.columnWidths = values;
            data.fixedLayout = false;
          } else data.rowHeights = values;
          commit(normalizeTableData(data));
        },
        { signal: options.signal },
      );
      handle.addEventListener(
        "pointerdown",
        (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (event.button !== 0) return;
          activeCleanup?.();
          options.resizing(true);
          (doc.activeElement as HTMLElement)?.blur();
          const data = read(),
            values = measured(),
            initial = values[index],
            start = axis === "column" ? event.clientX : event.clientY;
          const elements =
            axis === "column"
              ? Array.from(table.querySelectorAll<HTMLElement>("col"))
              : Array.from(table.rows);
          const original = elements.map((el) => el.getAttribute("style")),
            tableStyle = table.getAttribute("style");
          const controller = new AbortController();
          handle.setPointerCapture(event.pointerId);
          const restore = () => {
            elements.forEach((el, i) =>
              original[i] === null
                ? el.removeAttribute("style")
                : el.setAttribute("style", original[i]!),
            );
            tableStyle === null
              ? table.removeAttribute("style")
              : table.setAttribute("style", tableStyle);
          };
          const finish = (save: boolean) => {
            controller.abort();
            activeCleanup = undefined;
            options.resizing(false);
            if (handle.hasPointerCapture(event.pointerId))
              handle.releasePointerCapture(event.pointerId);
            if (!save) {
              restore();
              if (!options.signal.aborted) options.edited();
              return;
            }
            if (values[index] === initial) {
              restore();
              return;
            }
            if (axis === "column") {
              data.columnWidths = values;
              data.fixedLayout = false;
            } else data.rowHeights = values;
            commit(normalizeTableData(data));
          };
          activeCleanup = () => finish(false);
          doc.addEventListener(
            "pointermove",
            (move) => {
              values[index] = Math.round(
                Math.min(
                  axis === "column" ? 1200 : 800,
                  Math.max(
                    axis === "column" ? 40 : 24,
                    initial +
                      (axis === "column" ? move.clientX : move.clientY) -
                      start,
                  ),
                ),
              );
              if (axis === "column") {
                elements.forEach(
                  (el, i) => (el.style.width = values[i] + "px"),
                );
                table.style.width =
                  values.reduce((sum, w) => sum + w, 0) + "px";
                table.style.tableLayout = "fixed";
              } else elements[index].style.height = values[index] + "px";
            },
            { signal: controller.signal },
          );
          doc.addEventListener("pointerup", () => finish(true), {
            once: true,
            signal: controller.signal,
          });
          doc.addEventListener("pointercancel", () => finish(false), {
            once: true,
            signal: controller.signal,
          });
          doc.addEventListener(
            "keydown",
            (key) => {
              if (key.key === "Escape") {
                key.preventDefault();
                key.stopPropagation();
                finish(false);
              }
            },
            { signal: controller.signal },
          );
        },
        { signal: options.signal },
      );
      cell.append(handle);
    }
  }
  options.signal.addEventListener("abort", () => activeCleanup?.(), {
    once: true,
  });
  highlight();
}
