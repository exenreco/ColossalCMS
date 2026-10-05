import { Component, EventEmitter, Input, Output } from "@angular/core";
import { PickerChange } from "./picker-base";
import { SpacingPickerComponent } from "./spacing-picker.component";

@Component({
  selector: "cl-margin-picker",
  standalone: true,
  imports: [SpacingPickerComponent],
  template: `<cl-spacing-picker
    kind="margin"
    [settings]="settings"
    (settingChange)="settingChange.emit($event)"
  />`,
})
export class MarginPickerComponent {
  @Input() settings: Record<string, any> = {};
  @Output() settingChange = new EventEmitter<PickerChange>();
}
