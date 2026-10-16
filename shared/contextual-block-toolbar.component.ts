import { mergeTableCells, splitTableCells } from "./table-block";
import { tableTreeData, setTableTreeData } from "./table-tree";
import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ThemeEditorState } from "./theme-editor-state";
import { ThemeOutlineApi } from "./theme-outline-api";
import { BlockIconComponent } from "./block-icon.component";
import { modelFieldVisible } from "./model-field-visibility";
import { EditorIconComponent } from "./editor-icon.component";

/** Floating controls share the Inspector's state and undo journal. */
@Component({
  selector: "cl-contextual-block-toolbar",
  standalone: true,
  imports: [FormsModule, BlockIconComponent, EditorIconComponent],
  template: `@if (state.node; as node) {
    <div
      class="contextual-block-toolbar"
      role="toolbar"
      [attr.aria-label]="'Block tools for ' + state.label(node)"
      (keydown)="keys($event)"
      (mousedown)="$event.stopPropagation()"
      (click)="$event.stopPropagation()"
    >
      <div class="block-toolbar-identity" [title]="state.label(node)">
        <cl-block-icon [icon]="state.iconFor(node.type)" />
      </div>
      <div class="block-toolbar-tools">
        <button
          class="toolbar-icon tool-prev"
          aria-label="Previous block tools"
          title="Previous block tools"
          [disabled]="!canScrollBack"
          (click)="scrollTools(-1)"
        >
          <cl-editor-icon name="chevron" />
        </button>
        <div #tools class="block-toolbar-scroll" (scroll)="updateScroll()">
          @if (node.type.startsWith("theme/part-")) {
            <button
              class="button small"
              aria-label="Edit shared content"
              (click)="editPart(node.type.slice(11))"
            >
              Edit shared content
            </button>
          }
          @if (textBlock) {
            @for (tool of formats; track tool[0]) {
              <button
                class="button small"
                [attr.aria-label]="tool[0]"
                [title]="tool[0]"
                [attr.aria-pressed]="!!node.settings[tool[1]]"
                (click)="format.emit(tool[1])"
              >
                {{ tool[2] }}
              </button>
            }
            <button
              class="button small"
              aria-label="Link"
              title="Link (Ctrl/Cmd+K)"
              (click)="format.emit('link')"
            >
              🔗
            </button>
            <span class="editor-toolbar-select"
              ><select
                aria-label="Alignment"
                [ngModel]="node.settings['align'] || 'left'"
                (ngModelChange)="state.set('align', $event)"
              >
                <option>left</option>
                <option>center</option>
                <option>right</option></select
              ><cl-editor-icon class="editor-select-chevron" name="chevron"
            /></span>
            <input
              type="color"
              aria-label="Text color"
              title="Text color"
              [ngModel]="node.settings['color'] || '#243e2f'"
              (ngModelChange)="state.set('color', $event)"
            />
          }
          @for (field of fields; track field.key) {
            @if (field.type === "select") {
              <span class="editor-toolbar-select"
                ><select
                  [attr.aria-label]="field.label"
                  [title]="field.label"
                  [ngModel]="node.settings[field.key] ?? field.default"
                  (ngModelChange)="state.set(field.key, $event)"
                >
                  @for (option of field.options; track option) {
                    <option>{{ option }}</option>
                  }</select
                ><cl-editor-icon class="editor-select-chevron" name="chevron"
              /></span>
            } @else if (field.type === "checkbox") {
              <button
                class="button small"
                [attr.aria-label]="field.label"
                [attr.aria-pressed]="
                  !!(node.settings[field.key] ?? field.default)
                "
                (click)="
                  state.set(
                    field.key,
                    !(node.settings[field.key] ?? field.default)
                  )
                "
              >
                {{ field.label }}
              </button>
            } @else if (field.type === "number") {
              <label
                >{{ field.label
                }}<input
                  type="number"
                  [attr.aria-label]="field.label"
                  [ngModel]="node.settings[field.key] ?? field.default"
                  (ngModelChange)="state.set(field.key, $event)"
              /></label>
            } @else if (field.type === "text") {
              <input
                type="text"
                [attr.aria-label]="field.label"
                [title]="field.label"
                [placeholder]="field.label"
                [ngModel]="node.settings[field.key] ?? field.default"
                (ngModelChange)="state.set(field.key, $event)"
              />
            }
          }
          @if (["core/image", "core/media", "core/gltf"].includes(node.type)) {
            <button
              class="button small"
              aria-label="Replace media"
              title="Replace media"
              (click)="
                replace.emit(
                  node.type === 'core/gltf'
                    ? node.settings['source'] === 'portrait'
                      ? 'image'
                      : 'model'
                    : node.type === 'core/image'
                      ? 'image'
                      : 'media'
                )
              "
            >
              Replace
            </button>
          }
          @if (tableForTools) {
            <button
              class="button small"
              [disabled]="!canEditTableCells('merge')"
              (click)="editTableCells('merge')"
            >
              Merge cells
            </button>
            <button
              class="button small"
              [disabled]="!canEditTableCells('split')"
              (click)="editTableCells('split')"
            >
              Split cell
            </button>
          }
          @if (node.type === "core/table") {
            <button
              class="button small"
              (click)="state.insert('core/table-header', node.id, 0)"
              [disabled]="hasTableSection('core/table-header')"
            >
              Add header
            </button>
            <button
              class="button small"
              (click)="
                state.insert(
                  'core/table-body',
                  node.id,
                  node.children?.length &&
                    node.children!.at(-1)?.type === 'core/table-footer'
                    ? node.children!.length - 1
                    : node.children?.length
                )
              "
            >
              Add body
            </button>
            <button
              class="button small"
              (click)="state.insert('core/table-footer', node.id)"
              [disabled]="hasTableSection('core/table-footer')"
            >
              Add footer
            </button>
          }
          @if (
            [
              "core/table-header",
              "core/table-body",
              "core/table-footer",
            ].includes(node.type)
          ) {
            <button
              class="button small"
              (click)="state.insert('core/table-row', node.id)"
            >
              Add row
            </button>
          }
          @if (node.type === "core/table-row") {
            <button
              class="button small"
              (click)="state.insert('core/table-cell', node.id)"
            >
              Add cell
            </button>
          }
          @if (node.type === "core/columns") {
            <button
              class="button small"
              (click)="state.insert('core/column', node.id)"
            >
              Add column
            </button>
            <button class="button small" (click)="state.removeLastColumn()">
              Remove column
            </button>
          }
        </div>
        <button
          class="toolbar-icon tool-next"
          aria-label="Next block tools"
          title="Next block tools"
          [disabled]="!canScrollForward"
          (click)="scrollTools(1)"
        >
          <cl-editor-icon name="chevron" />
        </button>
      </div>
      <div class="block-toolbar-actions">
        <button
          class="toolbar-icon"
          aria-label="Duplicate block"
          title="Duplicate block"
          (click)="state.duplicate()"
        >
          <cl-editor-icon name="duplicate" />
        </button>
        <button
          class="toolbar-icon"
          [attr.aria-label]="backwardLabel"
          [title]="backwardLabel"
          [disabled]="!canMove(-1)"
          (click)="move(-1)"
        >
          <cl-editor-icon
            [name]="moveLayout.horizontal ? 'arrow-left' : 'arrow-up'"
          />
        </button>
        <button
          class="toolbar-icon"
          [attr.aria-label]="forwardLabel"
          [title]="forwardLabel"
          [disabled]="!canMove(1)"
          (click)="move(1)"
        >
          <cl-editor-icon
            [name]="moveLayout.horizontal ? 'arrow-right' : 'arrow-down'"
          />
        </button>
        <button
          class="toolbar-icon"
          aria-label="Copy block"
          title="Copy block"
          (click)="outline.dispatch({ type: 'copy', id: state.selected() })"
        >
          <cl-editor-icon name="copy" />
        </button>
        <button
          class="toolbar-icon"
          aria-label="Paste block"
          title="Paste block after selection"
          [disabled]="!canPaste"
          (click)="
            outline.dispatch({ type: 'paste-after', id: state.selected() })
          "
        >
          <cl-editor-icon name="paste" />
        </button>
        <button
          class="toolbar-icon"
          aria-label="Delete block"
          title="Delete block"
          (click)="state.remove()"
        >
          <cl-editor-icon name="trash" />
        </button>
        <button
          class="toolbar-icon block-toolbar-drag"
          draggable="true"
          aria-label="Drag block"
          title="Drag block"
          (dragstart)="drag($event)"
          (dragend)="state.onDragEnd()"
        >
          <cl-editor-icon name="grip" />
        </button>
      </div>
    </div>
  }`,
})
export class ContextualBlockToolbarComponent
  implements AfterViewInit, OnDestroy
{
  get tableForTools() {
    let node = this.state.node;
    while (node && node.type !== "core/table")
      node = this.state.parent(node.id);
    return node;
  }
  canEditTableCells(operation: "merge" | "split") {
    const table = this.tableForTools,
      range = this.state.tableSelection();
    if (!table || range?.id !== table.id) return false;
    const data = tableTreeData(table);
    try {
      if (operation === "merge") {
        mergeTableCells(data, range);
        return true;
      }
      return splitTableCells(data, range).merges.length < data.merges.length;
    } catch {
      return false;
    }
  }
  editTableCells(operation: "merge" | "split") {
    const table = this.tableForTools,
      range = this.state.tableSelection();
    if (!table || range?.id !== table.id) return;
    this.state.commit(() => {
      const data = (operation === "merge" ? mergeTableCells : splitTableCells)(
        tableTreeData(table),
        range,
      );
      if (table.children) setTableTreeData(table, data);
      else table.settings["tableData"] = data;
    });
  }
  hasTableSection(type: string) {
    return !!this.state.node?.children?.some(
      (section) => section.type === type,
    );
  }

  state = inject(ThemeEditorState);
  outline = inject(ThemeOutlineApi);
  get canPaste() {
    this.outline.snapshot();
    return this.outline.canRun("paste-after", this.state.selected());
  }
  private cdr = inject(ChangeDetectorRef);
  @Input() moveLayout = { horizontal: false, reversed: false };
  @ViewChild("tools") tools?: ElementRef<HTMLElement>;
  canScrollBack = false;
  canScrollForward = false;
  private observer?: ResizeObserver;
  private contentObserver?: MutationObserver;
  ngAfterViewInit() {
    this.observer = new ResizeObserver(() => this.updateScroll());
    if (this.tools) {
      this.observer.observe(this.tools.nativeElement);
      for (const child of Array.from(this.tools.nativeElement.children))
        this.observer.observe(child);
      this.contentObserver = new MutationObserver(() => {
        for (const child of Array.from(this.tools!.nativeElement.children))
          this.observer?.observe(child);
        this.updateScroll();
      });
      this.contentObserver.observe(this.tools.nativeElement, {
        childList: true,
        subtree: true,
      });
    }
    queueMicrotask(() => this.updateScroll());
  }
  ngOnDestroy() {
    this.observer?.disconnect();
    this.contentObserver?.disconnect();
  }
  updateScroll() {
    const el = this.tools?.nativeElement;
    this.canScrollBack = !!el && el.scrollLeft > 1;
    this.canScrollForward =
      !!el && el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    this.cdr.markForCheck();
  }
  scrollTools(direction: number) {
    const el = this.tools?.nativeElement;
    el?.scrollBy({
      left: direction * Math.max(100, el.clientWidth * 0.75),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  get backwardLabel() {
    return this.moveLayout.horizontal ? "Move block left" : "Move block up";
  }
  get forwardLabel() {
    return this.moveLayout.horizontal ? "Move block right" : "Move block down";
  }
  canMove(direction: number) {
    const node = this.state.node;
    const parent = node && this.state.parent(node.id);
    if (!node || !parent?.children || !this.state.movable(node)) return false;
    const target =
      parent.children.indexOf(node) +
      (this.moveLayout.reversed ? -direction : direction);
    return target >= 0 && target < parent.children.length;
  }
  move(direction: number) {
    this.state.shift(this.moveLayout.reversed ? -direction : direction);
  }
  editPart(name: string) {
    if (this.state.onEditPart) this.state.onEditPart(name);
    else {
      this.state.part = name;
      this.state.selected.set(this.state.initialSelection());
      this.state.onChange();
    }
  }
  @Output() dismiss = new EventEmitter<void>();
  @Output() format = new EventEmitter<string>();
  @Output() replace = new EventEmitter<string>();
  formats = [
    ["Bold", "bold", "B"],
    ["Italic", "italic", "I"],
    ["Underline", "underline", "U"],
    ["Strikethrough", "strike", "S"],
    ["Inline code", "inlineCode", "<>"],
  ];
  get textBlock() {
    return [
      "core/heading",
      "core/paragraph",
      "core/content",
      "core/post-content",
    ].includes(this.state.node?.type || "");
  }
  get fields() {
    const block = this.state.blocks.find(
      (b) => b.type === this.state.node?.type,
    );
    return (
      block?.fields.filter(
        (f) =>
          block.toolbar?.includes(f.key) &&
          modelFieldVisible(
            block.type,
            this.state.node?.settings || {},
            f.key,
          ) &&
          !(
            this.textBlock &&
            ["align", "color", ...this.formats.map((tool) => tool[1])].includes(
              f.key,
            )
          ),
      ) || []
    );
  }
  drag(e: DragEvent) {
    this.state.dragSource = { id: this.state.selected() };
    e.dataTransfer?.setData(
      "application/x-colossal-block",
      JSON.stringify(this.state.dragSource),
    );
    this.state.onDragStart();
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  }
  keys(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      this.dismiss.emit();
      return;
    }
    if (
      !["ArrowLeft", "ArrowRight"].includes(e.key) ||
      ["INPUT", "SELECT", "TEXTAREA"].includes(
        (e.target as HTMLElement).tagName,
      )
    )
      return;
    const controls = Array.from(
      (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
        "button,input,select",
      ),
    ).filter((control) => !(control as HTMLButtonElement).disabled);
    const i = controls.indexOf(e.target as HTMLElement);
    e.preventDefault();
    controls[
      (i + (e.key === "ArrowRight" ? 1 : controls.length - 1)) % controls.length
    ]?.focus();
  }
}
