import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
} from "@angular/core";
/** Keeps keyboard focus in the active dialog and restores its trigger on close. */
@Directive({ selector: "[clDialogFocus]", standalone: true })
export class DialogFocusDirective implements AfterViewInit, OnDestroy {
  private host: ElementRef<HTMLElement> = inject(ElementRef);
  private previous = document.activeElement as HTMLElement | null;
  private items() {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]',
      ),
    ).filter((e) => e.getClientRects().length > 0);
  }
  ngAfterViewInit() {
    queueMicrotask(() => {
      const root = this.host.nativeElement;
      (
        root.querySelector<HTMLElement>("[autofocus]") || this.items()[0]
      )?.focus();
    });
  }
  @HostListener("keydown", ["$event"]) onKey(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    const items = this.items();
    const first = items[0],
      last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
  ngOnDestroy() {
    this.previous?.focus();
  }
}
