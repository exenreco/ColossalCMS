/** Match standard template headings to Posts without changing the landing hero. */
export function alignGlossyTemplateHeadings(document) {
  const marker = "/* Glossy template heading and divider consistency */";
  if (document.css?.includes(marker)) return;
  const findHeading = (node) => {
    if (!node || ["core/post-list", "core/shared-part"].includes(node.type))
      return;
    const children = node.children || [];
    const index = children.findIndex(
      (child) =>
        child.type === "core/title" ||
        (child.type === "core/heading" && child.settings?.level === "h1"),
    );
    if (index >= 0) return { children, index };
    for (const child of children) {
      const match = findHeading(child);
      if (match) return match;
    }
  };
  const reference = findHeading(document.templates?.["post-archive"]);
  if (!reference) return;
  const referenceHeading = reference.children[reference.index];
  const referenceDivider = reference.children[reference.index + 1];
  const dividerSettings =
    referenceDivider?.type === "core/divider"
      ? referenceDivider.settings
      : {
          lineColor: "#ffffff26",
          thickness: 1,
          lineStyle: "solid",
          dividerWidth: 100,
          align: "center",
          spacing: 16,
        };
  for (const [id, root] of Object.entries(document.templates || {})) {
    if (["home", "not-found", "post-archive"].includes(id)) continue;
    const match = findHeading(root);
    if (!match) continue;
    const heading = match.children[match.index];
    heading.settings ||= {};
    heading.settings.fontSize = referenceHeading.settings?.fontSize || 36;
    heading.settings.lineHeight = referenceHeading.settings?.lineHeight || 44;
    heading.settings.classes = [
      ...new Set(
        String(heading.settings.classes || "")
          .split(/\s+/)
          .filter(Boolean)
          .concat("c27-template-heading"),
      ),
    ].join(" ");
    const next = match.children[match.index + 1];
    if (next?.type === "core/divider") {
      next.settings = { ...next.settings, ...structuredClone(dividerSettings) };
    } else {
      match.children.splice(match.index + 1, 0, {
        id: "glossy-template-divider-" + crypto.randomUUID(),
        type: "core/divider",
        settings: structuredClone(dividerSettings),
      });
    }
  }
  document.css =
    (document.css || "") +
    `\n${marker}\n.theme-root .c27-template-heading h1{font-size:inherit;line-height:inherit;letter-spacing:-1px}\n`;
  delete document.compiled;
}
