import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { hexToHsv, hsvToHex } from "./color-math";

/** Draggable hue/saturation wheel with an independent brightness control. */
@Component({
  selector: "cl-color-wheel",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div
      #wheel
      class="cl-color-wheel"
      role="slider"
      tabindex="0"
      aria-label="Color wheel"
      [attr.aria-valuetext]="value || '#000000'"
      (pointerdown)="start($event)"
      (pointermove)="move($event)"
      (pointerup)="end($event)"
      (pointercancel)="end($event)"
      (keydown)="key($event)"
    >
      <span
        class="cl-color-wheel-marker"
        [style.left.%]="markerX"
        [style.top.%]="markerY"
      ></span>
    </div>
    <label class="cl-picker-field cl-picker-range-field"
      ><span class="cl-picker-range-label">Brightness</span>
      <input
        class="cl-color-range cl-brightness-range"
        type="range"
        [style.--cl-range-color]="brightColor"
        min="0"
        max="100"
        [ngModel]="brightness"
        (ngModelChange)="setBrightness($event)"
      />
      <span class="cl-picker-range-value">{{ brightness }}%</span>
    </label>
  `,
})
export class ColorWheelComponent {
  @Input() value = "#000000";
  @Output() valueChange = new EventEmitter<string>();
  @ViewChild("wheel") wheel!: ElementRef<HTMLElement>;
  private dragging = false;
  get hsv() {
    return hexToHsv(this.value);
  }
  get brightness() {
    return Math.round(this.hsv.brightness * 100);
  }
  get brightColor() {
    return hsvToHex(this.hsv.hue, this.hsv.saturation, 1);
  }
  get markerX() {
    return (
      50 +
      Math.cos(((this.hsv.hue - 90) * Math.PI) / 180) * this.hsv.saturation * 44
    );
  }
  get markerY() {
    return (
      50 +
      Math.sin(((this.hsv.hue - 90) * Math.PI) / 180) * this.hsv.saturation * 44
    );
  }
  start(event: PointerEvent) {
    this.dragging = true;
    try {
      this.wheel.nativeElement.setPointerCapture(event.pointerId);
    } catch {
      /* Synthetic test pointers cannot be captured. */
    }
    this.applyPointer(event);
    event.preventDefault();
  }
  move(event: PointerEvent) {
    if (this.dragging) this.applyPointer(event);
  }
  end(event: PointerEvent) {
    if (!this.dragging) return;
    this.applyPointer(event);
    this.dragging = false;
    if (this.wheel.nativeElement.hasPointerCapture(event.pointerId))
      this.wheel.nativeElement.releasePointerCapture(event.pointerId);
  }
  private applyPointer(event: PointerEvent) {
    const rect = this.wheel.nativeElement.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 450) % 360;
    const saturation = Math.min(1, Math.hypot(dx, dy) / (rect.width * 0.44));
    this.valueChange.emit(hsvToHex(hue, saturation, this.hsv.brightness || 1));
  }
  setBrightness(value: number) {
    this.valueChange.emit(
      hsvToHex(this.hsv.hue, this.hsv.saturation, Number(value) / 100),
    );
  }
  key(event: KeyboardEvent) {
    const direction = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    this.valueChange.emit(
      hsvToHex(
        this.hsv.hue + direction * (event.shiftKey ? 10 : 2),
        this.hsv.saturation || 1,
        this.hsv.brightness || 1,
      ),
    );
  }
}
