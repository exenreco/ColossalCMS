const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
/** Safe schematic placeholder while the live preview loads. */
export function modelPoster(name) {
  const title = esc(String(name).slice(0, 80));
  return new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#eef2eb"/><g fill="none" stroke="#477555" stroke-width="7" stroke-linejoin="round"><path d="M320 75 440 142 320 209 200 142Z"/><path d="M200 142v126l120 67 120-67V142M320 209v126"/></g><text x="320" y="374" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" fill="#294b36">${title}</text></svg>`,
  );
}
