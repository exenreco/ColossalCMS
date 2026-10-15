# Plugin architecture

V2 manifests contain id, name, version, description, author, license, isCore, requires.colossal, requires.plugins, admin.entryComponent, admin.menu (including integer order), and frontend.routes. Active navigation is sorted by menu.order. Seven core plugins are locked: Dashboard, Media, Posts, Pages, Settings, Themes and Plugins. Reading time and Announcement are bundled optional examples.

As of v2.0.2 a plugin may declare loading skeletons. `admin.skeleton` and `frontend.skeleton` each take a `component` name and a `variant` of `table`, `grid`, `form` or `detail`. When omitted, the shell falls back to a generic skeleton inferred from the plugin's declared variant, so a missing declaration never blocks a route:

```json
"admin": {
  "entryComponent": "PostsAdminComponent",
  "menu": { "label": "Posts", "icon": "posts", "path": "/admin/posts", "order": 30, "group": "main" },
  "skeleton": { "component": "PostsListSkeletonComponent", "variant": "table" }
}
```

## Admin sidebar submenus

Declare optional `admin.menu.children` to turn a top-level sidebar item into an expandable group. Items without children remain normal links. Opening a group by clicking its parent navigates to the first child and makes that child active; clicking the open parent collapses it. Clicking another child navigates to that child's page. The current page's group opens automatically on navigation and reload. Only one group is expanded at a time. Opening a group from the compact rail expands the sidebar, while mobile navigation closes only after choosing a child destination.

```json
"menu": {
  "label": "Messaging",
  "icon": "envelope",
  "path": "/admin/messaging",
  "order": 970,
  "group": "system",
  "children": [
    { "id": "inbox", "label": "Inbox", "path": "/admin/messaging", "queryParams": { "tab": "inbox" } },
    { "id": "settings", "label": "Settings", "path": "/admin/messaging", "queryParams": { "tab": "settings" } }
  ]
}
```

Each child requires a unique lowercase `id`, a label and an existing path inside the plugin's admin route. Optional `queryParams` maps strings to strings. Up to 20 links and one submenu level are supported; declarations do not create routes or grant permissions. Route guards and API authorization still apply. The first child is the default section when its query parameters are absent. Use `adminSections` from `shared/admin-sections.ts` to synchronize an existing component's section selector with the `tab` query parameter, including browser Back/Forward.

Pages and Posts expose their list and creation routes; Settings, Connections and Messaging expose their existing sections. Parent groups use accessible disclosure controls with `aria-expanded` and `aria-controls`. Enter/Space toggles, Right opens and focuses the first child, and Left/Escape closes and returns focus to the parent. Children remain ordinary links with current-page styling. Navigation badges remain on their parent group.

## Bundled plugin registration

Plugins can contribute controls immediately before **View site** in the admin's top toolbar. Import `AdminToolbarDirective` from `shared/admin-toolbar.ts` and wrap the controls in `<ng-template clAdminToolbar>…</ng-template>`. The template retains its plugin component context and is removed when that view is destroyed. Use it conditionally for section-specific controls; Messaging uses it for the inbox status filter. This is a single slot for the current page, and does not grant additional API permissions.

1. Create plugins/<name>/plugin.manifest.json.
2. Register the manifest in plugins/registry.mjs and shared/plugin-registry.service.ts.
3. Add a standalone Angular component to the lazy PLUGIN_COMPONENTS mapping.
4. Implement its frontend behavior and server operations with authorization and validation.
5. Add migrations for schema changes and run the checks.

Bundled code is compiled with the app. Upload installation is a separate staged-storage path; no uploaded JavaScript is loaded while execution approval remains pending.

- [Media Selection API and content editor panels](developers/media-and-editor.md)
- [ZIP packaging and rollback](developers/plugin-zip.md)
