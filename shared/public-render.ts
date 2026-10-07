import type { ThemeLoading } from "./theme-loading";

export interface PublicRender {
  html: string;
  css: string;
  body: {
    className: string;
    style: string;
    blockId?: string;
    themeId?: string;
    templateId?: string;
  };
  loading?: ThemeLoading;
  title?: string;
  description?: string;
  siteIcon?: string;
  announcement?: string;
  preview?: boolean;
  maintenance?: boolean;
  maintenancePreview?: boolean;
  adsEnabled?: boolean;
}

/** Only the same-origin server's vetted render is embedded in this inert payload. */
export function initialPublicRender(doc: Document): PublicRender | null {
  try {
    const payload =
      doc.getElementById("theme-render") ||
      doc.getElementById("maintenance-render");
    const render = payload?.textContent
      ? JSON.parse(payload.textContent)
      : null;
    return typeof render?.html === "string" &&
      typeof render?.css === "string" &&
      typeof render?.body?.className === "string" &&
      typeof render?.body?.style === "string"
      ? render
      : null;
  } catch {
    return null;
  }
}
