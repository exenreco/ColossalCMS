import type { Settings } from "./models";
/** Routing pages use their route's templates in every content editing surface. */
export function contentTemplateScope(
  kind: "page" | "post",
  id: string,
  settings?: Settings,
) {
  if (kind !== "page" || !id) return kind;
  if (id === settings?.postsPageId) return "post-index";
  if (id === settings?.notFoundPageId) return "404";
  if (id === settings?.homePageId) return "home";
  return kind;
}
