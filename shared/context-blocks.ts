import type { BlockNode, ThemeDocument } from "./theme-models";

/** Repeated result instances share one editable block definition. */
export function canvasBlockId(element: Element | null | undefined): string {
  return (
    element?.getAttribute("data-source-block-id") ||
    element?.getAttribute("data-block-id") ||
    ""
  );
}

type MakeBlock = (
  type: string,
  settings?: Record<string, unknown>,
  children?: BlockNode[],
) => BlockNode;

/** One editable result layout; pagination belongs to the list rather than each result. */
export function postListChildren(
  make: MakeBlock,
  settings: Record<string, any> = {},
  pagination = true,
): BlockNode[] {
  return [
    make("core/featured-image", {
      showImage: settings.showFeaturedImage !== false,
      linkToContent: true,
      aspectRatio: "original",
      objectFit: "cover",
    }),
    make("core/title", { level: "h2", linkToContent: true }),
    make("core/post-meta", {
      showDate: settings.showDate !== false,
      showReadingTime: false,
    }),
    make("core/excerpt", {
      showExcerpt: settings.showExcerpt !== false,
      excerptLength: settings.excerptLength ?? 0,
    }),
    ...(pagination
      ? [make("core/pagination", { style: "numbers", align: "center" })]
      : []),
  ];
}

export function paginationPlacementValid(
  node: BlockNode,
  inList = false,
  depth = 0,
): boolean {
  if (!node || typeof node !== "object" || depth > 10) return false;
  if (node.type === "core/pagination" && !inList) return false;
  return (!Array.isArray(node.children) ? [] : node.children).every((child) =>
    paginationPlacementValid(
      child,
      inList || node.type === "core/post-list",
      depth + 1,
    ),
  );
}

export function insidePostList(
  root: BlockNode,
  id: string,
  inList = false,
): boolean {
  const within = inList || root.type === "core/post-list";
  if (root.id === id) return within;
  for (const child of root.children || []) {
    if (contains(child, id)) return insidePostList(child, id, within);
  }
  return false;
}
function contains(node: BlockNode, id: string): boolean {
  return (
    node.id === id || (node.children || []).some((child) => contains(child, id))
  );
}
export function canPlacePagination(
  root: BlockNode,
  parent: BlockNode,
  node: BlockNode,
) {
  return paginationPlacementValid(node, insidePostList(root, parent.id));
}

/** Compatibility normalization retains authored layouts, IDs, and presentation settings. */
export function normalizeContextBlockTrees(
  roots: BlockNode[],
  relocatePagination = true,
): boolean {
  const before = JSON.stringify(roots);
  const make: MakeBlock = (type, settings = {}, children) => ({
    id: "blk_" + crypto.randomUUID(),
    type,
    settings,
    ...(children ? { children } : {}),
  });
  for (const root of roots) {
    const lists: BlockNode[] = [];
    const orphaned: {
      node: BlockNode;
      parent: BlockNode;
      previous?: BlockNode;
    }[] = [];
    let previous: BlockNode | undefined;
    const visit = (
      node: BlockNode,
      parent?: BlockNode,
      owner?: BlockNode,
      depth = 0,
    ) => {
      if (
        !node ||
        !node.settings ||
        typeof node.settings !== "object" ||
        depth > 10
      )
        return;
      normalizeMenuNode(node);
      const text = String(
        node.settings?.html || node.settings?.text || "",
      ).trim();
      if (
        [
          "core/heading",
          "core/paragraph",
          "core/rich-text",
          "core/html",
        ].includes(node.type)
      ) {
        const title =
          /^(?:\{\{content\.title\}\}|<(?:h[1-6]|p)>\s*\{\{content\.title\}\}\s*<\/(?:h[1-6]|p)>)$/.test(
            text,
          );
        const identity =
          /^(?:\{\{site\.title\}\}|<(?:h[1-6]|p)>\s*\{\{site\.title\}\}\s*<\/(?:h[1-6]|p)>)$/.test(
            text,
          );
        if (title || identity) {
          node.type = title ? "core/title" : "core/site-brand";
          delete node.settings["text"];
          delete node.settings["html"];
          if (identity)
            Object.assign(node.settings, { display: "name", linkHome: false });
        } else if (text === "<p>{{site.title}} · Powered by Colossal</p>") {
          node.type = "core/row";
          delete node.settings["html"];
          node.settings["gap"] ??= 8;
          node.children = [
            make("core/site-brand", {
              display: "name",
              level: "span",
              linkHome: false,
            }),
            make("core/paragraph", { html: "· Powered by Colossal" }),
          ];
        }
      }
      if (node.type === "core/post-list") {
        lists.push(node);
        previous = node;
        owner = node;
        if (!Array.isArray(node.children))
          node.children = postListChildren(make, node.settings, false);
        for (const key of [
          "showExcerpt",
          "excerptLength",
          "showFeaturedImage",
          "showDate",
        ])
          delete node.settings[key];
      }
      if (node.type === "core/pagination" && !owner && parent)
        orphaned.push({ node, parent, previous });
      for (const child of Array.isArray(node.children) ? node.children : [])
        visit(child, node, owner, depth + 1);
    };
    visit(root);
    if (!relocatePagination) continue;
    for (const item of orphaned) {
      const list = item.previous || lists[0];
      item.parent.children = item.parent.children!.filter(
        (child) => child !== item.node,
      );
      if (list) list.children!.push(item.node);
      else
        item.parent.children.push(
          make("core/post-list", { limit: 6, columns: 3 }, [item.node]),
        );
    }
  }
  return before !== JSON.stringify(roots);
}

