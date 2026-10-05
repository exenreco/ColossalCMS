import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  inject,
} from "@angular/core";
import { BlockIconComponent } from "./block-icon.component";
import { BlockNode } from "./theme-models";
import { ThemeEditorState } from "./theme-editor-state";
@Component({
  selector: "cl-theme-block-tree",
  standalone: true,
  imports: [BlockIconComponent],
  template: ` <div
    class="theme-tree-node"
    [class.selected]="state.selected() === node.id"
    [attr.data-block-type]="node.type"
    [attr.data-outline-id]="node.id"
  >
    <div
      class="theme-tree-row"
      [draggable]="!state.protected(node) && !state.onPointerStart"
      (pointerdown)="pointerStart($event)"
      (dragstart)="drag($event)"
      (dragend)="state.onDragEnd()"
      (drop)="rowDrop($event)"
    >
      <button class="theme-node-label" (click)="state.selected.set(node.id)">
        <cl-block-icon
          [icon]="
            node === state.root && !state.part
              ? state.rootLabel === 'Main'
                ? 'fas fa-file-alt'
                : 'fas fa-file-code'
              : state.iconFor(node.type)
          "
        />
        {{ state.label(node) }}
        <small>{{ summary }}</small>
      </button>
      @if (node.type.startsWith("theme/part-")) {
        <button class="button small" (click)="editPart()">Edit part</button>
      }
    </div>
    @if (node.children) {
      <div class="theme-tree-children">
        @for (child of node.children; track child.id; let i = $index) {
          <div
            class="theme-drop-zone"
            [attr.data-drop-parent]="node.id"
            [attr.data-drop-index]="i"
            (drop)="drop($event, i)"
          >
            <span>Drop block here</span>
          </div>
          <cl-theme-block-tree [node]="child" />
        }
        <div
          class="theme-drop-zone"
          [class.empty]="!node.children.length"
          [attr.data-drop-parent]="node.id"
          [attr.data-drop-index]="node.children.length"
          (drop)="drop($event, node.children.length)"
        >
          <span>{{
            node.children.length
              ? "Drop block here"
              : node === state.root && !state.part
                ? state.rootLabel === "Main"
                  ? "Empty main · drop a block here"
                  : "Empty body · drop a block here"
                : "Empty container · drop a block here"
          }}</span>
        </div>
      </div>
    }
  </div>`,
})
export class ThemeBlockTreeComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) node!: BlockNode;
  state = inject(ThemeEditorState);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  // Hover only changes DOM classes. Native listeners keep high-frequency drag
  // events from refreshing every recursive Outline component on each move.
  private dragOver = (e: DragEvent) => {
    const target = (e.target as HTMLElement)?.closest<HTMLElement>(
      ".theme-drop-zone,.theme-tree-row",
    );
    if (target?.closest("cl-theme-block-tree") !== this.host.nativeElement)
      return;
    if (target.matches(".theme-drop-zone"))
      this.over(e, Number(target.dataset["dropIndex"]), this.node.id, target);
    else this.rowOver(e, target);
  };
  private dragLeave = (e: DragEvent) => {
    const target = (e.target as HTMLElement)?.closest<HTMLElement>(
      ".theme-drop-zone,.theme-tree-row",
    );
    if (target?.closest("cl-theme-block-tree") === this.host.nativeElement)
      this.leave(e, target);
  };
  ngAfterViewInit() {
    this.host.nativeElement.addEventListener("dragover", this.dragOver);
    this.host.nativeElement.addEventListener("dragleave", this.dragLeave);
  }
  ngOnDestroy() {
    this.host.nativeElement.removeEventListener("dragover", this.dragOver);
    this.host.nativeElement.removeEventListener("dragleave", this.dragLeave);
  }

  get summary() {
    return String(this.node.settings["text"] || "").slice(0, 45);
  }
  pointerStart(e: PointerEvent) {
    if (
      this.state.movable(this.node) &&
      !(e.target as HTMLElement).closest(".theme-tree-row > .button")
    )
      this.state.onPointerStart?.(e, { id: this.node.id });
  }
  drag(e: DragEvent) {
    e.stopPropagation();
    if (this.state.protected(this.node)) {
      e.preventDefault();
      return;
    }
    this.state.dragSource = { id: this.node.id };
    this.state.onDragStart();
    e.dataTransfer?.setData(
      "application/x-colossal-block",
      JSON.stringify({ id: this.node.id }),
    );
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }
  over(
    e: DragEvent,
    index: number,
    parentId = this.node.id,
    element = e.currentTarget as HTMLElement,
  ) {
    e.stopPropagation();
    const valid = this.state.canDrop(parentId, index);
    if (e.dataTransfer)
      e.dataTransfer.dropEffect = valid
        ? this.state.dragSource?.id
          ? "move"
          : "copy"
        : "none";
    element.classList.toggle("over", valid);
    if (valid) e.preventDefault();
  }
  leave(e: DragEvent, el = e.currentTarget as HTMLElement) {
    if (e.relatedTarget && el.contains(e.relatedTarget as Node)) return;
    el.classList.remove("over");
  }
  rowTarget(e: DragEvent, element = e.currentTarget as HTMLElement) {
    if (this.node.children) {
      let index = this.node.children.length;
      return { parentId: this.node.id, index };
    }
    const parent = this.state.parent(this.node.id);
    if (!parent) return null;
    const rect = element.getBoundingClientRect();
    return {
      parentId: parent.id,
      index:
        parent.children!.indexOf(this.node) +
        (e.clientY >= rect.top + rect.height / 2 ? 1 : 0),
    };
  }
  rowOver(e: DragEvent, element = e.currentTarget as HTMLElement) {
    const target = this.rowTarget(e, element);
    if (target) {
      const parent = this.state.parent(this.node.id);
      element.classList.toggle(
        "drop-before",
        !this.node.children &&
          target.index === parent?.children?.indexOf(this.node),
      );
      this.over(e, target.index, target.parentId, element);
    }
  }
  rowDrop(e: DragEvent) {
    const target = this.rowTarget(e);
    if (target) this.drop(e, target.index, target.parentId);
  }
  drop(e: DragEvent, index: number, parentId = this.node.id) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).classList.remove("over");
    try {
      const source = JSON.parse(
        e.dataTransfer?.getData("application/x-colossal-block") || "{}",
      );
      this.state.dropBlock(parentId, index, source);
    } catch {
      this.state.error = "This item cannot be added as a block.";
    }
    this.state.dragSource = null;
    this.state.onDragEnd();
  }
  editPart() {
    this.state.part = this.node.type.replace("theme/part-", "");
    this.state.selected.set(this.state.root!.id);
    this.state.onChange();
  }
}
