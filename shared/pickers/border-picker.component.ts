import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PickerBase } from "./picker-base";
import { PickerPopoverComponent } from "./picker-popover.component";
import { UnitInputComponent } from "./unit-input.component";
import { ColorWheelComponent } from "./color-wheel.component";

@Component({
  selector: "cl-border-picker",
  standalone: true,
  imports: [
    FormsModule,
    PickerPopoverComponent,
    UnitInputComponent,
    ColorWheelComponent,
  ],
  template: `
    <cl-picker-popover label="Border" badge="B">
      <div class="cl-picker-body">
        <div
          class="cl-border-diagram"
          [style.border-top-color]="sideColor('top')"
          [style.border-right-color]="sideColor('right')"
          [style.border-bottom-color]="sideColor('bottom')"
          [style.border-left-color]="sideColor('left')"
          [style.border-top-style]="sideStyle('top')"
          [style.border-right-style]="sideStyle('right')"
          [style.border-bottom-style]="sideStyle('bottom')"
          [style.border-left-style]="sideStyle('left')"
        >
          @for (side of sides; track side) {
            <label [class]="'cl-spacing-' + side"
              ><span class="sr-only">{{ side }} border width</span>
              <button
                type="button"
                class="cl-border-color-button"
                [style.background]="sideColor(side)"
                [attr.aria-label]="'Edit ' + side + ' border color'"
                [attr.aria-pressed]="selectedColorSide === side"
                (click)="
                  selectedColorSide = selectedColorSide === side ? '' : side
                "
              ></button>
              <select
                class="cl-border-style-select"
                [attr.aria-label]="side + ' border style'"
                [ngModel]="sideStyle(side)"
                (ngModelChange)="setSideStyle(side, $event)"
              >
                @for (option of styles; track option) {
                  <option [value]="option">{{ option }}</option>
                }
              </select>
              <cl-unit-input
                [label]="side + ' border width'"
                [min]="0"
                [max]="20"
                [allowAuto]="true"
                [value]="width(side)"
                (valueChange)="updateWidth(side, $event)"
              />
            </label>
          }
        </div>
        @if (selectedColorSide) {
          <div class="cl-border-color-editor">
            <strong>{{ selectedColorSide }} border color</strong>
            <cl-color-wheel
              [value]="sideColor(selectedColorSide)"
              (valueChange)="setSideColor(selectedColorSide, $event)"
            />
            <label class="cl-picker-field"
              >HEX
              <input
                [ngModel]="sideColor(selectedColorSide)"
                (ngModelChange)="setSideColor(selectedColorSide, $event)"
              />
            </label>
            <div class="cl-picker-swatches" aria-label="Theme border colors">
              @for (swatch of palette; track swatch) {
                <button
                  type="button"
                  [style.background]="swatch"
                  [attr.aria-label]="
                    'Use ' + swatch + ' for ' + selectedColorSide + ' border'
                  "
                  (click)="setSideColor(selectedColorSide, swatch)"
                ></button>
              }
            </div>
          </div>
        }
        <h4>Border radius</h4>
        @for (corner of corners; track corner.key) {
          <label class="cl-picker-field cl-picker-range-field cl-corner-field"
            ><span
              [class]="'cl-corner-icon cl-corner-' + corner.key"
              aria-hidden="true"
            ></span
            ><span class="cl-picker-range-label">{{ corner.label }}</span>
            <cl-unit-input
              [label]="corner.label + ' radius'"
              [slider]="true"
              [min]="0"
              [max]="100"
              [value]="radius(corner.key)"
              (valueChange)="updateRadius(corner.key, $event)"
            />
          </label>
        }
      </div>
    </cl-picker-popover>
  `,
})
export class BorderPickerComponent extends PickerBase {
  @Input() palette: string[] = [];
  sides = ["top", "right", "bottom", "left"];
  styles = ["solid", "dashed", "dotted", "double"];
  selectedColorSide = "";
  corners = [
    { key: "topLeft", label: "Top left" },
    { key: "topRight", label: "Top right" },
    { key: "bottomRight", label: "Bottom right" },
    { key: "bottomLeft", label: "Bottom left" },
  ];
  width(side: string) {
    return (
      this.settings["borderSides"]?.[side] ??
      (this.settings["borderWidth"] || "auto")
    );
  }
  sideColor(side: string) {
    return (
      this.settings["borderColors"]?.[side] ||
      this.settings["borderColor"] ||
      "#000000"
    );
  }
  sideStyle(side: string) {
    return (
      this.settings["borderStyles"]?.[side] ||
      this.settings["borderStyle"] ||
      "solid"
    );
  }
  setSideColor(side: string, value: string) {
    if (!/^#[\da-f]{3}(?:[\da-f]{3})?(?:[\da-f]{2})?$/i.test(value)) return;
    this.set("borderColors", {
      ...(this.settings["borderColors"] || {}),
      [side]: value,
    });
  }
  setSideStyle(side: string, value: string) {
    if (!this.styles.includes(value)) return;
    this.set("borderStyles", {
      ...(this.settings["borderStyles"] || {}),
      [side]: value,
    });
  }
  radius(corner: string) {
    return (
      this.settings["radiusCorners"]?.[corner] ?? this.settings["radius"] ?? 0
    );
  }
  updateWidth(side: string, value: number | string) {
    this.set("borderSides", {
      ...Object.fromEntries(this.sides.map((item) => [item, this.width(item)])),
      [side]: value,
    });
  }
  updateRadius(corner: string, value: number | string) {
    this.set("radiusCorners", {
      ...Object.fromEntries(
        this.corners.map((item) => [item.key, this.radius(item.key)]),
      ),
      [corner]: value,
    });
  }
}
