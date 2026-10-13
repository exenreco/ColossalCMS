# Shared editor workspace

Theme, maintenance, post, and page editors use `EditorShellComponent`. The shell supplies the vertical tool rail, a left block sidebar, an independent right Inspector, breadcrumbs, template chooser, preview tools, viewport menu, inherited admin appearance, draft save, settings, and onboarding. The owning editor retains its document, undo journal, rendering, validation, and publish workflow.

## Panels and canvas

The left sidebar defaults to **List view**, a compact hierarchy of the blocks on the current canvas. The rail switches between **Blocks**, **List view**, and **Outline**; the sidebar selector offers those same three panels. **Inspector** occupies an independent right sidebar, toggled between Save and Editor settings or closed from its heading. It starts closed and opens for canvas selection or a block settings command. Opening Inspector preserves the left panel, selection, expansion and scroll. Both sidebars retain their scroll when closed. Inspector overlays the canvas on tablet screens; on mobile, opening either sidebar closes the other. Escape from Inspector closes it and returns focus to its toolbar trigger. List and Outline share selection, expansion, drag/drop, keyboard commands, and context-menu actions through `BlockListDrawerComponent` and `ThemeOutlineApi`. Outline retains its card presentation. Selecting Body/Main settings or a block on the canvas opens Inspector on the right. List and Outline never replace the canvas. **Fit canvas** fills the remaining workspace, including when the sidebar is closed on wide screens; Desktop, Tablet, and Mobile use 1200, 768, and 390 pixels. The canvas backdrop follows the rendered Body appearance, including colors and gradients around device previews, independently of the editor color mode. Post/page Main settings remain on their Main wrapper. On narrow screens sidebars overlay the canvas.

`EditorShellComponent` projects these slots:

| Attribute          | Content                                               |
| ------------------ | ----------------------------------------------------- |
| `editor-inspector` | Right sidebar block and document/content settings     |
| `editor-blocks`    | Available block library                               |
| `editor-structure` | Current document tree, with List/Outline presentation |
| `editor-canvas`    | Rendered iframe or HTML workspace                     |
| `editor-metadata`  | Theme metadata form                                   |
| `editor-templates` | Template/shared-part choices                          |
| `editor-dialogs`   | Editor confirmation and text-prompt modals            |
| `editor-settings`  | Publishing and additional document actions            |

The shell emits `panelChange`, `widthChange`, `layoutChange`, `save`, `preview`, `leave`, `undo`, and `redo`. `setPanel()` and `openTemplates()` let host editors route keyboard commands and selection changes into the workspace. `setInspector()` and `toggleInspector()` manage the right sidebar; `inspectorChange` reports its visibility separately from left `panelChange`. The existing `setPanel("inspector")` command forwards to the right sidebar for compatibility. Theme outline integrations continue using [ThemeOutlineApi](outline-api.md); document storage and HTTP outline commands are unchanged.

## Menus, popovers, and dialogs

`UiSurfaceComponent` provides `kind="menu"`, `kind="popover"`, and `kind="modal"`. Menus and popovers use the browser top layer, anchored to an element or a context-menu point. They clamp to the viewport, reposition after scrolling/resizing, dismiss on outside click/Escape, and restore focus after keyboard dismissal. Clicking another control preserves the newly clicked target. Menus support Up/Down/Home/End. Modals use native `dialog.showModal()` for focus containment and background isolation. All surfaces inherit editor color tokens and respect reduced motion.

The toolbar's Viewport, Theme preview, and Settings popovers enable `[arrow]="true"`. This adds a decorative caret pointing to the anchor, keeping it aligned when the panel shifts away from a screen edge. Content scrolls inside the panel on short screens; if there is more space above the trigger, the panel flips above it with the caret on its bottom edge. The option applies to anchored bottom-placement popovers and menus; modals and context menus keep their existing presentation.

`EditorDialogComponent` provides Promise-based confirmations and text prompts for leaving, publishing, cloning, reverting, restoring, linking, and removing the last Column. Its header, icon, close control, form, and action footer use editor colors in both modes. Destructive confirmations focus Cancel first; prompts focus their field. Place it in the `editor-dialogs` slot to inherit color tokens. `ThemeEditorState.onConfirmRemoval` lets host editors supply this modal while ordinary deletion stays immediate. List/Outline UI commands request confirmation before removing the last Column; the synchronous theme and HTTP outline APIs are unchanged.

