import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
} from "@angular/core";

/** Shared top-layer surface: anchored menus/popovers or a native modal dialog. */
@Component({
  selector: "cl-ui-surface",
  standalone: true,
  template: `<dialog
    #panel
    class="cl-ui-surface"
    [class.cl-ui-modal]="kind === 'modal'"
    [class.cl-ui-menu]="kind === 'menu'"
    [class.cl-ui-pointed]="pointed"
    [class]="
      'cl-ui-surface ' +
      panelClass +
      (kind === 'modal' ? ' cl-ui-modal' : kind === 'menu' ? ' cl-ui-menu' : '')
    "
    [attr.popover]="kind === 'modal' ? null : 'manual'"
    [attr.role]="kind === 'menu' ? 'menu' : 'dialog'"
    [attr.aria-label]="label"
    [attr.data-color-mode]="colorMode"
    [style.width.px]="width"
    [style.left.px]="kind === 'modal' ? null : left"
    [style.top.px]="kind === 'modal' ? null : top"
    (cancel)="cancel($event)"
    (click)="backdrop($event)"
    (keydown)="keys($event)"
  >
    @if (pointed) {
      <svg
        class="cl-ui-surface-caret"
        aria-hidden="true"
        width="16"
        height="9"
        viewBox="0 0 16 9"
      >
        <path d="M0 9L8 1l8 8" />
      </svg>
    }
    <div #content class="cl-ui-surface-content"><ng-content /></div>
  </dialog>`,
})
export class UiSurfaceComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() open = false;
  @Input() kind: "menu" | "popover" | "modal" = "popover";
  @Input() anchor?: HTMLElement;
  @Input() point?: { x: number; y: number };
  @Input() label = "Editor menu";
  @Input() colorMode?: "light" | "dark";
  @Input() panelClass = "";
  @Input() width = 340;
  @Input() placement: "bottom" | "side" = "bottom";
  @Input() arrow = false;
  @Input() restoreFocus = true;
  @Output() dismissed = new EventEmitter<void>();
  @ViewChild("panel") panel!: ElementRef<HTMLDialogElement>;
  @ViewChild("content") content!: ElementRef<HTMLDivElement>;
  left = 12;
  top = 12;
  private mounted = false;
  private shown = false;
  private destroyed = false;
  private previous?: HTMLElement;
  private observer?: ResizeObserver;
  private static active?: UiSurfaceComponent;
  private reposition = () => this.position();
  get pointed() {
    return (
      this.arrow &&
      !!this.anchor &&
      !this.point &&
      this.placement === "bottom" &&
      this.kind !== "modal"
    );
  }
  ngAfterViewInit() {
    this.mounted = true;
    this.sync();
  }
  ngOnChanges() {
    if (this.mounted)
      queueMicrotask(() => {
        if (!this.destroyed) this.sync();
      });
  }
  private sync() {
    const panel = this.panel.nativeElement;
    if (this.open && !this.shown) {
      UiSurfaceComponent.active?.dismiss(false);
      UiSurfaceComponent.active = this;
      this.previous = document.activeElement as HTMLElement;
      this.shown = true;
      if (this.kind === "modal") panel.showModal();
      else panel.showPopover();
      this.position();
      this.observer = new ResizeObserver(this.reposition);
      this.observer.observe(panel);
      document.addEventListener("scroll", this.reposition, true);
      (
        panel.querySelector<HTMLElement>("[autofocus]") ||
        (this.kind === "modal"
          ? panel.querySelector<HTMLElement>("input,textarea,select")
          : null) ||
        panel.querySelector<HTMLElement>(
          "[autofocus],input,button,[tabindex='0'],textarea,select",
        ) ||
        panel
      ).focus();
    } else if (!this.open && this.shown) this.hide();
    else if (this.shown) this.position();
  }
  private hide(restoreFocus = true) {
    if (!this.shown) return;
    this.shown = false;
    const panel = this.panel.nativeElement;
    if (this.kind === "modal") panel.close();
    else panel.hidePopover();
    this.observer?.disconnect();
    document.removeEventListener("scroll", this.reposition, true);
    if (UiSurfaceComponent.active === this)
      UiSurfaceComponent.active = undefined;
    if (restoreFocus && this.restoreFocus && this.previous?.isConnected)
      (this.anchor || this.previous).focus();
  }
  dismiss(restoreFocus = true) {
    this.hide(restoreFocus);
    this.dismissed.emit();
  }
  cancel(event: Event) {
    event.preventDefault();
    this.dismiss();
  }
  backdrop(event: MouseEvent) {
    if (this.kind !== "modal" || event.target !== this.panel.nativeElement)
      return;
    const r = this.panel.nativeElement.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      this.dismiss(false);
  }
  position() {
    if (!this.shown || this.kind === "modal") return;
    const r = this.anchor?.getBoundingClientRect();
    const p = this.panel.nativeElement;
    const width = Math.min(this.width, window.innerWidth - 24);
    p.style.width = width + "px";
    const content = this.content.nativeElement;
    if (this.pointed && r) {
      const gap = 12;
      const below = Math.max(0, window.innerHeight - 12 - r.bottom - gap);
      const above = Math.max(0, r.top - gap - 12);
      const naturalHeight = content.scrollHeight + 2;
      const flipped = naturalHeight > below && above > below;
      // Keep scrolling inside the panel so the pointer can extend beyond its border.
      content.style.maxHeight = Math.max(32, flipped ? above : below) + "px";
      const height = p.offsetHeight;
      this.left = Math.max(
        12,
        Math.min(r.left, window.innerWidth - width - 12),
      );
      this.top = Math.max(12, flipped ? r.top - height - gap : r.bottom + gap);
      p.dataset.caretSide = flipped ? "bottom" : "top";
      p.style.setProperty(
        "--cl-surface-caret-left",
        Math.max(18, Math.min(r.left + r.width / 2 - this.left, width - 18)) +
          "px",
      );
      p.style.left = this.left + "px";
      p.style.top = this.top + "px";
      return;
    }
    content.style.maxHeight = "";
    delete p.dataset.caretSide;
    const height = Math.min(p.scrollHeight, window.innerHeight - 24);
    let left = this.point?.x ?? r?.left ?? 12,
      top = this.point?.y ?? (r?.bottom || 4) + 8;
    if (
      !this.point &&
      r &&
      this.placement === "side" &&
      window.innerWidth - r.right >= width + 20
    ) {
      left = r.right + 10;
      top = r.top;
    } else if (
      !this.point &&
      r &&
      this.placement === "side" &&
      r.left >= width + 20
    ) {
      left = r.left - width - 10;
      top = r.top;
    } else if (!this.point && r && top + height > window.innerHeight - 12)
      top = r.top - height - 8;
    this.left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    this.top = Math.max(12, Math.min(top, window.innerHeight - height - 12));
    // Resize/scroll callbacks may run outside Angular; position the native top-layer surface directly.
    p.style.left = this.left + "px";
    p.style.top = this.top + "px";
  }
  keys(event: KeyboardEvent) {
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.dismiss();
    }
    if (
      this.kind !== "menu" ||
      !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    )
      return;
    const items = Array.from(
      this.panel.nativeElement.querySelectorAll<HTMLElement>(
        "button:not([disabled]),a[href],[role='menuitem']",
      ),
    );
    if (!items.length) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (index + (event.key === "ArrowUp" ? -1 : 1) + items.length) %
            items.length
    ].focus();
  }
  @HostListener("document:pointerdown", ["$event"]) outside(
    event: PointerEvent,
  ) {
    if (
      this.shown &&
      this.kind !== "modal" &&
      !this.panel.nativeElement.contains(event.target as Node) &&
      !this.anchor?.contains(event.target as Node)
    )
      this.dismiss(false);
  }
  @HostListener("window:resize") resized() {
    this.position();
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.hide();
  }
}
