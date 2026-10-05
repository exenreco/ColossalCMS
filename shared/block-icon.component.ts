import { Component, Input } from "@angular/core";

/**
 * Every block declares an icon as a font-agnostic token (for example
 * `fas fa-square`). The CMS resolves it to an inline SVG so icons render
 * without depending on an external icon font.
 */
const paths: Record<string, string[]> = {
  ad: ["M3 5h18v14H3z", "M6 15l2-6 2 6", "M7 12h2", "M13 9v6h2a3 3 0 0 0 0-6z"],
  "vector-square": ["M4 4h16v16H4z", "M2 2h4v4H2z", "M18 18h4v4h-4z"],
  "layer-group": ["M12 2L2 7l10 5 10-5z", "M2 12l10 5 10-5", "M2 17l10 5 10-5"],
  images: ["M3 6h14v14H3z", "M7 3h14v14", "M3 16l4-4 3 3 3-4 4 5"],
  clone: ["M3 7h14v14H3z", "M7 3h14v14", "M17 7v10H7"],
  "object-group": ["M3 3h13v13H3z", "M8 8h13v13H8z", "M3 3h3", "M18 21h3"],
  "arrows-alt-h": ["M3 12h18", "M7 8l-4 4 4 4", "M17 8l4 4-4 4"],
  "file-lines": ["M5 2h10l4 4v16H5z", "M8 10h8", "M8 14h8", "M8 18h5"],
  "th-large": [
    "M3 3h7v7H3z",
    "M14 3h7v7h-7z",
    "M3 14h7v7H3z",
    "M14 14h7v7h-7z",
  ],
  desktop: ["M2 3h20v14H2z", "M12 17v4", "M7 21h10"],
  "tablet-alt": ["M5 2h14v20H5z", "M11 19h2"],
  "mobile-alt": ["M7 2h10v20H7z", "M11 19h2"],
  undo: ["M3 4v6h6", "M3 10a9 9 0 1 1 2 9"],
  redo: ["M21 4v6h-6", "M21 10a9 9 0 1 0-2 9"],
  times: ["M5 5l14 14", "M19 5L5 19"],
  square: ["M4 4h16v16H4z"],
  columns: ["M3 3h7v18H3z", "M14 3h7v18h-7z"],
  "arrows-alt-v": ["M8 7l4-4 4 4", "M12 3v18", "M8 17l4 4 4-4"],
  heading: ["M6 4v16", "M18 4v16", "M6 12h12"],
  "align-left": ["M3 6h18", "M3 11h12", "M3 16h16", "M3 21h9"],
  image: ["M3 3h18v18H3z", "M3 16l5-5 4 4 3-3 6 6", "M15 8h.01"],
  "photo-video": ["M3 5h12v14H3z", "M15 10l6-3v10l-6-3z"],
  portrait: [
    "M4 3h16v18H4z",
    "M12 9a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5",
    "M7 19c1.2-2.4 3-3.5 5-3.5s3.8 1.1 5 3.5",
  ],
  star: [
    "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  ],
  bars: ["M3 6h18", "M3 12h18", "M3 18h18"],
  search: ["M21 21l-5-5", "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14"],
  list: [
    "M8 6h13",
    "M8 12h13",
    "M8 18h13",
    "M3 6h.01",
    "M3 12h.01",
    "M3 18h.01",
  ],
  "file-alt": [
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    "M14 2v6h6",
    "M8 13h8",
    "M8 17h5",
  ],
  "info-circle": [
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20",
    "M12 11v5",
    "M12 8h.01",
  ],
  "ellipsis-h": ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
  globe: [
    "M2 12h20",
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20",
    "M12 2c6 5 6 15 0 20-6-5-6-15 0-20",
  ],
  code: ["M8 6l-6 6 6 6", "M16 6l6 6-6 6"],
  plus: ["M12 5v14", "M5 12h14"],
  block: ["M12 2l9 5v10l-9 5-9-5V7z", "M12 12l9-5", "M12 12v10", "M12 12L3 7"],
};

@Component({
  selector: "cl-block-icon",
  standalone: true,
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    @for (d of drawing; track d) {
      <path [attr.d]="d" />
    }
  </svg>`,
  styles: [
    ":host{display:inline-flex;width:18px;height:18px;flex:none}svg{width:100%;height:100%}",
  ],
})
export class BlockIconComponent {
  @Input() icon = "";
  get drawing() {
    const token = String(this.icon || "")
      .trim()
      .split(/\s+/)
      .pop()!
      .replace(/^fa-/, "")
      .toLowerCase();
    return paths[token] || paths["block"];
  }
}
