import { Component, Input } from "@angular/core";
import { EDITOR_ICON_PATHS } from "./icon-catalog";

@Component({
  selector: "cl-editor-icon",
  standalone: true,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.35"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path [attr.d]="paths[name] || paths['settings']" />
  </svg>`,
  styles: [
    ":host{display:inline-flex;width:22px;height:22px;flex-shrink:0}svg{width:100%;height:100%}",
  ],
})
export class EditorIconComponent {
  @Input() name = "settings";
  paths = EDITOR_ICON_PATHS;
}
