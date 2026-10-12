export const TITLE_FORMATS = [
  "page-site",
  "site-page",
  "page-only",
  "site-only",
] as const;
export const TITLE_SEPARATORS = ["|", "·", "-", "—", ":"] as const;
export interface TitleSettings {
  title?: string;
  titleFormat?: string;
  titleSeparator?: string;
}
/** One title formatter for public HTML, frontend navigation and SEO previews. */
export function formatPageTitle(
  pageTitle: string,
  settings: TitleSettings = {},
) {
  const page = (pageTitle || "").trim(),
    site = (settings.title || "").trim();
  if (!page) return site;
  if (!site) return page;
  const format = TITLE_FORMATS.includes(settings.titleFormat as any)
    ? settings.titleFormat
    : "page-site";
  const separator = TITLE_SEPARATORS.includes(settings.titleSeparator as any)
    ? settings.titleSeparator
    : "·";
  if (format === "page-only") return page;
  if (format === "site-only") return site;
  return (format === "site-page" ? [site, page] : [page, site]).join(
    ` ${separator} `,
  );
}
