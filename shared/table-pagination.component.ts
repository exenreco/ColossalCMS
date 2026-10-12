import { Component, Input, Output, EventEmitter } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IconComponent } from "./icon.component";

@Component({
  selector: "cl-table-pagination",
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `<div class="admin-table-pagination">
    <label
      >Rows per page
      <select
        aria-label="Rows per page"
        [ngModel]="pageSize"
        (ngModelChange)="pageSizeChanged.emit(+$event)"
      >
        @for (size of [10, 25, 50, 100]; track size) {
          <option [value]="size">{{ size }}</option>
        }
      </select></label
    >
    <span role="status"
      >{{ total ? (page - 1) * pageSize + 1 : 0 }}–{{
        Math.min(page * pageSize, total)
      }}
      of {{ total }}</span
    >
    <nav aria-label="Table pagination">
      <button
        type="button"
        class="icon-button"
        aria-label="Previous page"
        [disabled]="page <= 1"
        (click)="pageChanged.emit(page - 1)"
      >
        <cl-icon name="chevron" class="pagination-prev" />
      </button>
      @for (number of pages; track number) {
        <button
          type="button"
          [class.selected]="page === number"
          [attr.aria-label]="'Page ' + number"
          [attr.aria-current]="page === number ? 'page' : null"
          (click)="pageChanged.emit(number)"
        >
          {{ number }}
        </button>
      }
      <button
        type="button"
        class="icon-button"
        aria-label="Next page"
        [disabled]="page >= pageCount"
        (click)="pageChanged.emit(page + 1)"
      >
        <cl-icon name="chevron" />
      </button>
    </nav>
  </div>`,
})
export class TablePaginationComponent {
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 10;
  @Output() pageChanged = new EventEmitter<number>();
  @Output() pageSizeChanged = new EventEmitter<number>();
  Math = Math;
  get pageCount() {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }
  get pages() {
    const start = Math.max(1, Math.min(this.page - 2, this.pageCount - 4));
    return Array.from(
      { length: Math.min(5, this.pageCount) },
      (_, index) => start + index,
    );
  }
}