Menu-opening controls have a visible caret and an expanded state. Block-toolbar selects also use an explicit caret instead of relying on a browser arrow. Blocks categories show a count, a rotating caret, and a highlighted expanded heading. Inspector sections use a right-pointing caret when collapsed and a downward caret when expanded, while picker triggers open a popover. Canvas documents receive the same scrollbar styling as the sidebar: a 5px track in Chromium/WebKit, thin scrollbars elsewhere, editor-colored tracks/thumbs, and no native arrow buttons. Chromium's standard scrollbar properties are set to `auto` so its custom scrollbar styles can take effect. Scrollbar colors follow light/dark mode without changing theme appearance.

`PickerPopoverComponent`, the List/Outline context menu, and the media chooser use the same surface. The media chooser follows Settings > Appearance in both the admin and editors. Features should reuse this component rather than implement another positioning/focus controller.

## Drafts and previews

**Icon** (`core/icon`) is available in the theme, maintenance, post and page block libraries. Its Inspector shows the current bundled SVG and opens a searchable icon picker using the shared modal surface. Selecting an icon applies it immediately; Cancel, Escape or the close button leaves the selection unchanged. The picker inherits light/dark mode, contains keyboard focus and supports native button keyboard selection. Icons render locally without a font or network request. Size is limited to 8–512px; color, background, border, spacing and animation use the shared appearance controls. Decorative icons are hidden from screen readers; meaningful icons use the accessible label. Selection and appearance are included in draft save, undo/redo and published content.

Site identity (`core/site-brand`), Title (`core/title`), Featured image (`core/featured-image`) and Excerpt (`core/excerpt`) are available in the shared library. They read administrator settings or current content rather than storing copied names, titles, images or excerpts. Title has no editable canvas text or Inspector text input. Title, Excerpt and Site identity expose the shared Typography picker. Post list is a container with an editable repeating result tree; its dynamic children read each result. Repeated canvas instances have unique `data-block-id` values plus a common `data-source-block-id` so selecting any card edits the correct layout definition and all results update together. Heading, Paragraph and Formatted HTML remain editable inside repeated layouts.

Pagination requires a Post list ancestor. Drop validation, clipboard commands, undo-safe state changes, authenticated outline commands and persistence validation enforce that placement, including layout branches containing Pagination. Its layout branch renders once for the owning list rather than once per result. Older flat lists and sibling Pagination upgrade when opened; saves of newly invalid placements are rejected. See [the context blocks documentation](themes.md) for settings and migration behavior.

`core/paragraph` is available in the shared block library. Its `html` setting contains sanitized inline text and formatting; shared Typography controls set font, size, alignment, line height, indentation, and formatting. Click a Paragraph on the canvas to type directly. Enter starts the next Paragraph, Shift+Enter inserts a line break, pasted text keeps its line breaks, and Ctrl/Cmd+Z (or Shift+Z/Y for redo) uses the document's undo journal. Canvas refreshes wait until typing loses focus so the caret is preserved. Editor placeholders and editing attributes are never published.

Heading blocks (`core/heading`, H1–H6) also use `InlineTextCanvasEditor` for direct canvas typing, inline formatting, paste, caret preservation, and document Undo/Redo. Canvas edits synchronize the Inspector's plain `text` setting and the formatted `html` setting. Heading level and shared Typography controls remain available. Enter creates a Paragraph beneath the Heading using paragraph defaults; Shift+Enter keeps a line break inside the Heading. Clearing a Heading keeps it empty. The same behavior applies to editable templates, shared parts, maintenance layouts, posts, and pages; theme parts shown through a reference are edited in their own shared-part scope.

Opening an empty template or shared part adds a blank Paragraph to its document root. Removing the last root block also restores a blank Paragraph; undo restores the previous content. Empty nested Containers, Columns, Slides, and other layout blocks keep their existing drop areas. New blank posts and pages also start with a Paragraph. Paragraph initialization is included in the next normal draft save. The content editor's HTML mode keeps inline Paragraph source editable and changes it to Formatted HTML when the author adds block-level HTML such as headings or lists.

**Formatted HTML** retains the storage type `core/rich-text`. `HtmlCanvasEditor` replaces that block's rendered content with an authoring-only source editor in every shared canvas. Source is escaped before syntax highlighting and remains inert; the textarea's value is committed to `settings.html`. Line numbers, cursor position, synchronized scrolling, Tab/Shift+Tab indentation, preserved Enter indentation, and document Undo/Redo are shared across editors. Escape moves focus out of the source editor. Focused source edits suppress iframe replacement; Inspector and undo changes synchronize the current textarea. Editor colors and thin scrollbars follow light/dark mode independently of theme appearance. Public rendering and signed previews retain the normal sanitized HTML.

