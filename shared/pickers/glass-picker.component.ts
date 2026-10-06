import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PickerBase } from "./picker-base";
import { PickerPopoverComponent } from "./picker-popover.component";

@Component({
  selector: "cl-glass-picker",
  standalone: true,
  imports: [FormsModule, PickerPopoverComponent],
  template: `
    <cl-picker-popover label="Glass" badge="G">
      <label class="cl-picker-field"
        ><span>Liquid glass</span
        ><input
          type="checkbox"
          [ngModel]="settings['glassEnabled'] || false"
          (ngModelChange)="set('glassEnabled', $event)"
      /></label>
      @if (settings["glassEnabled"]) {
        <label class="cl-picker-field cl-picker-range-field"
          ><span class="cl-picker-range-label">Blur</span
          ><input
            type="range"
            min="0"
            max="48"
            [ngModel]="settings['glassBlur'] ?? 24"
            (ngModelChange)="set('glassBlur', $event)"
          /><span class="cl-picker-range-value"
            >{{ settings["glassBlur"] ?? 24 }}px</span
          ></label
        >
        <label class="cl-picker-field cl-picker-range-field"
          ><span class="cl-picker-range-label">Saturation</span
          ><input
            type="range"
            min="50"
            max="200"
            [ngModel]="settings['glassSaturation'] ?? 130"
            (ngModelChange)="set('glassSaturation', $event)"
          /><span class="cl-picker-range-value"
            >{{ settings["glassSaturation"] ?? 130 }}%</span
          ></label
        >
        <p class="field-note">
          Use Background color opacity for a transparent tint. Border and radius
          controls shape the glass.
        </p>
      }
    </cl-picker-popover>
  `,
})
export class GlassPickerComponent extends PickerBase {}
