/** Reviewed, bundled contributions only. Uploaded package code is never evaluated. */
export function createPluginRegistry(contributions) {
  const blockRenderers = new Map();
  const ids = new Set(),
    routes = [],
    documents = [],
    metadata = [];
  for (const contribution of contributions) {
    if (!contribution.id || ids.has(contribution.id))
      throw new Error("Duplicate or missing plugin contribution ID.");
    ids.add(contribution.id);
    for (const [type, render] of Object.entries(
      contribution.blockRenderers || {},
    )) {
      if (
        type.startsWith("core/") ||
        !type.includes("/") ||
        typeof render !== "function" ||
        blockRenderers.has(type)
      )
        throw new Error("Invalid or duplicate plugin block renderer.");
      blockRenderers.set(type, render);
    }
    for (const route of contribution.routes || []) {
      if (
        !["public", "admin"].includes(route.scope) ||
        typeof route.handle !== "function" ||
        !Array.isArray(route.methods) ||
        !route.methods.length ||
        [route.path, route.prefix, route.pattern].filter(Boolean).length !== 1
      )
        throw new Error("Invalid plugin route contribution.");
      const key = `${route.scope}:${route.path || route.prefix || route.pattern}`;
      if (
        routes.some(
          (existing) =>
            existing.key === key &&
            existing.methods.some((method) => route.methods.includes(method)),
        )
      )
        throw new Error("Conflicting plugin route contributions.");
      routes.push(
        Object.freeze({
          ...route,
          methods: Object.freeze([...route.methods]),
          key,
          pluginId: contribution.id,
        }),
      );
    }
    if (contribution.document) documents.push(contribution.document);
    if (contribution.metadata) metadata.push(contribution.metadata);
  }
  return Object.freeze({
    styles: contributions
      .map((contribution) => contribution.styles || "")
      .join("\n"),
    ids: Object.freeze([...ids]),
    renderBlock(type, settings, context, helpers) {
      const render = blockRenderers.get(type);
      return render ? render(settings, context, helpers) : undefined;
    },
    async dispatch(scope, context) {
      for (const route of routes) {
        const matches = route.path
          ? context.path === route.path
          : route.prefix
            ? context.path === route.prefix ||
              context.path.startsWith(route.prefix + "/")
            : new RegExp(route.pattern).test(context.path);
        if (
          route.scope !== scope ||
          !matches ||
          !route.methods.includes(context.request.method)
        )
          continue;
        if (scope === "admin" && !context.user)
          throw Object.assign(new Error("Sign in to continue."), {
            status: 401,
          });
        if (route.admin && context.user?.role !== "admin")
          throw Object.assign(new Error("Administrator access is required."), {
            status: 403,
          });
        const response = await route.handle(context);
        if (response != null) {
          if (!(response instanceof Response))
            throw new Error("Plugin routes must return a Response or null.");
          return response;
        }
      }
      return null;
    },
    async document(context) {
      for (const hook of documents) {
        const result = await hook(context);
        if (result) return result;
      }
      return null;
    },
    async metadata(context) {
      const fragments = [];
      for (const hook of metadata) {
        const html = await hook(context);
        if (html) fragments.push(html);
      }
      return fragments.join("");
    },
  });
}
