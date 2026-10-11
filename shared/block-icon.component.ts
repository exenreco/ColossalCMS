import { Component, Input } from "@angular/core";

import { iconDrawing } from "./icon-catalog";
@Component({
  selector: "cl-block-icon",
  standalone: true,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    @for (d of drawing; track d) {
      <path [attr.d]="d" />
    }
  </svg>`,
  styles: [
    ":host{display:inline-flex;width:18px;height:18px;flex:none}svg{width:100%;height:100%}",
  ],
})
export class BlockIconComponent {
  @Input() icon = "";
  get drawing() {
    return iconDrawing(this.icon);
  }
}
