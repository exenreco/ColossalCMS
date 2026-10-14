# Block patterns

Patterns are reusable layouts made from native block trees. Open **Patterns** from the compact editor rail or the sidebar's panel dropdown. Search by name, description, category or provider, choose a category, and select a preview card to insert its blocks. The same library is available in theme, maintenance, page and post editors.

Each pattern requires a name, category and block data. Previews use the server's sanitized theme renderer in a script-free sandbox. Insertion gives every block a fresh ID, preserves the registration, and creates one Undo step. Inserted copies are independent: changing one does not change its provider or other copies. Nothing is published automatically.

## Declarative registration

Add a `patterns` array to a theme's `theme.manifest.json` or a plugin's `plugin.manifest.json`:

```json
{
  "patterns": [
    {
      "id": "introduction",
      "name": "Simple introduction",
      "category": "Heroes",
      "description": "A heading and a short introduction.",
      "blocks": [
        {
          "id": "intro-group",
          "type": "core/group",
          "settings": { "padding": 32 },
          "children": [
            {
              "id": "intro-heading",
              "type": "core/heading",
              "settings": { "text": "Welcome", "level": "h2" }
            },
            {
              "id": "intro-copy",
              "type": "core/paragraph",
              "settings": { "html": "Describe your work here." }
            }
          ]
        }
      ]
    }
  ]
}
```

Core patterns live in `shared/core-patterns.json`. Theme patterns come from the theme being edited; page and post editors use the active theme. Plugin patterns appear only while their plugin is active. Provider namespaces keep an identically named core, theme or plugin pattern from replacing another provider's registration. Pattern block types must be available in the destination editor. Shared-part references retain their linked source and must satisfy the existing placement and cycle rules.

A provider may declare up to 50 patterns within 300 KB. Each pattern may contain at most 100 blocks. IDs must be unique within the provider, and block IDs must be unique within each pattern. Names and categories must be plain text. The editor's depth and total block budgets still apply after insertion; an invalid insertion is rolled back as a whole. Patterns are declarative data and do not execute uploaded plugin scripts.

## Reviewed runtime registration

Built-in or reviewed editor extensions can inject `PatternRegistry` and register contributions dynamically:

```ts
import { inject } from "@angular/core";
import { PatternRegistry } from "./pattern-registry.service";

const unregister = inject(PatternRegistry).register(
  { kind: "plugin", id: "com.example.extension", name: "Example extension" },
  [introductionPattern],
);
// Remove this contribution when the extension unloads.
unregister();
```

Use the actual active plugin ID for plugin contributions. `registerBlockPatterns(source, patterns)` in `shared/block-patterns.ts` provides the framework-independent validation and namespace function; `clonePatternBlocks(pattern)` creates independent instances.

## Editor HTTP API

| Method | Endpoint                                  | Purpose                                                                                                           |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/admin/editor/patterns?themeId=<id>` | Return `{ patterns }` from core, the selected theme and active plugins. Omitting the theme uses the active theme. |
| POST   | `/api/admin/editor/patterns/preview`      | Render `{ pattern, themeId? }` into sanitized HTML and CSS without saving or publishing.                          |

Both endpoints require a workspace session. Preview requests require the workspace origin and JSON. An unknown theme ID uses the active theme, allowing content editors to use their synthetic Main document. Rendering validates supported block types, nesting, settings and shared parts through the normal theme validation boundary. Script execution is disabled in preview frames; interactive models and sliders remain editable after insertion in the full canvas.
