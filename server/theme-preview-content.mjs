import { contentTemplateScope } from "../shared/content-template-scope.ts";
import { resolveTemplateForContent } from "./theme-engine.mjs";

/** A template is a layout, not content: only preview entries using this layout. */
export function templatePreviewContent(document, template, context) {
  const candidates = context.allContent.filter((entry) =>
    template.appliesTo.includes(
      contentTemplateScope(entry.kind, entry.id, context.settings),
    ),
  );
  return (
    candidates.find((entry) => entry.templateId === template.id) ||
    candidates.find(
      (entry) =>
        resolveTemplateForContent(
          document,
          contentTemplateScope(entry.kind, entry.id, context.settings),
          entry.templateId,
        ).template?.id === template.id,
    ) || {
      title: `Sample title · ${template.name}`,
      excerpt: "Sample excerpt for this template preview.",
      body: "Sample content for this template preview.",
      details: {},
    }
  );
}
