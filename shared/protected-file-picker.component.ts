import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ApiService } from "./api.service";
import { MediaSelectionService } from "./media-selection.service";
@Component({
  selector: "cl-protected-file-picker",
  standalone: true,
  imports: [FormsModule],
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .protected-file-picker {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .protected-file-picker input {
      width: 100%;
      min-width: 0;
    }
    .protected-file-picker small {
      white-space: normal;
    }
    .protected-file-error {
      color: #db805a;
    }
  `,
  template: `<span class="protected-file-picker">
    @if (name) {
      <strong>{{ name }}</strong>
    }
    <button type="button" class="button" [disabled]="busy" (click)="choose()">
      {{ value || mediaId ? "Choose another file" : "Choose file" }}
    </button>
    <small
      >The original stays public. A separate copy requires this password on
      every download.</small
    >
    <input
      type="password"
      aria-label="File password"
      autocomplete="new-password"
      placeholder="{{
        value && !mediaId
          ? 'New password (leave blank to keep)'
          : 'Set file password'
      }}"
      [(ngModel)]="password"
      [disabled]="busy"
    />
    <small
      >8 characters minimum; up to 72 UTF-8 bytes. Saved passwords cannot be
      viewed.</small
    >
    <button
      type="button"
      class="button"
      [disabled]="busy || !password || (!value && !mediaId)"
      (click)="save()"
    >
      {{
        busy
          ? "Saving…"
          : mediaId || !value
            ? "Create protected copy"
            : "Update password"
      }}
    </button>
    @if (value) {
      <small
        >Password protection is configured. Save or publish the page/template to
        display this button.</small
      >
    }
    @if (error) {
      <small class="protected-file-error" role="alert">{{ error }}</small>
    }
  </span>`,
})
export class ProtectedFilePickerComponent implements OnChanges {
  @Input() value = "";
  @Input() blockId = "";
  @Output() valueChange = new EventEmitter<string>();
  private api = inject(ApiService);
  private picker = inject(MediaSelectionService);
  private cdr = inject(ChangeDetectorRef);
  name = "";
  mediaId = "";
  password = "";
  busy = false;
  error = "";
  private revision = 0;
  ngOnDestroy() {
    this.revision++;
    this.password = "";
  }
  async ngOnChanges() {
    const revision = ++this.revision,
      id = this.value;
    this.password = this.mediaId = this.name = this.error = "";
    if (!id) return;
    try {
      const result = await this.api.request(
        "/admin/protected-files/" + encodeURIComponent(id),
      );
      if (revision === this.revision) this.name = result.name;
    } catch (e) {
      if (revision === this.revision) this.error = (e as Error).message;
    } finally {
      this.cdr.markForCheck();
    }
  }
  async choose() {
    const revision = this.revision;
    const [file] = await this.picker.open();
    if (file && revision === this.revision) {
      this.mediaId = file.id;
      this.name = file.name;
      this.password = this.error = "";
      this.cdr.markForCheck();
    }
  }
  async save() {
    const revision = this.revision;
    this.busy = true;
    this.error = "";
    try {
      const result = await this.api.request(
        "/admin/protected-files" +
          (this.mediaId ? "" : "/" + encodeURIComponent(this.value)),
        "POST",
        { mediaId: this.mediaId, password: this.password },
      );
      if (revision === this.revision) {
        this.password = this.mediaId = "";
        this.name = result.name;
        this.valueChange.emit(result.id);
      }
    } catch (e) {
      if (revision === this.revision) this.error = (e as Error).message;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