The core catalog supplies the new Formatted HTML label and code icon to existing themes and posts/pages. The idempotent `formatted-html-labels-v1` database migration updates old core definitions and explicit default Rich text labels in theme drafts/published snapshots. Compatibility normalization also applies when importing or opening history. Custom block labels and source/appearance settings are preserved; no block ID or storage type migration is required.

**Save** saves a draft. **Editor settings → Publish** publishes it. Theme preview opens the metadata popover, where administrators edit name, author, description, and license. In the Theme Editor these fields are included in the next theme draft save; content editors offer a separate **Save theme details** action. Editors without administrator access see read-only theme metadata.

**Template preview** in the Theme Editor generates a revision-bound, signed preview of the selected template or shared part. The full-theme preview remains available in the metadata popover. A preview expires after 15 minutes and never activates the theme. Post/page previews render the current unsaved entry in a separate window; a blocked popup produces an editor message.

## User preferences and walkthrough

The first visit presents a skippable seven-step walkthrough. It opens the real Blocks, List, Outline, and Inspector panels and highlights template, viewport, and save controls. Completing, skipping, or dismissing it stores `walkthroughVersion: 1`. Users can replay it from the rail or Editor settings. Completion applies across all shared editors and browsers for the authenticated member.

| Endpoint                            | Purpose                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `GET /api/admin/editor/preferences` | Read the current member's preferences                                   |
| `PUT /api/admin/editor/preferences` | Update `colorMode` (`dark`/`light`) or mark `walkthroughVersion` as `1` |

The server derives the member ID from the session; requests cannot choose another member. Writes require the workspace Origin and JSON. Preferences live in the existing `config` table/collection under `editor-preferences:<member-id>`, so SQLite, MongoDB, and D1 use the same behavior. Responses are not cached. A user-scoped device cache keeps preferences usable if the provider is unavailable; the next preference change retries server persistence.

## Shortcuts

| Shortcut             | Action                                                                    |
| -------------------- | ------------------------------------------------------------------------- |
| Ctrl/Cmd+K           | Open the template chooser (canvas text selections retain link formatting) |
| Ctrl/Cmd+B           | Toggle Blocks, except while editing text                                  |
| Ctrl/Cmd+Shift+L     | Open List view from the workspace or canvas, except while editing text    |
| Ctrl/Cmd+Shift+O     | Open Outline in the sidebar                                               |
| Ctrl/Cmd+Shift+C     | Close the sidebar; keep canvas visible                                    |
| Ctrl/Cmd+1 / 2 / 3   | Desktop / Tablet / Mobile                                                 |
| Ctrl/Cmd+S           | Save draft                                                                |
| Ctrl/Cmd+Z / Shift+Z | Undo / Redo                                                               |

## Local verification

The Node development server serves assembled assets, so build both applications and run `pnpm build:server` (or run `pnpm build`) after source changes. Restart the server after server-module edits. Browser tests use disposable SQLite data and never write to the development workspace database.

```powershell
pnpm lint
pnpm build
$env:CMS_E2E_SPEC='tests/e2e/shared-editor.cy.mjs'
pnpm e2e
Remove-Item Env:CMS_E2E_SPEC
```

## Admin appearance and site identity

`AdminAppearanceService` resolves `settings.adminColorMode` (`light`, `dark`, or `system`) for the dashboard and every shared editor. System follows `prefers-color-scheme` and reacts to changes. `EditorPreferencesService.colorMode` exposes that resolved signal; member-specific walkthrough completion remains separate. Legacy editor color preferences are accepted for API compatibility but do not override workspace appearance. No editor mode toggle is rendered. UI surfaces and media dialogs inherit the same mode; the canvas content retains its own theme appearance.

General > Site Logo (`siteLogoId`) supplies Site Identity images. General > Site Icon (`siteIconId`) separately supplies browser/bookmark icons and the favicon in SEO previews. Existing combined identity images are copied into Site Logo once; explicit empty logo values are preserved. During workspace initialization, an old Logo URL becomes an external image library record when no Site Icon exists. The migration preserves existing Site Icons, removes the old setting, and runs once. External image records redirect to the original HTTPS image instead of fetching it on the server; they can be replaced with uploads. Production file migration skips external records without a storage key.
