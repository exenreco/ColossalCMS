import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgTemplateOutlet } from "@angular/common";
import { BlockDefinition } from "./theme-models";
import { BlockIconComponent } from "./block-icon.component";
import { ApiService } from "./api.service";

/**
 * Session-persistent block library contents, hosted in the editor's left drawer.
 */
@Component({
  selector: "cl-block-library-drawer",
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, BlockIconComponent],
  template: `
    @if (open) {
      <div
        class="block-library"
        role="region"
        aria-label="Block library"
        #panel
        (mousedown)="$event.stopPropagation()"
        (scroll)="rememberScroll()"
      >
        <div class="drawer-heading">
          <strong>Blocks</strong
          ><button
            class="button toolbar-icon"
            aria-label="Close Blocks"
            title="Close Blocks (Escape)"
            (click)="dismiss.emit()"
          >
            <cl-block-icon icon="fas fa-times" />
          </button>
        </div>
        <input
          class="block-library__search"
          placeholder="Search blocks…"
          aria-label="Search blocks"
          [(ngModel)]="search"
        />
        <div class="block-library__scroll">
          @if (columnsSelected) {
            <p role="note">Columns accepts Column blocks only.</p>
          }
          @if (!search && recentBlocks.length) {
            <section class="block-library__group">
              <h3>Recent</h3>
              @for (b of recentBlocks; track b.type) {
                <ng-container
                  [ngTemplateOutlet]="row"
                  [ngTemplateOutletContext]="{ b: b }"
                />
              }
            </section>
          }
          @for (group of groups; track group.name) {
            <section class="block-library__group">
              <button
                type="button"
                class="block-library__heading"
                [attr.aria-expanded]="!collapsed.has(group.name)"
                (click)="toggle(group.name)"
              >
                {{ group.name }} <span>{{ group.blocks.length }}</span>
              </button>
              @if (!collapsed.has(group.name)) {
                @for (b of group.blocks; track b.type) {
                  <ng-container
                    [ngTemplateOutlet]="row"
                    [ngTemplateOutletContext]="{ b: b }"
                  />
                }
              }
            </section>
          }
          @if (!filtered.length) {
            <p class="block-library__empty">No blocks match your search.</p>
          }
        </div>
      </div>
      <ng-template #row let-b="b">
        <button
          type="button"
          class="block-library__block"
          [style.opacity]="
            columnsSelected && b.type !== 'core/column' ? 0.6 : 1
          "
          [disabled]="b.type === 'core/column' && !columnsSelected"
          draggable="false"
          (pointerdown)="pointerStart.emit({ event: $event, type: b.type })"
          [attr.data-library-block]="b.type"
          (dragstart)="start($event, b.type)"
          (dragend)="end.emit()"
          (click)="choose.emit(b.type)"
        >
          <cl-block-icon [icon]="b.icon || 'fas fa-block'" />
          <span
            ><strong>{{ b.label }}</strong
            ><small>{{ description(b) }}</small></span
          >
        </button>
      </ng-template>
    }
  `,
})
export class BlockLibraryDrawerComponent {
  private api = inject(ApiService);
  private visible(block: BlockDefinition) {
    return (
      !block.legacy &&
      (!block.pluginId ||
        this.api
          .state()
          ?.plugins.some((p) => p.id === block.pluginId && p.active))
    );
  }
  @Input() open = false;
  @Input() columnsSelected = false;
  @Input() blocks: BlockDefinition[] = [];
  @Input() recent: string[] = [];
  @Output() dismiss = new EventEmitter<void>();
  @Output() choose = new EventEmitter<string>();
  @Output() pointerStart = new EventEmitter<{
    event: PointerEvent;
    type: string;
  }>();
  @Output() dragStart = new EventEmitter<DragEvent>();
  @Output() end = new EventEmitter<void>();
  private panel?: ElementRef<HTMLElement>;
  @ViewChild("panel") set panelRef(ref: ElementRef<HTMLElement> | undefined) {
    this.panel = ref;
    if (ref) {
      const top = Number(sessionStorage.getItem(this.key) || 0);
      requestAnimationFrame(() => {
        if (ref.nativeElement.isConnected) ref.nativeElement.scrollTop = top;
      });
    }
  }
  search = "";
  collapsed = new Set<string>(["Theme", "Plugin"]);
  private key = "colossal.block-library.scroll";
  description(block: BlockDefinition) {
    return (
      block.description ||
      (block.container
        ? "Group and arrange nested blocks"
        : "Add " + block.label.toLowerCase() + " to your layout")
    );
  }
  get filtered() {
    const q = this.search.trim().toLowerCase();
    const visible = [
      ...new Map(
        this.blocks.filter((b) => this.visible(b)).map((b) => [b.type, b]),
      ).values(),
    ];
    return q
      ? visible.filter((b) =>
          (b.label + " " + b.category + " " + b.type).toLowerCase().includes(q),
        )
      : visible;
  }
  get groups() {
    const map = new Map<string, BlockDefinition[]>();
    for (const b of this.filtered) {
      const name = b.category || "Blocks";
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(b);
    }
    return [...map.entries()].map(([name, blocks]) => ({ name, blocks }));
  }
  get recentBlocks() {
    return this.recent
      .map((type) =>
        this.blocks.find((b) => b.type === type && this.visible(b)),
      )
      .filter((b): b is BlockDefinition => !!b);
  }
  toggle(name: string) {
    this.collapsed.has(name)
      ? this.collapsed.delete(name)
      : this.collapsed.add(name);
  }
  start(event: DragEvent, type: string) {
    event.dataTransfer?.setData(
      "application/x-colossal-block",
      JSON.stringify({ type }),
    );
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
    this.dragStart.emit(event);
  }
  rememberScroll() {
    const el = this.panel?.nativeElement;
    if (el) sessionStorage.setItem(this.key, String(el.scrollTop));
  }
}
