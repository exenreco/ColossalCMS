// Keep the installed identity and asset URLs stable for existing sites and exports.
export const GLASSEY_THEME_ID = "com.colossal.theme.colossal-2027";

export function isGlasseyTheme(id) {
  return (
    typeof id === "string" &&
    (id === GLASSEY_THEME_ID || id.startsWith(GLASSEY_THEME_ID + "."))
  );
}

/** Update an owned document; retain custom footer copy and all block identities. */
export function migrateGlasseyDocument(document) {
  if (!isGlasseyTheme(document?.manifest?.id)) return document;
  document.manifest = migrateGlasseyManifest(document.manifest);
  const visit = (node) => {
    if (
      node?.type === "core/rich-text" &&
      typeof node.settings?.html === "string"
    )
      node.settings.html = node.settings.html.replace(
        '<p class="c27-small-label">COLOSSAL 2027 / PORTFOLIO</p>',
        '<p class="c27-small-label">GLASSEY / PORTFOLIO</p>',
      );
    node?.children?.forEach(visit);
  };
  visit(document.parts?.footer);
  return document;
}

export function migrateGlasseyManifest(manifest) {
  if (!isGlasseyTheme(manifest?.id)) return manifest;
  return {
    ...manifest,
    name: manifest.name === "Colossal 2027" ? "Glassey" : manifest.name,
    isCore: false,
  };
}
