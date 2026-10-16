import type { ThemeLoading } from "./theme-loading";

export interface PublicRender {
  seo?: {
    canonical: string;
    robots: string;
    socialTitle: string;
    socialDescription: string;
    image: string;
    type: string;
    siteName: string;
    graph: unknown[];
  };
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
  frontendMode?: "enhance";
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
    if (
      render?.bootstrap === "enhance-v1" &&
      render.preview !== true &&
      typeof render.body?.className === "string" &&
      typeof render.body?.style === "string" &&
      typeof render.body?.themeId === "string"
    ) {
      // The document already contains the vetted HTML/CSS. Its enhancer needs flags only.
      return {
        html: "",
        css: "",
        body: render.body,
        preview: false,
        adsEnabled: render.adsEnabled === true,
        frontendMode: "enhance",
      };
    }
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
