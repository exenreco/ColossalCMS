import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  inject,
} from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { BlockIconComponent } from "./block-icon.component";
import { IconComponent } from "./icon.component";
import { BlockNode } from "./theme-models";
import { ThemeEditorState } from "./theme-editor-state";
import { ThemeOutlineApi } from "./theme-outline-api";
import { outlineSummary } from "./outline-document";

@Component({
  selector: "cl-theme-block-tree",
  standalone: true,
  imports: [NgTemplateOutlet, BlockIconComponent, IconComponent],
  template: `@if (childrenOnly) {
      <ng-container [ngTemplateOutlet]="childList" />
    } @else {
      <div
        class="theme-tree-node"
        [class.selected]="state.selected() === node.id"
        [attr.data-block-type]="node.type"
        [attr.data-outline-id]="node.id"
      >
        <div
          class="theme-tree-row"
          role="treeitem"
          [attr.aria-label]="api.label(node)"
          [attr.aria-level]="depth + 1"
          [attr.aria-selected]="state.selected() === node.id"
          [attr.aria-expanded]="
            node.children ? !api.isCollapsed(node.id) : null
          "
          [tabIndex]="
            state.selected() === node.id ||
            ((!state.node || state.node === state.root) &&
              node === state.root?.children?.[0])
              ? 0
              : -1
          "
          [draggable]="state.movable(node) && !state.onPointerStart"
          (pointerdown)="pointerStart($event)"
          (dragstart)="drag($event)"
          (dragend)="state.onDragEnd()"
          (drop)="rowDrop($event)"
          (contextmenu)="menu($event)"
          (focus)="api.dispatch({ type: 'select', id: node.id })"
        >
          @if (node.children) {
            <button
              class="outline-expand"
              type="button"
              tabindex="-1"
              [class.expanded]="!api.isCollapsed(node.id)"
              [attr.aria-label]="
                (api.isCollapsed(node.id) ? 'Expand ' : 'Collapse ') +
                api.label(node)
              "
              [attr.aria-expanded]="!api.isCollapsed(node.id)"
              (click)="api.toggle(node.id)"
            >
              <cl-icon name="chevron" />
            </button>
          } @else {
            <span class="outline-expand-spacer"></span>
          }
          <button
            class="outline-node-icon"
            type="button"
            tabindex="-1"
            [attr.aria-label]="'Select ' + api.label(node)"
            (click)="select($event)"
          >
            <cl-block-icon [icon]="api.icon(node)" />
          </button>
          @if (api.renaming() === node.id) {
            <input
              #rename
              class="outline-rename"
              aria-label="Block label"
              [value]="api.label(node)"
              maxlength="80"
              (pointerdown)="$event.stopPropagation()"
              (keydown.enter)="saveLabel(rename.value, $event)"
              (keydown.escape)="cancelRename($event)"
              (blur)="saveLabel(rename.value)"
            />
          } @else {
            <button
              class="theme-node-label"
              type="button"
              tabindex="-1"
              (click)="select($event)"
              (dblclick)="rename()"
            >
              <span>{{ api.label(node) }}</span>
              @if (summary) {
                <small>{{ summary }}</small>
              }
            </button>
          }
          <div class="outline-row-actions">
            @if (node.type.startsWith("theme/part-")) {
              <button
                type="button"
                class="outline-part-action"
                tabindex="-1"
                title="Edit shared part"
                aria-label="Edit shared part"
                (click)="api.dispatch({ type: 'edit-part', id: node.id })"
              >
                <cl-icon name="external" />
              </button>
            }
            <button
              type="button"
              class="outline-add"
              tabindex="-1"
              [attr.aria-label]="'Add block near ' + api.label(node)"
              title="Add block"
              (click)="menu($event, 'insert')"
            >
              <cl-icon name="plus" />
            </button>
            <button
              type="button"
              class="outline-more"
              tabindex="-1"
              [attr.aria-label]="'Actions for ' + api.label(node)"
              title="Block actions"
              (click)="menu($event)"
            >
              <cl-block-icon icon="fas fa-ellipsis-h" />
            </button>
            @if (state.movable(node)) {
              <span class="outline-grip" aria-hidden="true"
                ><cl-block-icon icon="fas fa-grip-vertical"
              /></span>
            }
          </div>
        </div>
        @if (node.children) {
          <div
            class="outline-branch"
            [class.collapsed]="api.isCollapsed(node.id)"
            [attr.inert]="api.isCollapsed(node.id) ? '' : null"
            [attr.aria-hidden]="api.isCollapsed(node.id)"
          >
            <div class="theme-tree-children" role="group">
              <ng-container [ngTemplateOutlet]="childList" />
            </div>
          </div>
        }
      </div>
    }
    <ng-template #childList>
      @for (child of node.children || []; track child.id; let i = $index) {
        <div
          class="theme-drop-zone"
          [attr.data-drop-parent]="node.id"
          [attr.data-drop-index]="i"
          (drop)="drop($event, i)"
        >
          <span>Insert here</span>
        </div>
        <cl-theme-block-tree
          [node]="child"
          [depth]="childrenOnly ? 0 : depth + 1"
        />
      }
      <div
        class="theme-drop-zone"
        [class.empty]="!node.children?.length"
        [attr.data-drop-parent]="node.id"
        [attr.data-drop-index]="node.children?.length || 0"
        (drop)="drop($event, node.children?.length || 0)"
      >
        <span>{{
          node.children?.length ? "Insert here" : "Drop a block here, or use +"
        }}</span>
      </div>
    </ng-template>`,
})
export class ThemeBlockTreeComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) node!: BlockNode;
  @Input() depth = 0;
  @Input() childrenOnly = false;
  state = inject(ThemeEditorState);
  api = inject(ThemeOutlineApi);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private expandTimer?: ReturnType<typeof setTimeout>;
  @ViewChild("rename") set renameInput(
    input: ElementRef<HTMLInputElement> | undefined,
  ) {
    if (input)
      queueMicrotask(() => {
        input.nativeElement.focus();
        input.nativeElement.select();
      });
  }
  get summary() {
    return outlineSummary(this.node);
  }
  select(event: Event) {
    event.stopPropagation();
    this.api.dispatch({ type: "select", id: this.node.id });
    (event.target as HTMLElement)
      .closest<HTMLElement>(".theme-tree-row")
      ?.focus();
  }
  rename() {
    if (this.node !== this.state.root) this.api.renaming.set(this.node.id);
  }
  saveLabel(value: string, event?: Event) {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.api.renaming() !== this.node.id) return;
    if (
      value.trim() &&
      this.api.dispatch({ type: "rename", id: this.node.id, label: value })
    ) {
      this.api.renaming.set("");
      this.focusRow();
    }
  }
  cancelRename(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.api.renaming.set("");
    this.focusRow();
  }
  private focusRow() {
    queueMicrotask(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>(".theme-tree-row")
        ?.focus(),
    );
  }
  menu(event: MouseEvent, mode = "actions") {
    event.preventDefault();
    event.stopPropagation();
    this.api.dispatch({ type: "select", id: this.node.id });
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    this.host.nativeElement.dispatchEvent(
      new CustomEvent("cl-outline-menu", {
        bubbles: true,
        detail: {
          id: this.node.id,
          x: event.type === "contextmenu" ? event.clientX : rect.left,
          y: event.type === "contextmenu" ? event.clientY : rect.bottom + 6,
          mode,
          anchor: button,
        },
      }),
    );
  }
  private dragOver = (event: DragEvent) => {
    const target = (event.target as HTMLElement)?.closest<HTMLElement>(
      ".theme-drop-zone,.theme-tree-row",
    );
    if (target?.closest("cl-theme-block-tree") !== this.host.nativeElement)
      return;
    if (target.matches(".theme-drop-zone"))
      this.over(
        event,
        Number(target.dataset["dropIndex"]),
        this.node.id,
        target,
      );
    else this.rowOver(event, target);
  };
  private dragLeave = (event: DragEvent) => {
    const target = (event.target as HTMLElement)?.closest<HTMLElement>(
      ".theme-drop-zone,.theme-tree-row",
    );
    if (
      target?.closest("cl-theme-block-tree") === this.host.nativeElement &&
      (!event.relatedTarget || !target.contains(event.relatedTarget as Node))
    ) {
      target.classList.remove("over", "drop-before", "drop-after");
      clearTimeout(this.expandTimer);
      this.expandTimer = undefined;
    }
  };
  ngAfterViewInit() {
    this.host.nativeElement.addEventListener("dragover", this.dragOver);
    this.host.nativeElement.addEventListener("dragleave", this.dragLeave);
  }
  ngOnDestroy() {
    clearTimeout(this.expandTimer);
    this.host.nativeElement.removeEventListener("dragover", this.dragOver);
    this.host.nativeElement.removeEventListener("dragleave", this.dragLeave);
  }
  pointerStart(event: PointerEvent) {
    if (
      this.state.movable(this.node) &&
      !(event.target as HTMLElement).closest(
        "input,.outline-expand,.outline-row-actions button",
      )
    )
      this.state.onPointerStart?.(event, { id: this.node.id });
  }
  drag(event: DragEvent) {
    event.stopPropagation();
    if (!this.state.movable(this.node)) {
      event.preventDefault();
      return;
    }
    this.state.dragSource = { id: this.node.id };
    this.state.onDragStart();
    event.dataTransfer?.setData(
      "application/x-colossal-block",
      JSON.stringify({ id: this.node.id }),
    );
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }
  over(
    event: DragEvent,
    index: number,
    parentId = this.node.id,
    element = event.currentTarget as HTMLElement,
  ) {
    event.stopPropagation();
    const valid = this.state.canDrop(parentId, index);
    if (event.dataTransfer)
      event.dataTransfer.dropEffect = valid
        ? this.state.dragSource?.id
          ? "move"
          : "copy"
        : "none";
    element.classList.toggle("over", valid);
    if (valid) event.preventDefault();
    return valid;
  }
  rowTarget(event: DragEvent, element = event.currentTarget as HTMLElement) {
    const parent = this.state.parent(this.node.id),
      rect = element.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;
    if (this.node.children && (!parent || (ratio >= 0.25 && ratio <= 0.75)))
      return {
        parentId: this.node.id,
        index: this.node.children.length,
        position: "inside",
      };
    if (!parent?.children) return null;
    const after = ratio >= 0.5;
    return {
      parentId: parent.id,
      index: parent.children.indexOf(this.node) + (after ? 1 : 0),
      position: after ? "after" : "before",
    };
  }
  rowOver(event: DragEvent, element: HTMLElement) {
    const target = this.rowTarget(event, element);
    if (!target) return;
    element.classList.toggle("drop-before", target.position === "before");
    element.classList.toggle("drop-after", target.position === "after");
    const valid = this.over(event, target.index, target.parentId, element);
    if (
      valid &&
      target.position === "inside" &&
      this.api.isCollapsed(this.node.id) &&
      !this.expandTimer
    )
      this.expandTimer = setTimeout(() => {
        this.api.dispatch({ type: "expand", id: this.node.id });
        this.expandTimer = undefined;
      }, 600);
  }
  rowDrop(event: DragEvent) {
    const target = this.rowTarget(event);
    if (target) this.drop(event, target.index, target.parentId);
  }
  drop(event: DragEvent, index: number, parentId = this.node.id) {
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(this.expandTimer);
    (event.currentTarget as HTMLElement).classList.remove(
      "over",
      "drop-before",
      "drop-after",
    );
    try {
      const source = JSON.parse(
        event.dataTransfer?.getData("application/x-colossal-block") || "{}",
      );
      if (this.state.canDrop(parentId, index, source))
        this.api.dispatch(
          source.id
            ? { type: "move", id: source.id, parentId, index }
            : { type: "insert", blockType: source.type, parentId, index },
        );
    } catch {
      this.state.error = "This item cannot be added as a block.";
    }
    this.state.dragSource = null;
    this.state.onDragEnd();
  }
}
