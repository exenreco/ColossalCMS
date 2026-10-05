import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PickerBase } from "./picker-base";
import { PickerPopoverComponent } from "./picker-popover.component";

@Component({
  selector: "cl-link-picker",
  standalone: true,
  imports: [FormsModule, PickerPopoverComponent],
  template: `
    <cl-picker-popover label="Link" badge="↗">
      <div class="cl-picker-body">
        <label class="cl-picker-field"
          >URL
          <input
            type="url"
            [ngModel]="settings['link'] || ''"
            (ngModelChange)="set('link', $event)"
            placeholder="https:// or /page"
          />
        </label>
        <div class="cl-picker-actions" role="tablist" aria-label="Link state">
          @for (option of states; track option) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="state === option"
              (click)="state = option"
            >
              {{ option }}
            </button>
          }
        </div>
        <label class="cl-picker-field"
          >{{ state }} color
          <input
            type="color"
            [ngModel]="color"
            (ngModelChange)="changeColor($event)"
          />
          <input
            [ngModel]="settings['linkColors']?.[state] || ''"
            (ngModelChange)="changeColor($event)"
            placeholder="Inherit"
          />
        </label>
        <label class="cl-picker-field"
          >Decoration
          <select
            [ngModel]="settings['linkDecoration'] || ''"
            (ngModelChange)="set('linkDecoration', $event)"
          >
            <option value="">Inherit</option>
            <option value="none">None</option>
            <option value="underline">Underline</option>
          </select>
        </label>
      </div>
    </cl-picker-popover>
  `,
})
export class LinkPickerComponent extends PickerBase {
  states = ["Link", "Active", "Visited", "Hover"];
  state = "Link";
  get color() {
    return this.settings["linkColors"]?.[this.state] || "#111827";
  }
  changeColor(value: string) {
    if (value === "" || /^#[\da-f]{6}$/i.test(value))
      this.set("linkColors", {
        ...(this.settings["linkColors"] || {}),
        [this.state]: value,
      });
  }
}
