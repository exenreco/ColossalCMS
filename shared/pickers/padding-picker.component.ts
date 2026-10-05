import { Component, EventEmitter, Input, Output } from "@angular/core";
import { PickerChange } from "./picker-base";
import { SpacingPickerComponent } from "./spacing-picker.component";

@Component({
  selector: "cl-padding-picker",
  standalone: true,
  imports: [SpacingPickerComponent],
  template: `<cl-spacing-picker
    kind="padding"
    [settings]="settings"
    (settingChange)="settingChange.emit($event)"
  />`,
})
export class PaddingPickerComponent {
  @Input() settings: Record<string, any> = {};
  @Output() settingChange = new EventEmitter<PickerChange>();
}
