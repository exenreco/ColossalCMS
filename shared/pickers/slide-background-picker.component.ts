import { Component, inject, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MediaSelectionService } from "../media-selection.service";
import { PickerBase } from "./picker-base";
import { PickerPopoverComponent } from "./picker-popover.component";

/** Media background controls shared by the theme and content block inspectors. */
@Component({
  selector: "cl-slide-background-picker",
  standalone: true,
  imports: [FormsModule, PickerPopoverComponent],
  template: `
    <cl-picker-popover label="Slide background" badge="▧">
      <div class="cl-picker-body">
        <label class="cl-picker-field"
          >Type
          <select [ngModel]="type" (ngModelChange)="changeType($event)">
            <option value="none">None</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="model">3D model (glTF)</option>
          </select>
        </label>
        @if (type !== "none") {
          <button type="button" class="button small" (click)="chooseMedia()">
            {{
              settings["backgroundMediaId"] ? "Change media" : "Choose media"
            }}
          </button>
          @if (settings["backgroundMediaId"]) {
            <button
              type="button"
              class="button small"
              (click)="set('backgroundMediaId', '')"
            >
              Clear media
            </button>
          }
          <label class="cl-picker-field"
            >Or HTTPS URL
            <input
              type="url"
              placeholder="https://example.com/media"
              [ngModel]="settings['backgroundUrl'] || ''"
              (ngModelChange)="changeUrl($event)"
            />
          </label>
          @if (type !== "model") {
            <label class="cl-picker-field"
              >Size
              <select
                [ngModel]="settings['backgroundSize'] || 'cover'"
                (ngModelChange)="set('backgroundSize', $event)"
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="auto">Original size</option>
              </select>
            </label>
          }
          <label class="cl-picker-field"
            >Horizontal position
            <select
              [ngModel]="settings['backgroundPositionX'] || 'center'"
              (ngModelChange)="set('backgroundPositionX', $event)"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label class="cl-picker-field"
            >Vertical position
            <select
              [ngModel]="settings['backgroundPositionY'] || 'center'"
              (ngModelChange)="set('backgroundPositionY', $event)"
            >
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>
          @if (type === "image") {
            <label class="cl-picker-field"
              >Repeat
              <select
                [ngModel]="settings['backgroundRepeat'] || 'no-repeat'"
                (ngModelChange)="set('backgroundRepeat', $event)"
              >
                <option value="no-repeat">No repeat</option>
                <option value="repeat">Repeat</option>
                <option value="repeat-x">Repeat horizontally</option>
                <option value="repeat-y">Repeat vertically</option>
              </select>
            </label>
          }
          @if (type === "video") {
            <label class="cl-picker-field cl-picker-checkbox"
              >Loop
              <input
                type="checkbox"
                [ngModel]="settings['backgroundLoop'] !== false"
                (ngModelChange)="set('backgroundLoop', $event)"
              />
            </label>
            <p class="field-note">
              Background video plays muted and without controls.
            </p>
          }
          @if (type === "model") {
            <label class="cl-picker-field cl-picker-checkbox"
              >Auto rotate
              <input
                type="checkbox"
                [ngModel]="settings['backgroundAutoRotate'] === true"
                (ngModelChange)="set('backgroundAutoRotate', $event)"
              />
            </label>
            <p class="field-note">
              The model sits behind slide blocks; camera controls are disabled.
            </p>
          }
        }
      </div>
    </cl-picker-popover>
  `,
})
export class SlideBackgroundPickerComponent extends PickerBase {
  private media = inject(MediaSelectionService);
  @ViewChild(PickerPopoverComponent) popover?: PickerPopoverComponent;
  get type(): "none" | "image" | "video" | "model" {
    return ["image", "video", "model"].includes(this.settings["backgroundType"])
      ? this.settings["backgroundType"]
      : "none";
  }
  changeType(type: string) {
    this.set("backgroundType", type);
    this.set("backgroundMediaId", "");
    this.set("backgroundUrl", "");
  }
  changeUrl(url: string) {
    this.set("backgroundUrl", url);
    if (url) this.set("backgroundMediaId", "");
  }
  async chooseMedia() {
    const type = this.type;
    if (type === "none") return;
    this.popover?.close();
    const [item] = await this.media.open({
      accept: [type],
      initialSelectionIds: [this.settings["backgroundMediaId"]].filter(Boolean),
    });
    if (item) {
      this.set("backgroundMediaId", item.id);
      this.set("backgroundUrl", "");
    }
  }
}
