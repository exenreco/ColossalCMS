import {
  Component,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  effect,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

/** Low-fidelity placeholders that mirror the shape of incoming content. */
export type SkeletonVariant =
  | "text"
  | "heading"
  | "paragraph"
  | "circle"
  | "rectangle"
  | "card"
  | "table-row"
  | "grid"
  | "form"
  | "custom";

export type SkeletonAnimation = "glare" | "pulse" | "none";

export interface SkeletonOptions {
  variant: SkeletonVariant;
  count?: number;
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  animate?: boolean;
  animation?: SkeletonAnimation;
  respectMotionPreference?: boolean;
  ariaLabel?: string;
  ariaLive?: "polite" | "off";
}

/** The skeleton is never shown for less than this, to avoid a flash read as a glitch. */
export const SKELETON_MIN_DISPLAY_MS = 300;
/** An indefinitely shimmering screen is a lie; after this we surface a retry. */
export const SKELETON_MAX_DISPLAY_MS = 10000;

const lengths = (value: string | number | undefined) =>
  value === undefined || value === "" || value === null
    ? undefined
    : typeof value === "number"
      ? value + "px"
      : value;

/**
 * A single shared skeleton used by both applications. The glare runs on the
 * compositor only (`transform`) and honours `prefers-reduced-motion`.
 */
@Component({
  selector: "cl-skeleton",
  standalone: true,
  host: {
    class: "cl-skeleton",
    "[class.cl-skeleton--paused]": "!visible()",
    "[attr.data-animation]": "animation()",
    "[attr.aria-hidden]": "ariaLabel() ? null : 'true'",
    "[attr.aria-label]": "ariaLabel() || null",
  },
  template: `
    @switch (variant()) {
      @case ("custom") {
        <ng-content />
      }
      @case ("heading") {
        @for (i of items(1); track i) {
          <span
            class="cl-skel cl-skel-heading"
            [style.width]="lengths(width()) || '60%'"
            [style.height]="lengths(height()) || '1.6em'"
            [style.border-radius]="lengths(radius())"
          ></span>
        }
      }
      @case ("paragraph") {
        @for (i of items(count() ?? 3); track i) {
          <span
            class="cl-skel cl-skel-line"
            [class.cl-skel-line--short]="i === (count() ?? 3) - 1"
            [style.height]="lengths(height()) || '0.85em'"
            [style.border-radius]="lengths(radius())"
          ></span>
        }
      }
      @case ("circle") {
        @for (i of items(count() ?? 1); track i) {
          <span
            class="cl-skel cl-skel-circle"
            [style.width]="lengths(width()) || lengths(height()) || '44px'"
            [style.height]="lengths(height()) || lengths(width()) || '44px'"
            [style.border-radius]="'50%'"
          ></span>
        }
      }
      @case ("rectangle") {
        @for (i of items(count() ?? 1); track i) {
          <span
            class="cl-skel cl-skel-rectangle"
            [style.width]="lengths(width()) || '100%'"
            [style.height]="lengths(height()) || '160px'"
            [style.border-radius]="lengths(radius())"
          ></span>
        }
      }
      @case ("card") {
        @for (i of items(count() ?? 1); track i) {
          <span class="cl-skel-card">
            <span
              class="cl-skel cl-skel-rectangle"
              [style.height]="lengths(height()) || '150px'"
              [style.border-radius]="lengths(radius())"
            ></span>
            <span class="cl-skel cl-skel-line cl-skel-line--title"></span>
            <span class="cl-skel cl-skel-line"></span>
            <span class="cl-skel cl-skel-line cl-skel-line--short"></span>
          </span>
        }
      }
      @case ("table-row") {
        @for (i of items(count() ?? 4); track i) {
          <span class="cl-skel-table-row">
            <span class="cl-skel cl-skel-cell cl-skel-cell--lead"></span>
            @for (cell of items(columns); track cell) {
              <span class="cl-skel cl-skel-cell"></span>
            }
          </span>
        }
      }
      @case ("grid") {
        <span
          class="cl-skeleton-grid"
          [style.grid-template-columns]="
            'repeat(' + columns + ', minmax(0, 1fr))'
          "
        >
          @for (i of items(count() ?? columns); track i) {
            <span class="cl-skel-card">
              <span
                class="cl-skel cl-skel-rectangle"
                [style.height]="lengths(height()) || '140px'"
                [style.border-radius]="lengths(radius())"
              ></span>
              <span class="cl-skel cl-skel-line cl-skel-line--title"></span>
              <span class="cl-skel cl-skel-line"></span>
            </span>
          }
        </span>
      }
      @case ("form") {
        @for (i of items(count() ?? 3); track i) {
          <span class="cl-skel cl-skel-field">
            <span class="cl-skel cl-skel-line cl-skel-line--label"></span>
            <span
              class="cl-skel cl-skel-input"
              [style.border-radius]="lengths(radius())"
            ></span>
          </span>
        }
      }
      @default {
        @for (i of items(count() ?? 1); track i) {
          <span
            class="cl-skel cl-skel-line"
            [style.width]="lengths(width()) || '100%'"
            [style.height]="lengths(height()) || '1em'"
            [style.border-radius]="lengths(radius())"
          ></span>
        }
      }
    }
  `,
})
export class SkeletonComponent implements AfterViewInit, OnDestroy {
  variant = input<SkeletonVariant>("text");
  count = input<number | undefined>(undefined);
  width = input<string | number | undefined>(undefined);
  height = input<string | number | undefined>(undefined);
  radius = input<string | number | undefined>(undefined);
  animation = input<SkeletonAnimation>("glare");
  respectMotionPreference = input(true);
  ariaLabel = input("");
  visible = signal(true);
  lengths = lengths;
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;
  get columns() {
    return this.width() ? Number(this.width()) : 3;
  }
  items(n: number) {
    return Array.from(
      { length: Math.max(1, Math.min(50, Math.floor(n) || 1)) },
      (_, i) => i,
    );
  }
  ngAfterViewInit() {
    if (typeof IntersectionObserver === "undefined") return;
    this.observer = new IntersectionObserver((entries) => {
      this.visible.set(entries.some((e) => e.isIntersecting));
    });
    this.observer.observe(this.host.nativeElement);
  }
  ngOnDestroy() {
    this.observer?.disconnect();
  }
}

/**
 * Wraps an async region: renders a skeleton immediately, enforces the minimum
 * display window, times out into a retry state, and announces loading to AT.
 */
@Component({
  selector: "cl-skeleton-region",
  standalone: true,
  host: { class: "cl-region" },
  template: `
    <div
      class="cl-skeleton-region"
      [attr.aria-busy]="busy()"
      [class.cl-skeleton-region--error]="timedOut()"
    >
      <span class="cl-visually-hidden" role="status" aria-live="polite">
        {{ loading() ? label() : loadedLabel() }}
      </span>
      @if (timedOut()) {
        <div class="cl-skeleton-error" role="alert">
          <p>{{ error() || "This is taking longer than expected." }}</p>
          <button class="button" type="button" (click)="retry.emit()">
            Try again
          </button>
        </div>
      } @else {
        <div
          class="cl-skeleton-region__skeleton"
          [class.cl-skeleton-region__skeleton--hidden]="!show()"
        >
          <ng-content select="[skeleton]" />
        </div>
        <div
          class="cl-skeleton-region__content"
          [class.cl-skeleton-region__content--hidden]="show()"
        >
          <ng-content />
        </div>
      }
    </div>
  `,
})
export class SkeletonRegionComponent implements OnDestroy {
  loading = input(false);
  minMs = input(SKELETON_MIN_DISPLAY_MS);
  maxMs = input(SKELETON_MAX_DISPLAY_MS);
  label = input("Loading…");
  loadedLabel = input("Content loaded.");
  error = input("");
  retry = output<void>();
  show = signal(false);
  busy = signal(false);
  timedOut = signal(false);
  private started = 0;
  private minTimer?: ReturnType<typeof setTimeout>;
  private maxTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    effect(() => {
      const loading = this.loading();
      clearTimeout(this.maxTimer);
      if (loading) {
        this.started = Date.now();
        this.timedOut.set(false);
        this.busy.set(true);
        this.show.set(true);
        this.maxTimer = setTimeout(() => {
          if (this.loading()) this.timedOut.set(true);
        }, this.maxMs());
        return;
      }
      this.busy.set(false);
      const wait = Math.max(0, this.minMs() - (Date.now() - this.started));
      this.minTimer = setTimeout(() => this.show.set(false), wait);
    });
  }
  ngOnDestroy() {
    clearTimeout(this.minTimer);
    clearTimeout(this.maxTimer);
  }
}

/** Resolves the skeleton declaration for a manifest variant, with a generic fallback. */
export function resolveSkeletonForRoute(variant?: string): {
  variant: SkeletonVariant;
  count?: number;
} {
  const map: Record<string, { variant: SkeletonVariant; count?: number }> = {
    table: { variant: "table-row", count: 6 },
    grid: { variant: "grid", count: 6 },
    form: { variant: "form", count: 4 },
    detail: { variant: "rectangle", count: 1 },
  };
  return map[variant || ""] || { variant: "paragraph", count: 3 };
}
