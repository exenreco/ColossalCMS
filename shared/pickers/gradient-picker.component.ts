import { Component, ElementRef, Input, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PickerBase } from "./picker-base";
import { PickerPopoverComponent } from "./picker-popover.component";
import { ColorWheelComponent } from "./color-wheel.component";
import { hexToHsv, hsvToHex, normalizeHex } from "./color-math";

interface GradientStop {
  color: string;
  position: number;
}

@Component({
  selector: "cl-gradient-picker",
  standalone: true,
  imports: [FormsModule, PickerPopoverComponent, ColorWheelComponent],
  template: `
    <cl-picker-popover label="Gradient" [swatch]="preview">
      <div class="cl-picker-body">
        <div
          class="cl-gradient-preview"
          [style.background]="preview"
          aria-label="Gradient preview"
        ></div>
        <div class="cl-picker-actions" role="group" aria-label="Gradient type">
          <button
            type="button"
            [attr.aria-pressed]="type === 'linear'"
            (click)="update('type', 'linear')"
          >
            Linear
          </button>
          <button
            type="button"
            [attr.aria-pressed]="type === 'radial'"
            (click)="update('type', 'radial')"
          >
            Radial
          </button>
        </div>
        @if (type === "linear") {
          <label class="cl-picker-field cl-picker-range-field"
            ><span class="cl-picker-range-label">Angle</span>
            <input
              type="range"
              min="0"
              max="360"
              [ngModel]="angle"
              (ngModelChange)="update('angle', $event)"
            />
            <span class="cl-picker-range-value cl-picker-range-value--editable"
              ><input
                type="number"
                min="0"
                max="360"
                [ngModel]="angle"
                (ngModelChange)="update('angle', $event)"
              />°</span
            >
          </label>
        }
        <div
          #rail
          class="cl-gradient-rail"
          [style.background]="preview"
          aria-label="Gradient stops"
          (pointerdown)="startStopDrag($event)"
          (pointermove)="moveStop($event)"
          (pointerup)="endStopDrag($event)"
          (pointercancel)="endStopDrag($event)"
        >
          @for (item of stops; track $index; let i = $index) {
            <button
              type="button"
              class="cl-gradient-stop"
              [class.selected]="selected === i"
              [style.left.%]="item.position"
              [style.background]="item.color"
              [attr.aria-label]="
                'Gradient stop ' + (i + 1) + ' at ' + item.position + ' percent'
              "
              (keydown)="moveStopWithKey($event, i)"
            ></button>
          }
        </div>
        <div class="cl-picker-actions">
          <button
            type="button"
            (click)="addStop()"
            [disabled]="stops.length >= 8"
          >
            Add stop
          </button>
          <button
            type="button"
            (click)="removeStop()"
            [disabled]="stops.length <= 2"
          >
            Remove stop
          </button>
        </div>
        <cl-color-wheel
          [value]="active.color"
          (valueChange)="setStop('color', preserveAlpha($event))"
        />
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
        <label class="cl-picker-field cl-picker-range-field"
          ><span class="cl-picker-range-label">Opacity</span>
          <input
            class="cl-color-range cl-alpha-range"
            type="range"
            [style.--cl-range-color]="opaqueStop"
            min="0"
            max="100"
            [ngModel]="opacity"
            (ngModelChange)="setOpacity($event)"
          />
          <span class="cl-picker-range-value">{{ opacity }}%</span>
        </label>
        <label class="cl-picker-field"
          >HEX
          <input
            [ngModel]="active.color"
            (ngModelChange)="setStop('color', $event)"
          />
        </label>
        <div class="cl-picker-swatches" aria-label="Theme gradient colors">
          @for (swatch of palette; track swatch) {
            <button
              type="button"
              [style.background]="swatch"
              [attr.aria-label]="'Use ' + swatch + ' for stop'"
              (click)="setStop('color', swatch)"
            ></button>
          }
        </div>
        <button
          class="button small"
          type="button"
          (click)="set('backgroundGradient', null)"
        >
          Clear gradient
        </button>
      </div>
    </cl-picker-popover>
  `,
})
export class GradientPickerComponent extends PickerBase {
  @Input() palette: string[] = [];
  @ViewChild("rail") rail!: ElementRef<HTMLElement>;
  selected = 0;
  private draggingPointer: number | null = null;
  get gradient() {
    return this.settings["backgroundGradient"] || {};
  }
  get type() {
    return this.gradient.type === "radial" ? "radial" : "linear";
  }
  get angle() {
    return this.number(this.gradient.angle, 90);
  }
  get stops(): GradientStop[] {
    const list = this.gradient.stops;
    if (Array.isArray(list) && list.length >= 2)
      return list.map((item) => ({
        color: item.color || "#000000",
        position: this.number(item.position),
      }));
    return [
      { color: this.gradient.start || "#ef4444", position: 0 },
      { color: this.gradient.end || "#111827", position: 100 },
    ];
  }
  get active() {
    return this.stops[Math.min(this.selected, this.stops.length - 1)];
  }
  get hue() {
    return Math.round(hexToHsv(this.active.color).hue);
  }
  get opacity() {
    return /^#[\da-f]{8}$/i.test(this.active.color)
      ? Math.round((parseInt(this.active.color.slice(7), 16) / 255) * 100)
      : 100;
  }
  get opaqueStop() {
    return normalizeHex(this.active.color);
  }
  get preview() {
    const stops = [...this.stops]
      .sort((a, b) => a.position - b.position)
      .map((item) => `${item.color} ${item.position}%`)
      .join(", ");
    return this.type === "radial"
      ? `radial-gradient(circle, ${stops})`
      : `linear-gradient(${this.angle}deg, ${stops})`;
  }
  update(key: string, value: unknown) {
    this.set("backgroundGradient", { ...this.gradient, [key]: value });
  }
  setStop(key: "color" | "position", value: string | number) {
    if (key === "color" && !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(String(value)))
      return;
    const stops = this.stops;
    const index = Math.min(this.selected, stops.length - 1);
    this.selected = index;
    stops[index] = {
      ...stops[index],
      [key]:
        key === "position"
          ? Math.max(0, Math.min(100, this.number(value)))
          : value,
    };
    this.update("stops", stops);
  }
  addStop() {
    const stops = this.stops;
    if (stops.length >= 8) return;
    this.selected = Math.min(this.selected, stops.length - 1);
    const position = Math.round(
      (stops[this.selected].position +
        (stops[this.selected + 1]?.position ?? 100)) /
        2,
    );
    stops.splice(this.selected + 1, 0, {
      color: stops[this.selected].color,
      position,
    });
    this.selected++;
    this.update("stops", stops);
  }
  startStopDrag(event: PointerEvent) {
    if (event.button !== 0) return;
    const stop = (event.target as HTMLElement).closest(".cl-gradient-stop");
    if (stop) {
      this.selected = Array.from(this.rail.nativeElement.children).indexOf(
        stop,
      );
    } else {
      if (this.stops.length >= 8) return;
      const position = this.positionAt(event.clientX);
      const stops = this.stops;
      const sorted = [...stops].sort((a, b) => a.position - b.position);
      const before = [...sorted]
        .reverse()
        .find((item) => item.position <= position);
      const after = sorted.find((item) => item.position >= position);
      const color = this.colorBetween(before, after, position);
      stops.push({ color, position });
      this.selected = stops.length - 1;
      this.update("stops", stops);
    }
    this.draggingPointer = event.pointerId;
    try {
      this.rail.nativeElement.setPointerCapture(event.pointerId);
    } catch {
      /* Synthetic test pointers cannot be captured. */
    }
    event.preventDefault();
  }
  moveStop(event: PointerEvent) {
    if (this.draggingPointer === event.pointerId)
      this.setStop("position", this.positionAt(event.clientX));
  }
  endStopDrag(event: PointerEvent) {
    if (this.draggingPointer !== event.pointerId) return;
    this.setStop("position", this.positionAt(event.clientX));
    this.draggingPointer = null;
    if (this.rail.nativeElement.hasPointerCapture(event.pointerId))
      this.rail.nativeElement.releasePointerCapture(event.pointerId);
  }
  moveStopWithKey(event: KeyboardEvent, index: number) {
    const delta = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (delta === undefined && event.key !== "Home" && event.key !== "End")
      return;
    event.preventDefault();
    this.selected = index;
    const position =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 100
          : this.stops[index].position +
            (delta ?? 0) * (event.shiftKey ? 10 : 1);
    this.setStop("position", position);
  }
  private positionAt(clientX: number) {
    const rect = this.rail.nativeElement.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)),
    );
  }
  private colorBetween(
    before: GradientStop | undefined,
    after: GradientStop | undefined,
    position: number,
  ) {
    if (!before) return after?.color || "#000000";
    if (!after || before === after) return before.color;
    const fraction =
      (position - before.position) / (after.position - before.position || 1);
    const first = normalizeHex(before.color);
    const last = normalizeHex(after.color);
    const channels = [1, 3, 5].map((offset) =>
      Math.round(
        parseInt(first.slice(offset, offset + 2), 16) * (1 - fraction) +
          parseInt(last.slice(offset, offset + 2), 16) * fraction,
      )
        .toString(16)
        .padStart(2, "0"),
    );
    return `#${channels.join("")}`;
  }
  removeStop() {
    const stops = this.stops;
    if (stops.length <= 2) return;
    this.selected = Math.min(this.selected, stops.length - 1);
    stops.splice(this.selected, 1);
    this.selected = Math.min(this.selected, stops.length - 1);
    this.update("stops", stops);
  }
  preserveAlpha(color: string) {
    return (
      color +
      (/^#[\da-f]{8}$/i.test(this.active.color)
        ? this.active.color.slice(7)
        : "")
    );
  }
  setHue(value: number) {
    const hsv = hexToHsv(this.active.color);
    this.setStop(
      "color",
      this.preserveAlpha(
        hsvToHex(Number(value), hsv.saturation || 1, hsv.brightness || 1),
      ),
    );
  }
  setOpacity(value: number) {
    const alpha = Math.round(
      (Math.max(0, Math.min(100, Number(value))) / 100) * 255,
    );
    this.setStop(
      "color",
      normalizeHex(this.active.color) +
        (alpha === 255 ? "" : alpha.toString(16).padStart(2, "0")),
    );
  }
}
