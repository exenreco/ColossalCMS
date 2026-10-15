import { hydrateLazyLoad } from "../plugins/lazy-load/client";
/** Reviewed frontend contributions. Each contribution checks its public activation marker. */
const contributions = [hydrateLazyLoad];
export function hydrateFrontendPlugins(doc: Document) {
  for (const hydrate of contributions) hydrate(doc);
}
