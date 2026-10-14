import corePatterns from "../shared/core-patterns.json" with { type: "json" };
import {
  registerBlockPatterns,
  validateBlockPatterns,
} from "../shared/block-patterns.ts";
import {
  defaultTheme,
  validateDocument,
  renderTheme,
} from "./theme-engine.mjs";
export function collectBlockPatterns(theme, plugins = []) {
  return [
    ...registerBlockPatterns(
      { kind: "core", id: "colossal", name: "Colossal Core" },
      corePatterns,
    ),
    ...registerBlockPatterns(
      { kind: "theme", id: theme.manifest.id, name: theme.manifest.name },
      theme.manifest.patterns || [],
    ),
    ...plugins
      .filter((p) => p.active)
      .flatMap((p) =>
        registerBlockPatterns(
          { kind: "plugin", id: p.id, name: p.name },
          p.patterns || [],
        ),
      ),
  ];
}
export function renderPatternPreview(pattern, theme, context) {
  validateBlockPatterns([pattern]);
  const document = structuredClone(theme || defaultTheme());
  const template = document.manifest.templates[0];
  document.templates[template.id] = {
    id: "pattern-preview-root",
    type: "core/container",
    settings: {},
    children: structuredClone(pattern.blocks),
  };
  delete document.compiled;
  const sanitized = validateDocument(document, true);
  return renderTheme(
    sanitized,
    { ...context, adsPreview: true, kind: template.appliesTo[0] },
    template.id,
  );
}
