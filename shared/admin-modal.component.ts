import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  OnInit,
  OnDestroy,
} from "@angular/core";
import { DialogFocusDirective } from "./dialog-focus.directive";
import { IconComponent } from "./icon.component";

/** Admin details drawer with a blurred backdrop, focus trap and projected content. */
@Component({
  selector: "cl-admin-modal",
  standalone: true,
  imports: [DialogFocusDirective, IconComponent],
  template: `
    <div class="admin-modal-overlay" (click)="backdrop($event)">
      <section
        class="admin-modal"
        clDialogFocus
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title"
        [attr.aria-busy]="busy"
        [style.max-width.px]="width"
      >
        <header class="admin-modal-header">
          <span class="admin-modal-icon"><cl-icon [name]="icon" /></span>
          <div>
            <h2>{{ title }}</h2>
            @if (description) {
              <p>{{ description }}</p>
            }
          </div>
          <button
            type="button"
            class="icon-button"
            [attr.aria-label]="'Close ' + title"
            [disabled]="busy"
            (click)="dismiss()"
          >
            <cl-icon name="close" />
          </button>
        </header>
        <div class="admin-modal-body"><ng-content /></div>
      </section>
    </div>
  `,
})
export class AdminModalComponent implements OnInit, OnDestroy {
  private previousOverflow = "";
  private previousRootOverflow = "";
  ngOnInit() {
    this.previousOverflow = document.body.style.overflow;
    this.previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  ngOnDestroy() {
    document.body.style.overflow = this.previousOverflow;
    document.documentElement.style.overflow = this.previousRootOverflow;
  }
  @Input() title = "Details";
  @Input() description = "";
  @Input() icon = "edit";
  @Input() busy = false;
  @Input() width = 520;
  @Output() dismissed = new EventEmitter<void>();
  dismiss() {
    if (!this.busy) this.dismissed.emit();
  }
  backdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) this.dismiss();
  }
  @HostListener("document:keydown.escape", ["$event"])
  escape(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.dismiss();
  }
}
