import { Injectable, inject, signal } from "@angular/core";
import { ApiService } from "../../../shared/api.service";
export type ContentTableKind = "page" | "post";
const storageKey = "colossal.content.columns.v1";
const columns = [
  { key: "title", label: "Title", required: true },
  { key: "slug", label: "Slug", pagesOnly: true },
  { key: "template", label: "Template", pagesOnly: true },
  { key: "author", label: "Author", pagesOnly: true },
  { key: "status", label: "Status" },
  { key: "updatedAt", label: "Updated" },
  { key: "seo", label: "SEO", seoOnly: true },
  { key: "views30Days", label: "Views (last 30 days)" },
  { key: "view", label: "Actions" },
];
function saved(): Record<string, string[]> {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}
/** Browser display preferences, separated by member and content screen. */
@Injectable({ providedIn: "root" })
export class ContentTableState {
  private api = inject(ApiService);
  private hidden = signal(saved());
  private scope(kind: ContentTableKind) {
    const user = this.api.state()?.user;
    return (user?.id || user?.email || "local") + ":" + kind;
  }
  options(kind: ContentTableKind, seoEnabled: boolean) {
    return columns.filter(
      (c) => (!c.pagesOnly || kind === "page") && (!c.seoOnly || seoEnabled),
    );
  }
  visible(kind: ContentTableKind, column: string) {
    const hidden = this.hidden()[this.scope(kind)];
    return (
      column === "title" || !Array.isArray(hidden) || !hidden.includes(column)
    );
  }
  setVisible(kind: ContentTableKind, column: string, visible: boolean) {
    if (column === "title" || !columns.some((c) => c.key === column)) return;
    const scope = this.scope(kind);
    const saved = this.hidden()[scope];
    const hidden = new Set(Array.isArray(saved) ? saved : []);
    if (visible) hidden.delete(column);
    else hidden.add(column);
    this.hidden.update((value) => ({ ...value, [scope]: [...hidden] }));
    try {
      localStorage.setItem(storageKey, JSON.stringify(this.hidden()));
    } catch {
      /* Keep controls usable without browser storage. */
    }
  }
  count(kind: ContentTableKind, seoEnabled: boolean) {
    return (
      1 +
      this.options(kind, seoEnabled).filter((c) => this.visible(kind, c.key))
        .length
    );
  }
}
