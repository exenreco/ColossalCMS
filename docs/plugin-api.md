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

For a bundled plugin:

1. Create plugins/<name>/plugin.manifest.json.
2. Register the manifest in plugins/registry.mjs and shared/plugin-registry.service.ts.
3. Add a standalone Angular component to the lazy PLUGIN_COMPONENTS mapping.
4. Implement its frontend behavior and server operations with authorization and validation.
5. Add migrations for schema changes and run the checks.

Bundled code is compiled with the app. Upload installation is a separate staged-storage path; no uploaded JavaScript is loaded while execution approval remains pending.

- [Media Selection API and content editor panels](developers/media-and-editor.md)
- [ZIP packaging and rollback](developers/plugin-zip.md)
