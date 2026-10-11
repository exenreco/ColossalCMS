import { Component, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { UiSurfaceComponent } from "./ui-surface.component";
import { EditorIconComponent } from "./editor-icon.component";

/** Editor confirmations and text prompts share the same themed, accessible modal. */
@Component({
  selector: "cl-editor-dialog",
  standalone: true,
  imports: [FormsModule, UiSurfaceComponent, EditorIconComponent],
  styles: [
    ":host { display: contents; } .editor-dialog-message { white-space: pre-line; }",
  ],
  template: `<cl-ui-surface
    kind="modal"
    [label]="title"
    [open]="open"
    [width]="460"
    panelClass="editor-confirmation"
    (dismissed)="finish(null)"
  >
    <form
      class="editor-dialog-form"
      (ngSubmit)="finish(prompting ? value.trim() : true)"
    >
      <header class="editor-dialog-header">
        <span class="editor-dialog-icon" [class.destructive]="destructive"
          ><cl-editor-icon [name]="prompting ? 'edit' : 'help'"
        /></span>
        <h2>{{ title }}</h2>
        <button
          type="button"
          class="editor-tool"
          [attr.aria-label]="'Close ' + title"
          (click)="finish(null)"
        >
          <cl-editor-icon name="close" />
        </button>
      </header>
      <div class="editor-dialog-body">
        @if (message) {
          <p class="editor-dialog-message">{{ message }}</p>
        }
        @if (prompting) {
          <label class="editor-dialog-field"
            >{{ fieldLabel
            }}<input
              autofocus
              [attr.aria-label]="fieldLabel"
              name="value"
              [(ngModel)]="value"
              maxlength="300"
          /></label>
        }
      </div>
      <footer class="editor-dialog-footer">
        <button
          type="button"
          class="editor-dialog-cancel"
          [attr.autofocus]="prompting ? null : ''"
          (click)="finish(null)"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="submit"
          class="editor-save"
          [class.editor-dialog-danger]="destructive"
          [disabled]="prompting && !value.trim()"
        >
          {{ confirmLabel }}
        </button>
      </footer>
    </form>
  </cl-ui-surface>`,
})
export class EditorDialogComponent implements OnDestroy {
  open = false;
  title = "";
  message = "";
  fieldLabel = "Name";
  value = "";
  prompting = false;
  confirmLabel = "Continue";
  cancelLabel = "Cancel";
  destructive = false;
  private resolver?: (value: string | boolean | null) => void;
  confirm(
    title: string,
    message: string,
    confirmLabel = "Continue",
    cancelLabel = "Cancel",
    destructive = false,
  ) {
    this.prompting = false;
    this.destructive = destructive;
    return this.ask(title, message, confirmLabel, cancelLabel).then(
      (value) => value === true,
    );
  }
  prompt(title: string, fieldLabel: string, value = "", confirmLabel = "Save") {
    this.prompting = true;
    this.destructive = false;
    this.fieldLabel = fieldLabel;
    this.value = value;
    return this.ask(title, "", confirmLabel, "Cancel").then((value) =>
      typeof value === "string" ? value : null,
    );
  }
  private ask(
    title: string,
    message: string,
    confirmLabel: string,
    cancelLabel: string,
  ) {
    this.resolver?.(null);
    this.title = title;
    this.message = message;
    this.confirmLabel = confirmLabel;
    this.cancelLabel = cancelLabel;
    this.open = true;
    return new Promise<string | boolean | null>(
      (resolve) => (this.resolver = resolve),
    );
  }
  finish(value: string | boolean | null) {
    this.open = false;
    const resolve = this.resolver;
    this.resolver = undefined;
    resolve?.(value);
  }
  ngOnDestroy() {
    this.finish(null);
  }
}
