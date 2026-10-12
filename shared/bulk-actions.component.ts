import { Component, Input, Output, EventEmitter } from "@angular/core";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "cl-bulk-actions",
  standalone: true,
  imports: [FormsModule],
  template: `<div
    class="admin-bulk-actions"
    [class.clear-below]="clearBelow"
    role="region"
    aria-label="Bulk actions"
  >
    @if (showCount) {
      <strong aria-live="polite">{{ count }} selected</strong>
    }
    <select
      aria-label="Bulk action"
      [(ngModel)]="action"
      [disabled]="busy || !count"
    >
      <option value="">Choose action</option>
      @for (item of actions; track item.value) {
        <option [value]="item.value">{{ item.label }}</option>
      }
    </select>
    <button
      type="button"
      class="button small"
      [disabled]="busy || !count || !action"
      (click)="applied.emit(action)"
    >
      Apply
    </button>
    @if (count || clearBelow) {
      <button
        type="button"
        class="text-button bulk-clear-selection"
        [class.selection-empty]="!count"
        [attr.aria-hidden]="!count ? true : null"
        [disabled]="busy || !count"
        (click)="cleared.emit()"
      >
        Clear selection
      </button>
    }
    @if (busy) {
      <span role="status"
        >Processing {{ progress }} of {{ progressTotal || count }}…</span
      >
    }
  </div>`,
})
export class BulkActionsComponent {
  @Input() count = 0;
  @Input() showCount = true;
  @Input() clearBelow = false;
  @Input() busy = false;
  @Input() progress = 0;
  @Input() progressTotal = 0;
  @Input() actions: { value: string; label: string }[] = [];
  @Output() applied = new EventEmitter<string>();
  @Output() cleared = new EventEmitter<void>();
  action = "";
}
