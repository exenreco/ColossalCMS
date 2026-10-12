/** Selections persist across filters/pages; Select all affects only visible rows. */
export class TableSelection {
  ids = new Set<string>();
  toggle(id: string, checked: boolean) {
    if (checked) this.ids.add(id);
    else this.ids.delete(id);
  }
  all(ids: string[]) {
    return ids.length > 0 && ids.every((id) => this.ids.has(id));
  }
  some(ids: string[]) {
    return ids.some((id) => this.ids.has(id)) && !this.all(ids);
  }
  toggleAll(ids: string[], checked: boolean) {
    ids.forEach((id) => this.toggle(id, checked));
  }
  clear() {
    this.ids.clear();
  }
}
