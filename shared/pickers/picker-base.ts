import { Directive, EventEmitter, Input, Output } from "@angular/core";

export interface PickerChange {
  key: string;
  value: unknown;
}

/** Common controlled-input contract: the editor owns settings and undo history. */
@Directive()
export abstract class PickerBase {
  @Input() settings: Record<string, any> = {};
  @Output() settingChange = new EventEmitter<PickerChange>();

  set(key: string, value: unknown) {
    this.settingChange.emit({ key, value });
  }

  number(value: unknown, fallback = 0) {
    const result = Number(value);
    return Number.isFinite(result) ? result : fallback;
  }
}
