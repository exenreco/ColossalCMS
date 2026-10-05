import { Component, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PickerBase } from "./picker-base";
import { UnitInputComponent } from "./unit-input.component";

@Component({
  selector: "cl-spacing-picker",
  standalone: true,
  imports: [FormsModule, UnitInputComponent],
  template: `
    <details class="cl-picker">
      <summary>
        <span class="cl-picker-badge">{{ kind === "padding" ? "P" : "M" }}</span
        >{{ kind === "padding" ? "Padding" : "Margin" }}
      </summary>
      <div class="cl-picker-body">
        <div class="cl-spacing-diagram" [attr.aria-label]="kind + ' by side'">
          @for (side of sides; track side) {
            <label [class]="'cl-spacing-' + side">
              <span class="sr-only">{{ side }}</span>
              <cl-unit-input
                [label]="side + ' ' + kind"
                [min]="kind === 'padding' ? 0 : -240"
                [max]="240"
                [allowAuto]="true"
                [value]="settings[kind]?.[side]"
                (valueChange)="update(side, $event)"
              />
            </label>
          }
          <span class="cl-spacing-center">Content</span>
        </div>
      </div>
    </details>
  `,
})
export class SpacingPickerComponent extends PickerBase {
  @Input() kind: "padding" | "margin" = "padding";
  sides = ["top", "right", "bottom", "left"];
  update(side: string, value: number | string) {
    this.set(this.kind, {
      ...(this.settings[this.kind] || {}),
      [side]: value,
    });
  }
}
