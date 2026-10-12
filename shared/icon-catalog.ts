/** Bundled SVG drawings shared by the editor, icon picker, and public renderer. */
export const BLOCK_ICON_PATHS: Record<string, string[]> = {
  comment: [
    "M21 11a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 0 1 8-12h2a8 8 0 0 1 8 8z",
    "M7 9h10M7 13h6",
  ],
  "project-diagram": [
    "M8 7l8 5M8 17l8-5",
    "M8 5H3v5h5z",
    "M8 15H3v5h5z",
    "M21 9h-5v6h5z",
  ],
  "external-link-alt": ["M14 3h7v7", "M21 3l-11 11", "M10 3H3v18h18v-7"],
  link: [
    "M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-2 2",
    "M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l2-2",
  ],
  icons: [
    "M3 3h7v7H3z",
    "M17.5 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9",
    "M7 14l5 7H2z",
    "M15 15h6v6h-6z",
  ],
  "file-code": [
    "M5 2h10l4 4v16H5z",
    "M15 2v5h5",
    "M10 11l-3 3 3 3",
    "M14 11l3 3-3 3",
  ],
  cube: ["M12 2l9 5v10l-9 5-9-5V7z", "M12 12l9-5", "M12 12v10", "M12 12L3 7"],
  "grip-vertical": [
    "M9 5h.01",
    "M15 5h.01",
    "M9 12h.01",
    "M15 12h.01",
    "M9 19h.01",
    "M15 19h.01",
  ],
  "expand-alt": ["M4 9V4h5", "M4 4l6 6", "M20 15v5h-5", "M20 20l-6-6"],
  "compress-alt": ["M10 4v6H4", "M10 10L4 4", "M14 20v-6h6", "M14 14l6 6"],
  pen: ["M4 20h4L20 8l-4-4L4 16v4z", "M14 6l4 4"],
  copy: ["M8 8h13v13H8z", "M16 8V3H3v13h5"],
  cut: [
    "M7 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
    "M7 17a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
    "M9 14L21 3",
    "M9 18l12-7",
  ],
  paste: ["M8 5H4v16h16V5h-4", "M8 3h8v4H8z", "M8 12h8", "M8 16h6"],
  "arrow-right": ["M5 12h14", "M13 6l6 6-6 6"],
  "arrow-up-right": ["M5 19L19 5", "M5 5h14v14"],
  "chevron-down": ["M5 9l7 7 7-7"],
  "arrow-up": ["M12 20V4", "M5 11l7-7 7 7"],
  "arrow-down": ["M12 4v16", "M5 13l7 7 7-7"],
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
  "text-height": [
    "M3 5h12",
    "M9 5v14",
    "M6 19h6",
    "M19 4v16",
    "M17 6l2-2 2 2",
    "M17 18l2 2 2-2",
  ],
  "align-justify": ["M3 5h18", "M3 10h18", "M3 15h18", "M3 20h18"],
  paragraph: ["M13 4H9a5 5 0 0 0 0 10h4", "M13 4v16", "M18 4v16", "M10 4h10"],
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

export const APP_ICON_PATHS: Record<string, string> = {
  pillar: "M5 3h14v3H5z M7 6h10v3H7z M8 9v10 M12 9v10 M16 9v10 M6 19h12v2H6z",
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
  shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z M8 12l3 3 5-6",
  book: "M3 3h6l3 3 3-3h6v16h-6l-3 3-3-3H3z M12 6v16",
  chevron: "M9 5l7 7-7 7",
  close: "M6 6l12 12 M6 18L18 6",
  trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  globe:
    "M2 12h20 M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 2c6 5 6 15 0 20-6-5-6-15 0-20",
  menu: "M3 6h18 M3 12h18 M3 18h18",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  list: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  "eye-off":
    "M3 3l18 18 M10 5c7-1 12 7 12 7s-1 2-3 4 M6 6c-3 2-4 6-4 6s4 7 10 7c2 0 4-1 5-2 M10 10a3 3 0 0 0 4 4",
  bell: "M6 17V9a6 6 0 0 1 12 0v8l2 2H4z M10 22h4",
  logout: "M9 3H3v18h6 M9 12h12 M17 8l4 4-4 4",
};

export const EDITOR_ICON_PATHS: Record<string, string> = {
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  duplicate: "M8 8h13v13H8zM16 8V3H3v13h5M11 14.5h7M14.5 11v7",
  copy: "M9 9h12v12H9zM15 9V3H3v12h6",
  paste: "M8 5H4v16h16V5h-4M8 3h8v4H8zM8 12h8M8 16h6",
  grip: "M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01",
  "arrow-up": "M12 20V4M5 11l7-7 7 7",
  "arrow-down": "M12 4v16M5 13l7 7 7-7",
  "arrow-left": "M20 12H4M11 5l-7 7 7 7",
  "arrow-right": "M4 12h16M13 5l7 7-7 7",
  inspector: "M3 4h18v16H3zM15 4v16M18 8h.01M18 12h.01M18 16h.01",
  back: "M15 5l-7 7 7 7M8 12h13",
  plus: "M12 4v16M4 12h16",
  list: "M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01",
  outline: "M3 4h18M3 4v13h4M10 10h11M10 17h11",
  panel: "M3 4h18v16H3zM9 4v16",
  chevron: "M5 9l7 7 7-7",
  undo: "M8 4l-5 5 5 5M3 9h11a6 6 0 010 12",
  redo: "M16 4l5 5-5 5M21 9H10a6 6 0 000 12",
  desktop: "M3 3h18v13H3zM12 16v5M8 21h8",
  tablet: "M5 2h14v20H5zM11 18h2",
  mobile: "M7 2h10v20H7zM11 18h2",
  fit: "M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6",
  preview: "M14 3h7v7M21 3l-11 11M10 3H3v18h18v-7",
  theme:
    "M12 3a9 9 0 100 18h1a2 2 0 001-3.7c-1.2-.6-.6-2.3.8-2.3H17a4 4 0 004-4 9 9 0 00-9-8M7 9h.01M11 6h.01M16 7h.01M6 14h.01",
  sun: "M12 3V1M12 23v-2M3 12H1M23 12h-2M5 5L3 3M21 21l-2-2M5 19l-2 2M21 3l-2 2M16 12a4 4 0 11-8 0 4 4 0 018 0",
  moon: "M21 14a9 9 0 01-11-11A9 9 0 1021 14",
  settings:
    "M12 8a4 4 0 100 8 4 4 0 000-8M10 2h4l.5 3 2 1 2.8-1 2 3.5-2.3 2v3l2.3 2-2 3.5-2.8-1-2 1-.5 3h-4l-.5-3-2-1-2.8 1-2-3.5 2.3-2v-3l-2.3-2 2-3.5 2.8 1 2-1z",
  check: "M5 12l4 4L19 6",
  close: "M6 6l12 12M6 18L18 6",
  edit: "M16 3l5 5L9 20l-6 1 1-6L16 3M13 6l5 5",
  search: "M15 15l6 6M17 10a7 7 0 11-14 0 7 7 0 0114 0",
  help: "M9 8a3 3 0 016 0c0 2-3 2-3 5M12 17h.01M22 12a10 10 0 11-20 0 10 10 0 0120 0",
};

const allDrawings: Record<string, string[]> = {
  ...Object.fromEntries(
    Object.entries(EDITOR_ICON_PATHS).map(([name, path]) => [name, [path]]),
  ),
  ...Object.fromEntries(
    Object.entries(APP_ICON_PATHS).map(([name, path]) => [name, [path]]),
  ),
  ...BLOCK_ICON_PATHS,
};

/** Also accepts the font-agnostic `fas fa-star` tokens used by block metadata. */
export function iconName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .split(/\s+/)
    .pop()!
    .replace(/^fa-/, "")
    .toLowerCase();
}

