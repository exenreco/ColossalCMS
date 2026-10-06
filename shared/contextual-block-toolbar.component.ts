import { Component, EventEmitter, Input, Output, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ThemeEditorState } from "./theme-editor-state";
import { BlockIconComponent } from "./block-icon.component";
import { modelFieldVisible } from "./model-field-visibility";

/** Floating controls share the Inspector's state and undo journal. */
@Component({
  selector: "cl-contextual-block-toolbar",
  standalone: true,
  imports: [FormsModule, BlockIconComponent],
  template: `@if (state.node; as node) {
    <div
      class="contextual-block-toolbar"
      role="toolbar"
      [attr.aria-label]="'Block tools for ' + state.label(node)"
      (keydown)="keys($event)"
      (mousedown)="$event.stopPropagation()"
      (click)="$event.stopPropagation()"
    >
      <cl-block-icon [icon]="state.iconFor(node.type)" />
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
        <select
          aria-label="Alignment"
          [ngModel]="node.settings['align'] || 'left'"
          (ngModelChange)="state.set('align', $event)"
        >
          <option>left</option>
          <option>center</option>
          <option>right</option>
        </select>
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
          <select
            [attr.aria-label]="field.label"
            [title]="field.label"
            [ngModel]="node.settings[field.key] ?? field.default"
            (ngModelChange)="state.set(field.key, $event)"
          >
            @for (option of field.options; track option) {
              <option>{{ option }}</option>
            }
          </select>
        } @else if (field.type === "checkbox") {
          <button
            class="button small"
            [attr.aria-label]="field.label"
            [attr.aria-pressed]="!!node.settings[field.key]"
            (click)="state.set(field.key, !node.settings[field.key])"
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
      <span class="toolbar-divider" aria-hidden="true"></span>
      <button
        class="button small"
        draggable="true"
        aria-label="Drag block"
        title="Drag block"
        (dragstart)="drag($event)"
        (dragend)="state.onDragEnd()"
      >
        ⠿
      </button>
      <button
        class="button small"
        aria-label="Duplicate block"
        title="Duplicate block"
        (click)="state.duplicate()"
      >
        ⧉
      </button>
      <button
        class="button small"
        aria-label="Delete block"
        title="Delete block"
        (click)="state.remove()"
      >
        ×
      </button>
    </div>
  }`,
})
export class ContextualBlockToolbarComponent {
  state = inject(ThemeEditorState);
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
      "core/rich-text",
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
          !(this.textBlock && ["align", "color"].includes(f.key)),
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
  }
  keys(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      this.dismiss.emit();
      return;
    }
    if (
      !["ArrowLeft", "ArrowRight"].includes(e.key) ||
      (e.target as HTMLElement).tagName === "INPUT"
    )
      return;
    const controls = Array.from(
      (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
        "button,input,select",
      ),
    );
    const i = controls.indexOf(e.target as HTMLElement);
    e.preventDefault();
    controls[
      (i + (e.key === "ArrowRight" ? 1 : controls.length - 1)) % controls.length
    ]?.focus();
  }
}
