/** Keep tab and bookmark icons synchronized without using the site logo. */
export function syncSiteIcon(document: Document, href = "/favicon.svg") {
  for (const rel of ["icon", "apple-touch-icon"]) {
    let link = document.querySelector<HTMLLinkElement>(
      'link[rel="' + rel + '"]',
    );
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
  }
}