export function normalizeContextDocument(
  document: ThemeDocument,
  relocatePagination = true,
): boolean {
  if (!document?.templates || !document.parts) return false;
  const changed = normalizeContextBlockTrees(
    [...Object.values(document.templates), ...Object.values(document.parts)],
    relocatePagination,
  );
  const used = new Set<string>();
  const visit = (node: BlockNode, depth = 0) => {
    if (!node || typeof node !== "object" || depth > 10) return;
    used.add(node.type);
    if (Array.isArray(node.children))
      node.children.forEach((child) => visit(child, depth + 1));
  };
  [
    ...Object.values(document.templates),
    ...Object.values(document.parts),
  ].forEach((node) => visit(node));
  let declared = false;
  for (const [type, icon] of [
    ["core/title", "fas fa-text-height"],
    ["core/tagline", "fas fa-comment"],
    ["core/excerpt", "fas fa-align-justify"],
    ["core/site-brand", "fas fa-globe"],
    ["core/featured-image", "fas fa-portrait"],
  ]) {
    if (
      used.has(type) &&
      !document.manifest.blocks.some((block) => block.type === type)
    ) {
      document.manifest.blocks.push({
        type,
        icon,
        file: "blocks/" + type.split("/")[1] + ".html",
      });
      declared = true;
    }
  }
  if (changed || declared) delete document.compiled;
  return changed || declared;
}

/** Convert old menu settings into independently editable blocks. */
export function normalizeMenuNode(
  node: BlockNode,
  pages?: { id: string; kind: string; slug: string; title: string }[],
  site: Record<string, any> = {},
): boolean {
  if (node.type !== "core/menu") return false;
  const before = JSON.stringify(node);
  node.children ??= [];
  const make = (item: any): BlockNode => {
    return {
      id: "blk_" + crypto.randomUUID(),
      type: "core/menu-item",
      settings: {
        label: item.label || "",
        ...(item.pageId ? { pageId: item.pageId } : { href: item.href || "#" }),
      },
      children: (item.children || []).map((child: any) => make(child)),
    };
  };
  if (Array.isArray(node.settings.items)) {
    node.children.unshift(
      ...node.settings.items.map((item: any) => make(item)),
    );
    delete node.settings.items;
    node.settings.automaticPages = false;
  } else if (node.settings.automaticPages === undefined) {
    node.settings.automaticPages = !node.children.some(
      (child) => child.type === "core/menu-item",
    );
  }
  if (pages && node.settings.automaticPages) {
    const posts = pages.find((page) => page.id === site.postsPageId);
    const index =
      site.routingVersion === 2
        ? site.homePageId
          ? posts && "/" + posts.slug
          : "/"
        : site.postRouting === "page" && posts
          ? "/" + posts.slug
          : "/";
    const links: any[] = [];
    if (index !== "/") links.push({ label: "Home", href: "/" });
    if (index)
      links.push(
        posts ? { pageId: posts.id } : { label: "Journal", href: index },
      );
    links.push(
      ...pages
        .filter(
          (page) =>
            page.kind === "page" &&
            ![site.postsPageId, site.homePageId, site.notFoundPageId].includes(
              page.id,
            ),
        )
        .map((page) => ({ pageId: page.id })),
    );
    links.push({ label: "Search", href: "/search" });
    node.children.unshift(...links.map((item) => make(item)));
    node.settings.automaticPages = false;
  }
  return before !== JSON.stringify(node);
}
export function normalizeMenuDocument(
  document: ThemeDocument,
  pages?: { id: string; kind: string; slug: string; title: string }[],
  site: Record<string, any> = {},
): boolean {
  let changed = false;
  const visit = (node: BlockNode) => {
    if (normalizeMenuNode(node, pages, site)) changed = true;
    node.children?.forEach(visit);
  };
  [
    ...Object.values(document.templates || {}),
    ...Object.values(document.parts || {}),
  ].forEach(visit);
  if (changed) delete document.compiled;
  return changed;
}
