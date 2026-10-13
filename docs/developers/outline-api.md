# Outline editor API — v0.0.3

The Theme Editor's Outline and compact Block list use `ThemeOutlineApi`. It exposes the current block tree, selection, collapse state and document commands. Posts, pages and maintenance layouts use the same local integration. The authenticated theme HTTP endpoints apply the same document command implementation to persisted drafts.

The outline shows **Body settings** (or **Main settings** for posts/pages) above the block list. Root children appear at the top level; only actual block containers expand and collapse. Shared-part roots have a corresponding settings control. This is a presentation change: API snapshots and saved documents still include the root, and top-level insertions/moves use its ID as `parentId`. Roots cannot be collapsed through the editor API. Selecting the settings control opens the Inspector; its + button inserts a top-level block, including in an empty document.

## Theme metadata

Use optional metadata on any non-root block in `theme.draft.json`:

```json
{
  "id": "blk_hero",
  "type": "core/container",
  "editor": { "label": "Hero section", "icon": "fas fa-layer-group" },
  "settings": {},
  "children": []
}
```

Labels must be nonempty plain text, at most 80 characters, without HTML or control characters. Icons use `fa-name` or `fas fa-name` tokens. Recognized tokens resolve to local inline SVGs; unknown tokens show the generic block icon. Metadata survives save, publish, history, clone and export, but does not change public text or CSS. Template roots retain **Body**; post/page roots retain **Main**. Shared references are movable, but cannot be copied, duplicated or deleted by outline commands.

Custom block definitions also supply their default `label` and `icon`. A node's metadata overrides those defaults. Uploaded theme scripts remain disabled; declarative metadata needs no executable code.

## Live editor integration

Reviewed, bundled Angular integrations can inject `ThemeOutlineApi` inside an editor's provider scope. Same-window editor integrations can use `window.colossalThemeEditor`; it is removed when that editor is destroyed. The `colossal:outline-ready` event announces a new editor API. A ready API may initially have no document while the record loads.

```ts
window.addEventListener("colossal:outline-ready", (event) => {
  const api = (event as CustomEvent).detail.api;
  const unsubscribe = api.subscribe((snapshot) => {
    if (!snapshot) return;
    console.log(snapshot.apiVersion, snapshot.templateId, snapshot.selectedId);
  });
  // Call unsubscribe() when the integration unmounts.
});

const api = window.colossalThemeEditor;
api?.dispatch({ type: "select", id: "blk_hero" });
api?.dispatch({ type: "rename", id: "blk_hero", label: "Landing hero" });
api?.dispatch({ type: "icon", id: "blk_hero", icon: "fas fa-star" });
```

| Method                          | Contract                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `getOutline()`                  | Returns a detached snapshot or null while loading                                                  |
| `subscribe(callback)`           | Immediately supplies a snapshot, then reports reactive changes; returns an unsubscribe function    |
| `dispatch(command)`             | Returns whether the command was accepted; validation errors appear in the editor                   |
| `canRun(action, id)`            | Checks copy, cut, paste-after, paste-inside, duplicate, remove, up, down or edit-part availability |
| `expandAll()` / `collapseAll()` | Changes presentation without editing the document                                                  |

Snapshots include `apiVersion: 1`, `themeId`, `templateId`, `part`, `selectedId`, `collapsedIds`, `canUndo`, `canRedo` and `root`. Each tree node has `id`, `type`, `label`, `icon`, `summary`, `movable`, `removable`, and optional `children`. Subscription snapshots are detached so extensions cannot mutate editor state by changing a returned object.

Local presentation commands are `select`, `expand`, `collapse`, and `edit-part`, each with an `id`. Local clipboard commands are `copy`, `cut`, `paste-after`, and `paste-inside`. Local `up`/`down` move a sibling; `undo`/`redo` use the shared document journal. These commands are not HTTP operations because their state belongs to the open editor.

Document commands edit the local draft and share the Inspector's undo history. They do not save or publish automatically. Use the editor's Save Draft and Publish controls.

## Document commands

| Type        | Required fields              | Behavior                                                                 |
| ----------- | ---------------------------- | ------------------------------------------------------------------------ |
| `insert`    | `blockType, parentId, index` | Creates defaults with fresh IDs; optional `settings` overrides           |
| `move`      | `id, parentId, index`        | Moves an existing subtree; preserves all IDs                             |
| `duplicate` | `id`                         | Inserts a copy after the original; regenerates every subtree ID          |
| `remove`    | `id`                         | Removes a subtree or shared block instance; document roots are protected |
| `update`    | `id, settings`               | Merges settings; normal persistence sanitization applies                 |
| `rename`    | `id, label`                  | Sets the outline label                                                   |
| `icon`      | `id, icon`                   | Sets the outline icon token                                              |
| `paste`     | `parentId, index, node`      | Inserts a supplied subtree with fresh IDs                                |

Insertion indexes are zero-based positions in the destination's children **before** removal. Moving a sibling forward adjusts the index automatically. Moving into Columns wraps non-column blocks in a new Column. Slides belong inside Sliders; Overlays belong inside Slides or 3D blocks. Cycles, unknown types, excessive depth and duplicate IDs are rejected. Removing the last Slide or Column requires removing its parent instead. Nesting is bounded at 16 levels and theme persistence is bounded at 2,000 total blocks.

## HTTP endpoints

Both endpoints require an administrator session. POST also requires the current numeric theme revision, JSON, and a same-origin `Origin` header. Existing Node password sessions and hosting gateway sessions use the same authorization path as other theme endpoints. Public read keys do not grant authoring access.

```http
GET /api/themes/com.example.portfolio/outline?templateId=home
GET /api/themes/com.example.portfolio/outline?part=header
GET /api/themes/com.example.portfolio/outline?templateId=home&draft=false
```

GET prefers the draft when one exists. Omitting `templateId` chooses the landing template, then Home, then the first template. `part` selects a shared part instead. The response adds `revision` and `status: "draft" | "published"` to the versioned tree; server reads have no persisted selection or collapse state.

```http
POST /api/themes/com.example.portfolio/outline
Content-Type: application/json
Origin: https://cms.example

{
  "apiVersion": 1,
  "revision": 7,
  "templateId": "home",
  "command": {
    "type": "insert",
    "parentId": "blk_hero",
    "index": 0,
    "blockType": "core/heading",
    "settings": { "text": "Welcome", "level": "h1" }
  }
}
```

POST validates the complete theme document and referenced media, then saves a **private draft**, increments `revision`, and returns the updated outline with `selectedId`. Published content, activation and owned assets stay intact. Stale revisions return 409; invalid commands return 400; missing templates/parts return 404; anonymous requests return 401 and unauthorized roles or origins return 403. Reload before retrying a conflict.

HTTP changes do not enter another browser tab's local undo journal. A tab with an older revision must reload before saving. HTTP commands can edit a shared part with `part: "header"` instead of `templateId`; templates retain their references and use that part when the draft is previewed or published.

See [OpenAPI](../openapi.yaml) for request and response contracts and [theme packages](themes.md) for rendering and persistence rules.
