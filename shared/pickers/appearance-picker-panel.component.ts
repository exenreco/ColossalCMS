import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ColorPickerComponent } from "./color-picker.component";
import { GradientPickerComponent } from "./gradient-picker.component";
import { TypographyPickerComponent } from "./typography-picker.component";
import { PaddingPickerComponent } from "./padding-picker.component";
import { MarginPickerComponent } from "./margin-picker.component";
import { BorderPickerComponent } from "./border-picker.component";
import { LayoutPickerComponent } from "./layout-picker.component";
import { DimensionsPickerComponent } from "./dimensions-picker.component";
import { LinkPickerComponent } from "./link-picker.component";
import { AnimationPickerComponent } from "./animation-picker.component";
import { SlideBackgroundPickerComponent } from "./slide-background-picker.component";
import { PickerChange } from "./picker-base";

/** Shared Inspector surface for theme templates and post/page block content. */
@Component({
  selector: "cl-appearance-picker-panel",
  standalone: true,
  imports: [
    ColorPickerComponent,
    GradientPickerComponent,
    TypographyPickerComponent,
    PaddingPickerComponent,
    MarginPickerComponent,
    BorderPickerComponent,
    LayoutPickerComponent,
    DimensionsPickerComponent,
    LinkPickerComponent,
    AnimationPickerComponent,
    SlideBackgroundPickerComponent,
  ],
  template: `
    <div class="cl-appearance-panel" aria-label="Appearance pickers">
      <h3>Appearance</h3>
      @if (textBlock) {
        <cl-typography-picker
          [settings]="settings"
          (settingChange)="settingChange.emit($event)"
        />
      }
      <cl-color-picker
        label="Text color"
        [value]="settings['color'] || ''"
        [palette]="palette"
        (valueChange)="emit('color', $event)"
      />
      <cl-color-picker
        label="Background color"
        [value]="settings['background'] || ''"
        [palette]="palette"
        (valueChange)="emit('background', $event)"
      />
      <cl-gradient-picker
        [settings]="settings"
        [palette]="palette"
        (settingChange)="settingChange.emit($event)"
      />
      @if (blockType === "core/slide") {
        <cl-slide-background-picker
          [settings]="settings"
          (settingChange)="settingChange.emit($event)"
        />
      }
      @if (layoutBlock) {
        <cl-layout-picker
          [settings]="settings"
          [blockType]="blockType"
          (settingChange)="settingChange.emit($event)"
        />
      }
      <cl-dimensions-picker
        [settings]="settings"
        [blockType]="blockType"
        (settingChange)="settingChange.emit($event)"
      />
      <cl-padding-picker
        [settings]="settings"
        (settingChange)="settingChange.emit($event)"
      />
      <cl-margin-picker
        [settings]="settings"
        (settingChange)="settingChange.emit($event)"
      />
      <cl-border-picker
        [settings]="settings"
        [palette]="palette"
        (settingChange)="settingChange.emit($event)"
      />
      @if (blockType === "core/image" || settings["link"] !== undefined) {
        <cl-link-picker
          [settings]="settings"
          (settingChange)="settingChange.emit($event)"
        />
      }
      @if (blockType !== "core/slider") {
        <cl-animation-picker
          [settings]="settings"
          (settingChange)="settingChange.emit($event)"
        />
      }
    </div>
  `,
})
export class AppearancePickerPanelComponent {
  @Input() settings: Record<string, any> = {};
  @Input() blockType = "";
  @Input() palette: string[] = [];
  @Output() settingChange = new EventEmitter<PickerChange>();
  get textBlock() {
    return [
      "core/heading",
      "core/rich-text",
      "core/post-content",
      "core/content",
    ].includes(this.blockType);
  }
  get layoutBlock() {
    return [
      "core/container",
      "core/group",
      "core/row",
      "core/column",
      "core/columns",
      "core/slide",
      "core/overlay",
    ].includes(this.blockType);
  }
  emit(key: string, value: unknown) {
    this.settingChange.emit({ key, value });
  }
}

/** Keys edited by the shared pickers, hidden from generated plain Inspector fields. */
export const PICKER_FIELD_KEYS = new Set([
  "color",
  "background",
  "borderColor",
  "borderWidth",
  "radius",
  "link",
  "maxWidth",
  "minHeight",
  "minHeightEnabled",
  "minHeightUnit",
]);
