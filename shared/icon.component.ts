import { Component, Input } from "@angular/core";
const paths: Record<string, string> = {
  themes: "M3 3h18v18H3z M3 9h18 M9 9v12 M6 6h.01 M9 6h.01",
  media: "M3 3h18v18H3z M3 16l5-5 4 4 3-3 6 6 M15 7h.01",
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  pages:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5",
  posts: "M4 20h4L20 8l-4-4L4 16v4z M14 6l4 4",
  plugins: "M8 3h8v5h5v8h-5v5H8v-5H3V8h5z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  external:
    "M14 3h7v7 M21 3L10 14 M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5",
  plus: "M12 5v14 M5 12h14",
  search: "M21 21l-5-5 M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14",
  clock: "M12 8v5l3 2 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20",
  check: "M5 12l4 4L19 6",
  lock: "M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4",
  book: "M3 3h6l3 3 3-3h6v16h-6l-3 3-3-3H3z M12 6v16",
  chevron: "M9 5l7 7-7 7",
  close: "M6 6l12 12 M6 18L18 6",
  trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  globe:
    "M2 12h20 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 2c6 5 6 15 0 20-6-5-6-15 0-20",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  bell: "M6 17V9a6 6 0 0 1 12 0v8l2 2H4z M10 22h4",
  logout: "M9 3H3v18h6 M9 12h12 M17 8l4 4-4 4",
};
@Component({
  selector: "cl-icon",
  standalone: true,
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path"/></svg>',
  styles: [
    ":host{display:inline-flex;width:20px;height:20px;flex:none}svg{width:100%;height:100%}",
  ],
})
export class IconComponent {
  @Input() name = "pages";
  get path() {
    return paths[this.name] || paths["plugins"];
  }
}
