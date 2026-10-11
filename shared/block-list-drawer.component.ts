import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ThemeOutlineComponent } from "./theme-outline.component";

/** Both sidebar presentations share one tree, context menu, and editor API. */
@Component({
  selector: "cl-block-list-drawer",
  standalone: true,
  imports: [ThemeOutlineComponent],
  template: `<cl-theme-outline
    [compact]="true"
    [view]="view"
    (settingsOpen)="settingsOpen.emit()"
  />`,
})
export class BlockListDrawerComponent {
  @Input() view: "list" | "outline" = "list";
  @Output() close = new EventEmitter<void>();
  @Output() settingsOpen = new EventEmitter<void>();
}
