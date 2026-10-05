import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PickerBase } from "./picker-base";
import { PickerPopoverComponent } from "./picker-popover.component";
import { UnitInputComponent } from "./unit-input.component";

@Component({
  selector: "cl-animation-picker",
  standalone: true,
  imports: [FormsModule, PickerPopoverComponent, UnitInputComponent],
  template: `
    <cl-picker-popover label="Animate" badge="S">
      <div class="cl-picker-body">
        <div
          class="cl-picker-actions"
          role="tablist"
          aria-label="Animation phase"
        >
          @for (option of phases; track option) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="phase === option"
              (click)="phase = option"
            >
              {{ option }}
            </button>
          }
        </div>
        <div class="cl-animation-preview">
          <span
            [class]="'cl-animate-' + preset"
            [style.animation-duration.ms]="duration"
            [style.animation-iteration-count]="current.loop ? 'infinite' : '1'"
            >Preview</span
          >
        </div>
        <label class="cl-picker-field"
          >Event
          <select
            [ngModel]="current.event || 'load'"
            (ngModelChange)="update('event', $event)"
          >
            <option value="load">Load</option>
            <option value="hover">Hover</option>
            <option value="focus">Focus</option>
          </select>
        </label>
        <label class="cl-picker-field"
          >Preset
          <select [ngModel]="preset" (ngModelChange)="update('preset', $event)">
            <option value="none">None</option>
            <option value="fade">Fade</option>
            <option value="slide">Slide</option>
            <option value="scale">Scale</option>
          </select>
        </label>
        <label class="cl-picker-field"
          >Ease
          <select
            [ngModel]="current.ease || 'ease'"
            (ngModelChange)="update('ease', $event)"
          >
            <option value="ease">Ease</option>
            <option value="linear">Linear</option>
            <option value="ease-in">Ease in</option>
            <option value="ease-out">Ease out</option>
            <option value="cubic-bezier(.17,.67,.83,.67)">Cubic Bezier</option>
          </select>
        </label>
        @for (timing of timings; track timing.key) {
          <label class="cl-picker-field"
            >{{ timing.label }}
            <cl-unit-input
              [label]="timing.label"
              kind="time"
              [slider]="true"
              [min]="0"
              [max]="3000"
              [fallback]="timing.default"
              [value]="current[timing.key]"
              (valueChange)="update(timing.key, $event)"
            />
          </label>
        }
        <label class="cl-picker-field cl-picker-checkbox"
          >Loop animation
          <input
            type="checkbox"
            [ngModel]="current.loop || false"
            (ngModelChange)="update('loop', $event)"
          />
        </label>
      </div>
    </cl-picker-popover>
  `,
})
export class AnimationPickerComponent extends PickerBase {
  phases = ["In", "Working", "Out"];
  phase = "In";
  timings = [
    { key: "delay", label: "Delay", default: 0 },
    { key: "duration", label: "Duration", default: 500 },
  ];
  get current() {
    return this.settings["animations"]?.[this.phase] || {};
  }
  get preset() {
    return this.current.preset || "none";
  }
  get duration() {
    const value = this.current.duration ?? 500;
    return typeof value === "string" && /^\d+(?:\.\d+)?s$/.test(value)
      ? Number(value.slice(0, -1)) * 1000
      : this.number(value, 500);
  }
  update(key: string, value: unknown) {
    this.set("animations", {
      ...(this.settings["animations"] || {}),
      [this.phase]: { ...this.current, [key]: value },
    });
  }
}