export const ICON_CATALOG = Object.keys(allDrawings)
  .map((name) => ({
    name,
    label: name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

export function iconDrawing(value: unknown): string[] {
  const name = iconName(value);
  return Object.hasOwn(allDrawings, name)
    ? allDrawings[name]
    : BLOCK_ICON_PATHS["block"];
}

export function searchIcons(query: string) {
  const terms = query
    .toLowerCase()
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  return ICON_CATALOG.filter((icon) =>
    terms.every((term) =>
      (icon.name + " " + icon.label).toLowerCase().includes(term),
    ),
  );
}

export function validIcon(value: unknown): boolean {
  return (
    typeof value === "string" && Object.hasOwn(allDrawings, iconName(value))
  );
}

export function iconSize(value: unknown): number {
  const size = Number(value ?? 32);
  return Number.isFinite(size) ? Math.max(8, Math.min(512, size)) : 32;
}

export function normalizeIconSettings(settings: Record<string, any>) {
  settings.iconName =
    settings.iconName === ""
      ? ""
      : validIcon(settings.iconName)
        ? iconName(settings.iconName)
        : "star";
  settings.iconSize = iconSize(settings.iconSize);
  settings.decorative = settings.decorative !== false;
  settings.accessibleLabel = String(settings.accessibleLabel ?? "")
    .trim()
    .slice(0, 160);
}

/** Only catalog paths reach public SVG; no authored SVG, URLs or markup are interpolated. */
export function renderIcon(settings: Record<string, any>): string {
  if (settings.iconName === "") return "";
  const normalized = { ...settings };
  normalizeIconSettings(normalized);
  const label = (normalized.accessibleLabel || "Icon").replace(
    /[&<>"']/g,
    (char: string) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
  return `<svg class="theme-icon" viewBox="0 0 24 24" width="${normalized.iconSize}" height="${normalized.iconSize}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" focusable="false" ${normalized.decorative ? 'aria-hidden="true"' : `role="img" aria-label="${label}"`}>${iconDrawing(
    normalized.iconName,
  )
    .map((path) => `<path d="${path}"></path>`)
    .join("")}</svg>`;
}
