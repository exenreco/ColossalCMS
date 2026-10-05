export interface ThemeBody {
  blockId: string;
  className: string;
  style: string;
  themeId: string;
  templateId: string;
}

/** Put template-root settings on the iframe's real body, not a wrapper block. */
export function themeBodyAttributes(body: ThemeBody | undefined): string {
  const escape = (value: string) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  return (
    `class="theme-root ${escape(body?.className || "")}"` +
    (body?.blockId ? ` data-block-id="${escape(body.blockId)}"` : "") +
    ` data-theme-id="${escape(body?.themeId || "")}"` +
    ` data-theme-template="${escape(body?.templateId || "")}"` +
    ` style="${escape(body?.style || "")}"`
  );
}
