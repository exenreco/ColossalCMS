import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ColorPickerComponent } from "./pickers/color-picker.component";
import { normalizeTableData, TableData } from "./table-block";
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
      Edit cells here or directly in the canvas. Up to 50 rows and 12 columns.
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
                    [disabled]="r === 0"
                    [attr.aria-label]="'Move row ' + (r + 1) + ' up'"
                    (click)="moveRow(r, -1)"
                  >
                    ↑</button
                  ><button
                    type="button"
                    [disabled]="r === data.rows.length - 1"
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
                <td>
                  <textarea
                    [attr.aria-label]="'Row ' + (r + 1) + ', column ' + (c + 1)"
                    maxlength="1000"
                    [ngModel]="cell"
                    (ngModelChange)="setCell(r, c, $event)"
                  ></textarea>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
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
  @Input() value: unknown;
  @Output() valueChange = new EventEmitter<TableData>();
  error = "";
  get data() {
    return normalizeTableData(this.value);
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
    this.emit(normalizeTableData({ ...this.data, [key]: value }));
  }
  setCell(row: number, column: number, value: string) {
    const data = this.data;
    data.rows[row][column] = value;
    this.emit(data);
  }
  addRow() {
    const d = this.data;
    if (d.rows.length < 50)
      d.rows.splice(
        d.footerRow
          ? Math.max(d.headerRow ? 1 : 0, d.rows.length - 1)
          : d.rows.length,
        0,
        Array(d.rows[0].length).fill(""),
      );
    this.emit(d);
  }
  addColumn() {
    const d = this.data;
    if (d.rows[0].length < 12) d.rows.forEach((row) => row.push(""));
    this.emit(d);
  }
  removeRow(index: number) {
    const d = this.data;
    if (d.rows.length > 1) d.rows.splice(index, 1);
    this.emit(d);
  }
  removeColumn(index: number) {
    const d = this.data;
    if (d.rows[0].length > 1) d.rows.forEach((row) => row.splice(index, 1));
    this.emit(d);
  }
  moveRow(index: number, direction: number) {
    const d = this.data;
    const next = index + direction;
    if (next >= 0 && next < d.rows.length)
      [d.rows[index], d.rows[next]] = [d.rows[next], d.rows[index]];
    this.emit(d);
  }
}
