/** Keep the current entry's image in one shared location, below Sidebar Search. */
export function moveGlossyFeaturedImageToSidebar(document) {
  const marker = "/* Glossy featured image in shared sidebar */";
  const sidebar = document.parts?.sidebar;
  if (!sidebar || document.css?.includes(marker)) return;
  const removed = [];
  const remove = (node) => {
    if (node?.type === "core/post-list") return;
    if (!node?.children) return;
    node.children = node.children.filter((child) => {
      if (child.type === "core/featured-image") {
        removed.push(child);
        return false;
      }
      remove(child);
      return !(
        child.type === "core/column" &&
        !child.children?.length &&
        String(child.settings?.classes || "")
          .split(/\s+/)
          .includes("c27-search-result-image")
      );
    });
  };
  // Reuse a previously configured Sidebar image, otherwise prefer Single's image.
  remove(sidebar);
  remove(document.templates?.["post-single"]);
  for (const [id, root] of Object.entries(document.templates || {})) {
    if (id !== "post-single") remove(root);
  }
  const image = removed[0] || {
    id: "glossy-sidebar-featured-" + crypto.randomUUID(),
    type: "core/featured-image",
    settings: { aspectRatio: "4/3", objectFit: "cover" },
  };
  image.settings ||= {};
  image.settings.classes = [
    ...new Set(
      String(image.settings.classes || "")
        .split(/\s+/)
        .filter(Boolean)
        .concat("c27-sidebar-featured"),
    ),
  ].join(" ");
  sidebar.children ||= [];
  const insert = (node) => {
    const children = node.children || [];
    const index = children.findIndex((child) => child.type === "core/search");
    if (index >= 0) {
      children.splice(index + 1, 0, image);
      return true;
    }
    return children.some(insert);
  };
  if (!insert(sidebar)) sidebar.children.unshift(image);
  document.css =
    (document.css || "") +
    `\n${marker}
.theme-root .c27-sidebar-featured{margin:24px 0}
.theme-root .c27-sidebar-featured:empty{display:none}
.theme-root .c27-sidebar-featured figure{margin:0}
.theme-root .c27-sidebar-featured img{display:block;width:100%;border-radius:12px}
`;
  delete document.compiled;
}

/** Restore result thumbnails removed by the earlier Sidebar-only migration. */
export function restoreGlossyCardFeaturedImages(document) {
  const marker = "/* Glossy restored card featured images */";
  if (document.css?.includes(marker)) return;
  const hasImage = (node) =>
    node.type === "core/featured-image" || node.children?.some(hasImage);
  const hasClass = (node, name) =>
    String(node.settings?.classes || "")
      .split(/\s+/)
      .includes(name);
  const make = (type, settings, children) => ({
    id: "glossy-card-" + crypto.randomUUID(),
    type,
    settings,
    ...(children ? { children } : {}),
  });
  const visit = (node) => {
    if (node?.type === "core/post-list") {
      if (hasImage(node)) return;
      const image = make("core/featured-image", {
        aspectRatio: "1/1",
        objectFit: "cover",
        linkToContent: true,
      });
      const row = node.children?.find((child) =>
        hasClass(child, "c27-search-result-row"),
      );
      if (row) {
        row.children ||= [];
        const column = row.children.find((child) =>
          hasClass(child, "c27-search-result-image"),
        );
        if (column) {
          column.children ||= [];
          column.children.push(image);
        } else
          row.children.unshift(
            make(
              "core/column",
              { classes: "c27-search-result-image", width: "1fr" },
              [image],
            ),
          );
      } else {
        node.children ||= [];
        node.children.unshift(image);
      }
      return;
    }
    node?.children?.forEach(visit);
  };
  Object.values(document.templates || {}).forEach(visit);
  document.css =
    (document.css || "").replaceAll(
      ".theme-root .c27-search-result-row>.theme-layout{grid-template-columns:minmax(0,1fr)}",
      "",
    ) +
    "\n" +
    marker +
    "\n";
  delete document.compiled;
}
