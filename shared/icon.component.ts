import { Component, Input } from "@angular/core";
import { APP_ICON_PATHS as paths } from "./icon-catalog";
@Component({
  selector: "cl-icon",
  standalone: true,
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path"/></svg>',
  styles: [
    ":host{display:inline-flex;width:20px;height:20px;flex:none}svg{width:100%;height:100%}",
  ],
})
export class IconComponent {
  @Input() name = "pages";
  get path() {
    return paths[this.name] || paths["plugins"];
  }
}
