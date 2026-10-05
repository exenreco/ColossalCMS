import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PickerBase } from "./picker-base";
import { PickerPopoverComponent } from "./picker-popover.component";
import { UnitInputComponent } from "./unit-input.component";

@Component({
  selector: "cl-layout-picker",
  standalone: true,
  imports: [FormsModule, PickerPopoverComponent, UnitInputComponent],
  template: `
    <cl-picker-popover label="Layout" badge="L">
      <div class="cl-picker-body">
        <label class="cl-picker-field"
          >Z-index
          <input
            type="number"
            min="-100"
            max="1000"
            placeholder="Auto"
            [ngModel]="settings['zIndex'] ?? null"
            (ngModelChange)="set('zIndex', $event)"
          />
        </label>
        <label class="cl-picker-field"
          >Display
          <select [ngModel]="display" (ngModelChange)="set('display', $event)">
            <option value="">Default</option>
            <option value="block">Block</option>
            <option value="flex">Flex</option>
            <option value="grid">Grid</option>
          </select>
        </label>
        <label class="cl-picker-field"
          >Position
          <select
            [ngModel]="settings['position'] || 'static'"
            (ngModelChange)="set('position', $event)"
          >
            <option value="static">Static</option>
            <option value="relative">Relative</option>
            <option value="absolute">Absolute</option>
            <option value="fixed">Fixed</option>
          </select>
        </label>
        @if (settings["position"] && settings["position"] !== "static") {
          <h4>Top, left, right, bottom</h4>
          <div class="cl-spacing-diagram">
            @for (side of sides; track side) {
              <label [class]="'cl-spacing-' + side"
                ><span class="sr-only">{{ side }} offset</span>
                <cl-unit-input
                  [label]="side + ' offset'"
                  [min]="-500"
                  [max]="500"
                  [allowAuto]="true"
                  [value]="settings['offsets']?.[side]"
                  (valueChange)="offset(side, $event)"
                />
              </label>
            }
            <span class="cl-spacing-center">Position</span>
          </div>
        }
        @if (display === "flex") {
          <h4>Flex layout</h4>
          <label class="cl-picker-field"
            >Flex
            <input
              [ngModel]="settings['flex'] || ''"
              (ngModelChange)="set('flex', $event)"
              placeholder="1 1 auto"
            />
          </label>
          <label class="cl-picker-field"
            >Flex wrap
            <select
              [ngModel]="settings['flexWrap'] || ''"
              (ngModelChange)="set('flexWrap', $event)"
            >
              <option value="">Default</option>
              <option value="nowrap">No wrap</option>
              <option value="wrap">Wrap</option>
              <option value="wrap-reverse">Reverse wrap</option>
            </select>
          </label>
          <label class="cl-picker-field"
            >Flex shrink
            <input
              type="number"
              min="0"
              max="10"
              [ngModel]="settings['flexShrink'] ?? 1"
              (ngModelChange)="set('flexShrink', $event)"
            />
          </label>
        } @else if (display === "grid") {
          <h4>Grid layout</h4>
          <label class="cl-picker-field"
            >Columns
            <input
              type="number"
              min="1"
              max="12"
              [ngModel]="settings['gridColumns'] || 2"
              (ngModelChange)="set('gridColumns', $event)"
            />
          </label>
          <label class="cl-picker-field"
            >Gap
            <cl-unit-input
              label="Gap"
              [min]="0"
              [max]="120"
              [value]="settings['gap']"
              (valueChange)="set('gap', $event)"
            />
          </label>
        }
        <h4>Transform</h4>
        @for (axis of translateAxes; track axis.key) {
          <label class="cl-picker-field cl-picker-range-field"
            ><span class="cl-picker-range-label">{{ axis.label }}</span>
            <cl-unit-input
              [label]="axis.label"
              [slider]="true"
              [min]="-500"
              [max]="500"
              [value]="settings['transform']?.[axis.key]"
              (valueChange)="transform(axis.key, $event)"
            />
          </label>
        }
        <label class="cl-picker-field cl-picker-range-field"
          ><span class="cl-picker-range-label">Rotate</span>
          <input
            type="range"
            min="-360"
            max="360"
            [ngModel]="settings['transform']?.rotate ?? 0"
            (ngModelChange)="transform('rotate', $event)"
          />
          <input
            type="number"
            min="-360"
            max="360"
            [ngModel]="settings['transform']?.rotate ?? 0"
            (ngModelChange)="transform('rotate', $event)"
          /><span>deg</span>
        </label>
        @for (axis of scaleAxes; track axis.key) {
          <label class="cl-picker-field cl-picker-range-field"
            ><span class="cl-picker-range-label">{{ axis.label }}</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              [ngModel]="settings['transform']?.[axis.key] ?? 1"
              (ngModelChange)="transform(axis.key, $event)"
            />
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              [ngModel]="settings['transform']?.[axis.key] ?? 1"
              (ngModelChange)="transform(axis.key, $event)"
            />
          </label>
        }
      </div>
    </cl-picker-popover>
  `,
})
export class LayoutPickerComponent extends PickerBase {
  @Input() blockType = "";
  sides = ["top", "right", "bottom", "left"];
  translateAxes = [
    { key: "translateX", label: "Move X" },
    { key: "translateY", label: "Move Y" },
  ];
  scaleAxes = [
    { key: "scaleX", label: "Scale X" },
    { key: "scaleY", label: "Scale Y" },
  ];
  get display() {
    return (
      this.settings["display"] ||
      (this.blockType === "core/row"
        ? "flex"
        : this.blockType === "core/columns"
          ? "grid"
          : "block")
    );
  }
  offset(side: string, value: number | string) {
    this.set("offsets", {
      ...(this.settings["offsets"] || {}),
      [side]: value,
    });
  }
  transform(key: string, value: number | string) {
    this.set("transform", {
      ...(this.settings["transform"] || {}),
      [key]: value,
    });
  }
}
