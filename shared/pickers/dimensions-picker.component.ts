import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PickerBase } from "./picker-base";
import { UnitInputComponent } from "./unit-input.component";

@Component({
  selector: "cl-dimensions-picker",
  standalone: true,
  imports: [FormsModule, UnitInputComponent],
  template: `
    <details class="cl-picker">
      <summary><span class="cl-picker-badge">S</span>Size</summary>
      <div class="cl-picker-body">
        <label class="cl-picker-field cl-picker-range-field">
          <span class="cl-picker-range-label">Max width</span>
          <cl-unit-input
            label="Max width"
            [slider]="true"
            [allowAuto]="true"
            [min]="0"
            [max]="1920"
            [fallback]="1080"
            [value]="settings['maxWidth'] || 'auto'"
            (valueChange)="set('maxWidth', $event)"
          />
        </label>
        @if (blockType === "core/container" || blockType === "core/slider") {
          <label class="cl-picker-field">
            <span>Min height</span>
            <input
              type="checkbox"
              [ngModel]="settings['minHeightEnabled'] || false"
              (ngModelChange)="set('minHeightEnabled', $event)"
            />
            Enable
          </label>
          @if (settings["minHeightEnabled"]) {
            <label class="cl-picker-field cl-picker-range-field">
              <span class="cl-picker-range-label">Min height</span>
              <cl-unit-input
                label="Min height"
                [slider]="true"
                [allowAuto]="true"
                [min]="0"
                [max]="2000"
                [fallback]="400"
                [value]="settings['minHeight'] || 'auto'"
                (valueChange)="setMinHeight($event)"
              />
            </label>
            <fieldset class="theme-spacing theme-breakpoints">
              <legend>Per breakpoint (blank inherits)</legend>
              @for (bp of breakpoints; track bp) {
                <label
                  >{{ bp }}
                  <input
                    type="number"
                    min="0"
                    placeholder="Auto"
                    [ngModel]="settings['minHeightByBreakpoint']?.[bp] ?? null"
                    (ngModelChange)="setBreakpoint(bp, $event)"
                  />
                </label>
              }
            </fieldset>
            @if (blockType === "core/container") {
              <label class="cl-picker-field"
                >Vertical align
                <select
                  [ngModel]="settings['verticalAlign'] || 'flex-start'"
                  (ngModelChange)="set('verticalAlign', $event)"
                >
                  <option value="flex-start">Top</option>
                  <option value="center">Center</option>
                  <option value="flex-end">Bottom</option>
                </select>
              </label>
            }
          }
        }
      </div>
    </details>
  `,
})
export class DimensionsPickerComponent extends PickerBase {
  @Input() blockType = "";
  breakpoints = ["desktop", "tablet", "mobile"];
  setMinHeight(value: number | string) {
    this.set("minHeight", value);
    const unit = String(value).match(/(px|vh|rem|em|%|vw)$/)?.[1];
    if (unit || typeof value === "number")
      this.set("minHeightUnit", unit || "px");
  }
  setBreakpoint(bp: string, value: number | null | string) {
    this.set("minHeightByBreakpoint", {
      ...(this.settings["minHeightByBreakpoint"] || {}),
      [bp]: value === "" || value === null ? null : Number(value),
    });
  }
}
