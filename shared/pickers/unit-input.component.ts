import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";

type UnitKind = "length" | "time";

/** A numeric picker with a persisted, selectable CSS unit. Legacy numbers mean px or ms. */
@Component({
  selector: "cl-unit-input",
  standalone: true,
  imports: [FormsModule],
  template: `
    <span class="cl-unit-input" [class.cl-unit-input--slider]="slider">
      @if (slider) {
        <input
          type="range"
          [attr.aria-label]="label + ' slider'"
          [min]="minimum"
          [max]="maximum"
          [step]="step"
          [ngModel]="amount"
          [disabled]="isAuto"
          (ngModelChange)="changeAmount($event)"
        />
      }
      <span class="cl-unit-input__value">
        <input
          type="number"
          [attr.aria-label]="label"
          [min]="minimum"
          [max]="maximum"
          [step]="step"
          [ngModel]="isAuto ? null : amount"
          (ngModelChange)="changeAmount($event)"
        />
        <select
          [attr.aria-label]="label + ' unit'"
          [ngModel]="unit"
          (ngModelChange)="changeUnit($event)"
        >
          @if (allowAuto) {
            <option value="auto">Auto</option>
          }
          @for (option of units; track option) {
            <option [value]="option">{{ option }}</option>
          }
        </select>
      </span>
    </span>
  `,
})
export class UnitInputComponent {
  @Input() value: number | string | null | undefined;
  @Input() label = "Value";
  @Input() kind: UnitKind = "length";
  @Input() slider = false;
  @Input() min = 0;
  @Input() max = 100;
  @Input() fallback = 0;
  @Input() allowAuto = false;
  @Output() valueChange = new EventEmitter<number | string>();

  get units() {
    return this.kind === "time"
      ? ["ms", "s"]
      : ["px", "rem", "em", "%", "vw", "vh"];
  }
  get parsed() {
    if (
      this.allowAuto &&
      (this.value == null || this.value === "" || this.value === "auto")
    )
      return { amount: this.fallback, unit: "auto" };
    if (typeof this.value === "number")
      return { amount: this.value, unit: this.units[0] };
    const match = String(this.value ?? "")
      .trim()
      .match(/^(-?\d+(?:\.\d+)?)(px|rem|em|%|vw|vh|ms|s)$/);
    return match && this.units.includes(match[2])
      ? { amount: Number(match[1]), unit: match[2] }
      : { amount: this.fallback, unit: this.units[0] };
  }
  get amount() {
    return this.parsed.amount;
  }
  get unit() {
    return this.parsed.unit;
  }
  get isAuto() {
    return this.allowAuto && this.unit === "auto";
  }
  get minimum() {
    return this.isAuto || this.unit === this.units[0]
      ? this.min
      : Math.min(0, this.min);
  }
  get maximum() {
    if (this.kind === "time" && this.unit === "s") return this.max / 1000;
    if (this.isAuto || this.unit === this.units[0]) return this.max;
    return this.unit === "%" ? 1000 : 100;
  }
  get step() {
    return this.kind === "time" && this.unit === "s" ? 0.05 : "any";
  }
  changeAmount(value: number) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    this.emit(
      Math.max(this.minimum, Math.min(this.maximum, number)),
      this.isAuto ? this.units[0] : this.unit,
    );
  }
  changeUnit(unit: string) {
    if (this.allowAuto && unit === "auto") {
      this.valueChange.emit("auto");
      return;
    }
    if (!this.units.includes(unit)) return;
    const amount =
      this.kind === "time"
        ? this.unit === "ms" && unit === "s"
          ? this.amount / 1000
          : this.unit === "s" && unit === "ms"
            ? this.amount * 1000
            : this.amount
        : this.amount;
    const maximum =
      this.kind === "time" && unit === "s"
        ? this.max / 1000
        : unit === this.units[0]
          ? this.max
          : unit === "%"
            ? 1000
            : 100;
    const minimum = unit === this.units[0] ? this.min : Math.min(0, this.min);
    this.emit(Math.max(minimum, Math.min(maximum, amount)), unit);
  }
  private emit(amount: number, unit: string) {
    const rounded = Math.round(amount * 100) / 100;
    this.valueChange.emit(
      unit === this.units[0] ? rounded : `${rounded}${unit}`,
    );
  }
}
