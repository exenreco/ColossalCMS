import { tableTreeData, tableRows, editTableTrack } from "./table-tree";
import {
  Component,
  EventEmitter,
  input,
  computed,
  Output,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ColorPickerComponent } from "./pickers/color-picker.component";
import {
  normalizeTableData,
  TableData,
  type TableRange,
  tableRange,
  tableMergeAt,
  tableCellCovered,
  tableCellText,
  setTableCellText,
  mergeTableCells,
  splitTableCells,
  insertTableTrack,
  removeTableTrack,
} from "./table-block";
import { ThemeEditorState } from "./theme-editor-state";
@Component({
  selector: "cl-table-settings",
  standalone: true,
  imports: [FormsModule, ColorPickerComponent],
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .table-controls {
      display: grid;
      gap: 14px;
    }
    .table-controls label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
    }
    .table-controls input[type="checkbox"] {
      width: auto;
      margin: 0;
    }
    .table-controls input[type="number"],
    .table-controls select {
      width: 110px;
    }
    .table-check {
      justify-content: flex-start !important;
    }
    .table-grid {
      max-width: 100%;
      overflow: auto;
      max-height: 380px;
    }
    .table-grid table {
      border-collapse: collapse;
      width: 100%;
      font-size: 12px;
    }
    .table-grid td,
    .table-grid th {
      padding: 3px !important;
      border: 1px solid var(--cl-editor-border, #414141);
    }
    .table-grid textarea {
      min-width: 100px;
      width: 100%;
      height: 58px;
      resize: vertical;
      font: inherit;
    }
    .table-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .table-buttons button,
    .table-grid button {
      font: inherit;
      padding: 5px 8px;
      background: var(--cl-editor-control, #303030);
      color: inherit;
      border: 1px solid var(--cl-editor-border, #555);
      border-radius: 4px;
      cursor: pointer;
    }
    .table-grid th button {
      padding: 4px;
    }
    .table-grid td.selected {
      outline: 2px solid #56df95;
      outline-offset: -2px;
    }
    .table-section {
      border-top: 1px solid var(--cl-editor-border, #444);
      padding-top: 14px;
      margin-top: 4px;
    }
    .table-error {
      font-size: 12px;
      color: #e37171;
    }
    cl-color-picker {
      display: block;
    }
  `,
  template: `<div class="table-controls">
    <p class="field-note">
      Shift-click cells to select a range, then merge or split. Drag cell
      borders in the canvas to resize columns and rows.
    </p>
    <div class="table-buttons">
      <button
        type="button"
        [disabled]="data.rows.length >= 50"
        (click)="addRow()"
      >
        + Row</button
      ><button
        type="button"
        [disabled]="data.rows[0].length >= 12"
        (click)="addColumn()"
      >
        + Column
      </button>
    </div>
    @if (error) {
      <p class="table-error" role="alert">{{ error }}</p>
    }
    <div class="table-buttons">
      <button type="button" (click)="merge()">Merge cells</button
      ><button type="button" (click)="split()">Split cell</button
      ><button type="button" (click)="resetSizes()">Reset sizes</button>
    </div>
    <label
      >Start row<input
        aria-label="Selection start row"
        type="number"
        min="1"
        [max]="data.rows.length"
        [ngModel]="range.startRow + 1"
        (ngModelChange)="setRange('startRow', $event)"
    /></label>
    <label
      >End row<input
        aria-label="Selection end row"
        type="number"
        min="1"
        [max]="data.rows.length"
        [ngModel]="range.endRow + 1"
        (ngModelChange)="setRange('endRow', $event)"
    /></label>
    <label
      >Start column<input
        aria-label="Selection start column"
        type="number"
        min="1"
        [max]="data.rows[0].length"
        [ngModel]="range.startColumn + 1"
        (ngModelChange)="setRange('startColumn', $event)"
    /></label>
    <label
      >End column<input
        aria-label="Selection end column"
        type="number"
        min="1"
        [max]="data.rows[0].length"
        [ngModel]="range.endColumn + 1"
        (ngModelChange)="setRange('endColumn', $event)"
    /></label>
    <label
      >Column width (px)<input
        aria-label="Selected column width"
        type="number"
        min="0"
        max="1200"
        [ngModel]="data.columnWidths[range.startColumn]"
        (ngModelChange)="setSize('column', $event)"
    /></label>
    <label
      >Row height (px)<input
        aria-label="Selected row height"
        type="number"
        min="0"
        max="800"
        [ngModel]="data.rowHeights[range.startRow]"
        (ngModelChange)="setSize('row', $event)"
    /></label>
    <p class="field-note">
      Size 0 uses automatic sizing. Split restores the original cells; editing a
      merged cell replaces its combined content.
    </p>
    <div class="table-grid">
      <table aria-label="Table cell editor">
        <thead>
          <tr>
            <th>Row</th>
            @for (cell of data.rows[0]; track $index; let c = $index) {
              <th>
                <button
                  type="button"
                  [disabled]="data.rows[0].length <= 1"
                  [attr.aria-label]="'Remove column ' + (c + 1)"
                  (click)="removeColumn(c)"
                >
                  Col {{ c + 1 }} ×
                </button>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of data.rows; track $index; let r = $index) {
            <tr>
              <th>
                <div class="table-buttons">
                  <button
                    type="button"
                    [disabled]="r === 0 || data.merges.length > 0"
                    [attr.aria-label]="'Move row ' + (r + 1) + ' up'"
                    (click)="moveRow(r, -1)"
                  >
                    ↑</button
                  ><button
                    type="button"
                    [disabled]="
                      r === data.rows.length - 1 || data.merges.length > 0
                    "
                    [attr.aria-label]="'Move row ' + (r + 1) + ' down'"
                    (click)="moveRow(r, 1)"
                  >
                    ↓</button
                  ><button
                    type="button"
                    [disabled]="data.rows.length <= 1"
                    [attr.aria-label]="'Remove row ' + (r + 1)"
                    (click)="removeRow(r)"
                  >
                    {{ r + 1 }} ×
                  </button>
                </div>
              </th>
              @for (cell of row; track $index; let c = $index) {
                @if (!covered(r, c)) {
                  <td
                    [attr.rowspan]="span(r, c)?.rowSpan || 1"
                    [attr.colspan]="span(r, c)?.colSpan || 1"
                    [class.selected]="selectedCell(r, c)"
                  >
                    @if (native) {
                      <button
                        type="button"
                        (click)="openCell(r, c, $event.shiftKey)"
                        [attr.aria-label]="
                          'Edit row ' + (r + 1) + ', column ' + (c + 1)
                        "
                      >
                        {{ cellText(r, c) || "Add blocks" }}
                      </button>
                    } @else {
                      <textarea
                        [attr.aria-label]="
                          'Row ' + (r + 1) + ', column ' + (c + 1)
                        "
                        maxlength="1000"
                        [ngModel]="cellText(r, c)"
                        (pointerdown)="selectCell(r, c, $event.shiftKey)"
                        (ngModelChange)="setCell(r, c, $event)"
                      ></textarea>
                    }
                  </td>
                }
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (data.merges.length) {
      <p class="field-note">
        Split merged cells before reordering rows. Adding and removing rows or
        columns keeps remaining merges aligned.
      </p>
    }
    <div class="table-section"></div>
    @for (option of toggles; track option.key) {
      <label class="table-check"
        ><input
          type="checkbox"
          [ngModel]="data[option.key]"
          (ngModelChange)="set(option.key, $event)"
        /><span>{{ option.label }}</span></label
      >
    }
    <label
      >Cell padding (px)<input
        type="number"
        min="0"
        max="48"
        [ngModel]="data.cellPadding"
        (ngModelChange)="set('cellPadding', $event)"
    /></label>
    <label
      >Text alignment<select
        [ngModel]="data.align"
        (ngModelChange)="set('align', $event)"
      >
        <option>left</option>
        <option>center</option>
        <option>right</option>
      </select></label
    >
    <label
      >Vertical alignment<select
        [ngModel]="data.verticalAlign"
        (ngModelChange)="set('verticalAlign', $event)"
      >
        <option>top</option>
        <option>middle</option>
        <option>bottom</option>
      </select></label
    >
    @if (data.borders) {
      <label
        >Border width (px)<input
          type="number"
          min="0"
          max="8"
          [ngModel]="data.borderWidth"
          (ngModelChange)="set('borderWidth', $event)" /></label
      ><label
        >Border style<select
          [ngModel]="data.borderStyle"
          (ngModelChange)="set('borderStyle', $event)"
        >
          <option>solid</option>
          <option>dashed</option>
          <option>dotted</option>
        </select></label
      >
    }
    <div class="table-section"></div>
    @for (color of colors; track color.key) {
      <cl-color-picker
        [label]="color.label"
        [value]="data[color.key]"
        (valueChange)="set(color.key, $event)"
      />
    }
  </div>`,
})
export class TableSettingsComponent {
  private state = inject(ThemeEditorState);
  blockId = input("");
  value = input<unknown>();
  @Output() valueChange = new EventEmitter<TableData>();
  error = "";
  private tableNode = computed(() => this.state.find(this.blockId()));
  private tableData = computed(() => {
    const node = this.tableNode();
    return node?.children
      ? tableTreeData(node)
      : normalizeTableData(this.value());
  });
  get data() {
    return this.tableData();
  }
  get native() {
    return !!this.tableNode()?.children;
  }
  openCell(row: number, column: number, extend: boolean) {
    this.selectCell(row, column, extend);
    const node = this.state.find(this.blockId());
    const cell = node && tableRows(node)[row]?.children?.[column];
    if (cell && !extend) this.state.selected.set(cell.id);
  }
  get range(): TableRange {
    const selected = this.state.tableSelection();
    const row = Math.min(
      this.data.headerRow ? 1 : 0,
      this.data.rows.length - 1,
    );
    const range =
      selected?.id === this.blockId()
        ? selected
        : { startRow: row, endRow: row, startColumn: 0, endColumn: 0 };
    return {
      startRow: Math.min(range.startRow, this.data.rows.length - 1),
      endRow: Math.min(range.endRow, this.data.rows.length - 1),
      startColumn: Math.min(range.startColumn, this.data.rows[0].length - 1),
      endColumn: Math.min(range.endColumn, this.data.rows[0].length - 1),
    };
  }
  setRange(key: keyof TableRange, value: number) {
    const max = key.includes("Row")
      ? this.data.rows.length
      : this.data.rows[0].length;
    this.state.tableSelection.set({
      id: this.blockId(),
      ...this.range,
      [key]: Math.max(0, Math.min(max - 1, Math.floor(Number(value) || 1) - 1)),
    });
  }
  selectCell(row: number, column: number, extend: boolean) {
    const merge = this.span(row, column);
    this.state.tableSelection.set({
      id: this.blockId(),
      startRow: extend ? this.range.startRow : row,
      startColumn: extend ? this.range.startColumn : column,
      endRow: row + (merge?.rowSpan || 1) - 1,
      endColumn: column + (merge?.colSpan || 1) - 1,
    });
  }
  selectedCell(row: number, column: number) {
    const r = tableRange(this.range);
    return (
      row >= r.startRow &&
      row <= r.endRow &&
      column >= r.startColumn &&
      column <= r.endColumn
    );
  }
  covered(row: number, column: number) {
    return tableCellCovered(this.data, row, column);
  }
  span(row: number, column: number) {
    return tableMergeAt(this.data, row, column);
  }
  cellText(row: number, column: number) {
    return tableCellText(this.data, row, column);
  }
  merge() {
    try {
      this.emit(mergeTableCells(this.data, this.range));
    } catch (error) {
      this.error = (error as Error).message;
    }
  }
  split() {
    this.emit(splitTableCells(this.data, this.range));
  }
  resetSizes() {
    this.emit(
      normalizeTableData({ ...this.data, columnWidths: [], rowHeights: [] }),
    );
  }
  setSize(axis: "column" | "row", value: number) {
    const d = this.data;
    if (axis === "column") {
      d.columnWidths[this.range.startColumn] = Number(value);
      d.fixedLayout = false;
    } else d.rowHeights[this.range.startRow] = Number(value);
    this.emit(normalizeTableData(d));
  }
  toggles: { key: keyof TableData; label: string }[] = [
    { key: "headerRow", label: "Header row" },
    { key: "headerColumn", label: "First column as row headers" },
    { key: "footerRow", label: "Footer row" },
    { key: "striped", label: "Alternating row colors" },
    { key: "borders", label: "Cell borders" },
    { key: "fixedLayout", label: "Equal column widths" },
  ];
  colors: {
    key:
      | "headerBackground"
      | "headerColor"
      | "oddColor"
      | "evenColor"
      | "footerBackground"
      | "borderColor";
    label: string;
  }[] = [
    { key: "headerBackground", label: "Header background" },
    { key: "headerColor", label: "Header text color" },
    { key: "oddColor", label: "Odd row color" },
    { key: "evenColor", label: "Even row color" },
    { key: "footerBackground", label: "Footer background" },
    { key: "borderColor", label: "Cell border color" },
  ];
  emit(data: TableData) {
    this.error = "";
    if (JSON.stringify(data).length > 85000) {
      this.error = "Table data is too large. Shorten some cell text.";
      return;
    }
    this.valueChange.emit(data);
  }
  set(key: keyof TableData, value: unknown) {
    this.emit(
      normalizeTableData({
        ...this.data,
        [key]: value,
        ...(key === "fixedLayout" && value ? { columnWidths: [] } : {}),
      }),
    );
  }
  setCell(row: number, column: number, value: string) {
    this.emit(setTableCellText(this.data, row, column, value));
  }
  track(axis: "row" | "column", index: number, remove = false) {
    const node = this.state.find(this.blockId());
    if (!node?.children) return false;
    this.state.commit(() => editTableTrack(node, axis, index, remove));
    return true;
  }
  addRow() {
    const d = this.data;
    if (this.track("row", d.footerRow ? d.rows.length - 1 : d.rows.length))
      return;
    this.emit(
      insertTableTrack(
        d,
        "row",
        d.footerRow
          ? Math.max(d.headerRow ? 1 : 0, d.rows.length - 1)
          : d.rows.length,
      ),
    );
  }
  addColumn() {
    if (this.track("column", this.data.rows[0].length)) return;
    this.emit(insertTableTrack(this.data, "column", this.data.rows[0].length));
  }
  removeRow(index: number) {
    if (this.track("row", index, true)) return;
    this.emit(removeTableTrack(this.data, "row", index));
  }
  removeColumn(index: number) {
    if (this.track("column", index, true)) return;
    this.emit(removeTableTrack(this.data, "column", index));
  }
  moveRow(index: number, direction: number) {
    const d = this.data;
    if (d.merges.length) return;
    const next = index + direction;
    const node = this.state.find(this.blockId());
    if (node?.children && next >= 0 && next < d.rows.length) {
      this.state.commit(() => {
        const rows = tableRows(node),
          first = rows[index],
          second = rows[next];
        for (const section of node.children!)
          section.children = section.children!.map((row) =>
            row === first ? second : row === second ? first : row,
          );
        [d.rowHeights[index], d.rowHeights[next]] = [
          d.rowHeights[next],
          d.rowHeights[index],
        ];
        node.settings["tableData"] = d;
      });
      return;
    }
    if (next >= 0 && next < d.rows.length) {
      [d.rows[index], d.rows[next]] = [d.rows[next], d.rows[index]];
      [d.rowHeights[index], d.rowHeights[next]] = [
        d.rowHeights[next],
        d.rowHeights[index],
      ];
    }
    this.emit(d);
  }
}
