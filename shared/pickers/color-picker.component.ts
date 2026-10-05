import { Component, Input, EventEmitter, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PickerPopoverComponent } from "./picker-popover.component";
import { ColorWheelComponent } from "./color-wheel.component";
import { hexToHsv, hsvToHex, normalizeHex } from "./color-math";

@Component({
  selector: "cl-color-picker",
  standalone: true,
  imports: [FormsModule, PickerPopoverComponent, ColorWheelComponent],
  template: `
    <cl-picker-popover
      [label]="label"
      [badge]="label === 'Background color' ? 'B' : 'T'"
      [swatch]="value"
    >
      <div class="cl-picker-body">
        <cl-color-wheel [value]="opaque" (valueChange)="pick($event)" />
        <label class="cl-picker-field cl-picker-range-field"
          ><span class="cl-picker-range-label">Hue</span>
          <input
            class="cl-color-range cl-hue-range"
            type="range"
            min="0"
            max="360"
            [ngModel]="hue"
            (ngModelChange)="setHue($event)"
          />
          <span class="cl-picker-range-value">{{ hue }}°</span>
        </label>
        <label class="cl-picker-field"
          >HEX
          <input
            [ngModel]="value"
            (ngModelChange)="edit($event)"
            placeholder="Inherit"
          />
        </label>
        <label class="cl-picker-field cl-picker-range-field"
          ><span class="cl-picker-range-label">Opacity</span>
          <input
            class="cl-color-range cl-alpha-range"
            type="range"
            [style.--cl-range-color]="opaque"
            min="0"
            max="100"
            [ngModel]="alpha"
            (ngModelChange)="setAlpha($event)"
          />
          <span class="cl-picker-range-value">{{ alpha }}%</span>
        </label>
        <div class="cl-color-channels">
          @for (channel of ["R", "G", "B"]; track channel; let index = $index) {
            <label
              >{{ channel
              }}<input
                type="number"
                min="0"
                max="255"
                [ngModel]="rgb[index]"
                (ngModelChange)="setChannel(index, $event)"
            /></label>
          }
          <label
            >A<input
              type="number"
              min="0"
              max="100"
              [ngModel]="alpha"
              (ngModelChange)="setAlpha($event)"
          /></label>
        </div>
        <div class="cl-picker-swatches" aria-label="Theme colors">
          @for (swatch of palette; track swatch) {
            <button
              type="button"
              [style.background]="swatch"
              [attr.aria-label]="'Use ' + swatch"
              (click)="valueChange.emit(swatch)"
            ></button>
          }
        </div>
        <button
          type="button"
          class="cl-picker-reset"
          [attr.aria-label]="'Reset ' + label.toLowerCase()"
          [disabled]="!value"
          (click)="valueChange.emit('')"
        >
          Reset {{ label.toLowerCase() }}
        </button>
      </div>
    </cl-picker-popover>
  `,
})
export class ColorPickerComponent {
  @Input() label = "Color";
  @Input() value = "";
  @Input() palette: string[] = [];
  @Output() valueChange = new EventEmitter<string>();
  get opaque() {
    return normalizeHex(this.value);
  }
  get alpha() {
    return /^#[\da-f]{8}$/i.test(this.value)
      ? Math.round((parseInt(this.value.slice(7), 16) / 255) * 100)
      : 100;
  }
  get rgb() {
    return [1, 3, 5].map((index) =>
      parseInt(this.opaque.slice(index, index + 2), 16),
    );
  }
  get hue() {
    return Math.round(hexToHsv(this.value).hue);
  }
  pick(color: string) {
    const alpha = this.value.length === 9 ? this.value.slice(7) : "";
    this.valueChange.emit(color + alpha);
  }
  edit(value: string) {
    if (
      value === "" ||
      /^#[\da-f]{3}(?:[\da-f]{3})?(?:[\da-f]{2})?$/i.test(value)
    )
      this.valueChange.emit(value);
  }
  setAlpha(value: number) {
    const alpha = Math.round((Number(value) / 100) * 255);
    this.valueChange.emit(
      this.opaque + (alpha === 255 ? "" : alpha.toString(16).padStart(2, "0")),
    );
  }
  setChannel(index: number, value: number) {
    const channels = this.rgb;
    channels[index] = Math.max(0, Math.min(255, Number(value) || 0));
    this.pick(
      "#" +
        channels
          .map((channel) => channel.toString(16).padStart(2, "0"))
          .join(""),
    );
  }
  setHue(value: number) {
    const hsv = hexToHsv(this.value);
    this.pick(
      hsvToHex(Number(value), hsv.saturation || 1, hsv.brightness || 1),
    );
  }
}
