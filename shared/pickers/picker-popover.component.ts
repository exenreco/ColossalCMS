import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  ViewChild,
} from "@angular/core";

/** Top-layer picker panel. Keeps controls visible when the Inspector scrolls. */
@Component({
  selector: "cl-picker-popover",
  standalone: true,
  template: `
    <button
      #trigger
      type="button"
      class="cl-picker-trigger"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open"
      [attr.aria-label]="label"
      (click)="toggle()"
    >
      <span
        class="cl-picker-badge"
        [class.cl-color-badge]="!!swatch"
        [style.background]="swatch || null"
        >{{ swatch ? "" : badge }}</span
      >
      <span>{{ label }}</span
      ><span class="cl-picker-chevron" aria-hidden="true">⌄</span>
    </button>
    <div
      #panel
      class="cl-picker-popover"
      popover="manual"
      role="dialog"
      tabindex="-1"
      [attr.aria-label]="label + ' picker'"
      [style.left.px]="left"
      [style.top.px]="top"
      [style.width.px]="width"
    >
      <div class="cl-picker-popover-heading">
        <strong>{{ label }}</strong>
        <button
          type="button"
          aria-label="Close {{ label }} picker"
          (click)="close(true)"
        >
          ×
        </button>
      </div>
      <ng-content />
    </div>
  `,
})
export class PickerPopoverComponent implements OnDestroy {
  @Input() label = "Picker";
  @Input() badge = "";
  @Input() swatch = "";
  @ViewChild("trigger") trigger!: ElementRef<HTMLButtonElement>;
  @ViewChild("panel") panel!: ElementRef<HTMLDivElement>;
  private static active?: PickerPopoverComponent;
  open = false;
  left = 0;
  top = 0;
  width = 320;
  private scrollHandler = () => this.position();

  toggle() {
    this.open ? this.close() : this.show();
  }
  show() {
    PickerPopoverComponent.active?.close();
    this.open = true;
    PickerPopoverComponent.active = this;
    this.panel.nativeElement.showPopover();
    this.position();
    document.addEventListener("scroll", this.scrollHandler, true);
    this.panel.nativeElement.focus();
  }
  close(restoreFocus = false) {
    if (!this.open) return;
    this.open = false;
    this.panel.nativeElement.hidePopover();
    document.removeEventListener("scroll", this.scrollHandler, true);
    if (PickerPopoverComponent.active === this)
      PickerPopoverComponent.active = undefined;
    if (restoreFocus) this.trigger.nativeElement.focus();
  }
  position() {
    if (!this.open) return;
    const anchor = this.trigger.nativeElement.getBoundingClientRect();
    const panel = this.panel.nativeElement;
    this.width = Math.min(340, window.innerWidth - 24);
    const height = Math.min(panel.scrollHeight, window.innerHeight - 24);
    if (anchor.left >= this.width + 20) {
      this.left = anchor.left - this.width - 8;
      this.top = Math.max(
        12,
        Math.min(anchor.top, window.innerHeight - height - 12),
      );
    } else if (window.innerWidth - anchor.right >= this.width + 20) {
      this.left = anchor.right + 8;
      this.top = Math.max(
        12,
        Math.min(anchor.top, window.innerHeight - height - 12),
      );
    } else {
      this.left = Math.max(
        12,
        Math.min(anchor.left, window.innerWidth - this.width - 12),
      );
      this.top =
        anchor.bottom + 8 + height <= window.innerHeight
          ? anchor.bottom + 8
          : Math.max(12, anchor.top - height - 8);
    }
  }
  @HostListener("document:pointerdown", ["$event"])
  outside(event: PointerEvent) {
    if (
      this.open &&
      !this.trigger.nativeElement.contains(event.target as Node) &&
      !this.panel.nativeElement.contains(event.target as Node)
    )
      this.close();
  }
  @HostListener("document:keydown.escape", ["$event"])
  escape(event: Event) {
    if (this.open) {
      event.stopImmediatePropagation();
      this.close(true);
    }
  }
  @HostListener("window:resize")
  resized() {
    this.position();
  }
  @HostListener("window:scroll")
  scrolled() {
    this.position();
  }
  ngOnDestroy() {
    this.close();
  }
}
