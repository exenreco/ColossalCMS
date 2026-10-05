import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PickerBase } from "./picker-base";
import { PickerPopoverComponent } from "./picker-popover.component";
import { UnitInputComponent } from "./unit-input.component";

@Component({
  selector: "cl-typography-picker",
  standalone: true,
  imports: [FormsModule, PickerPopoverComponent, UnitInputComponent],
  template: `
    <cl-picker-popover label="Typography" badge="T">
      <div class="cl-picker-body">
        <div
          class="cl-picker-actions"
          role="group"
          aria-label="Text formatting"
        >
          @for (tool of tools; track tool.key) {
            <button
              type="button"
              [attr.aria-label]="tool.label"
              [attr.aria-pressed]="!!settings[tool.key]"
              (click)="set(tool.key, !settings[tool.key])"
            >
              {{ tool.glyph }}
            </button>
          }
        </div>
        <label class="cl-picker-field"
          >Face
          <select
            [ngModel]="settings['fontFamily'] || ''"
            (ngModelChange)="set('fontFamily', $event)"
          >
            <option value="">Inherit</option>
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="system-ui">System UI</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="monospace">Monospace</option>
          </select>
        </label>
        <label class="cl-picker-field"
          >Font size
          <cl-unit-input
            label="Font size"
            [slider]="true"
            [min]="8"
            [max]="96"
            [fallback]="16"
            [value]="settings['fontSize']"
            (valueChange)="set('fontSize', $event)"
          />
        </label>
        <div class="cl-picker-field">
          Alignment
          <div
            class="cl-picker-actions"
            role="group"
            aria-label="Text alignment"
          >
            @for (option of alignments; track option) {
              <button
                type="button"
                [attr.aria-label]="'Align ' + option"
                [attr.aria-pressed]="(settings['align'] || 'left') === option"
                (click)="set('align', option)"
              >
                {{
                  option === "left"
                    ? "☰"
                    : option === "center"
                      ? "≡"
                      : option === "right"
                        ? "☷"
                        : "▤"
                }}
              </button>
            }
          </div>
        </div>
        <label class="cl-picker-field"
          >Line height
          <cl-unit-input
            label="Line height"
            [slider]="true"
            [min]="10"
            [max]="160"
            [fallback]="24"
            [value]="settings['lineHeight']"
            (valueChange)="set('lineHeight', $event)"
          />
        </label>
        <label class="cl-picker-field"
          >Text indent
          <cl-unit-input
            label="Text indent"
            [slider]="true"
            [min]="0"
            [max]="120"
            [value]="settings['textIndent']"
            (valueChange)="set('textIndent', $event)"
          />
        </label>
      </div>
    </cl-picker-popover>
  `,
})
export class TypographyPickerComponent extends PickerBase {
  tools = [
    { key: "bold", label: "Bold", glyph: "B" },
    { key: "italic", label: "Italic", glyph: "I" },
    { key: "underline", label: "Underline", glyph: "U" },
    { key: "strike", label: "Strikethrough", glyph: "S" },
  ];
  alignments = ["left", "center", "right", "justify"];
}
