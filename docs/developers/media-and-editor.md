# Media and editor APIs

## Select media in a bundled Angular component

Inject `MediaSelectionService` from `shared/media-selection.service.ts`. The shell owns one shared selection dialog.

```ts
const [image] = await this.media.open({
  accept: ["image"],
  multiple: false,
  initialSelectionIds: this.imageId ? [this.imageId] : [],
});
if (image) this.imageId = image.id;
```

The result is `Promise<MediaItem[]>`; cancellation resolves to an empty array. Accepted types are image, audio and video. Omit accept for all types. Persist the stable ID, never a storage filename. The shared grid supports filters, search, metadata editing and uploads.

Files live in the local storage adapter during development. Production needs an R2-compatible `STORAGE` binding supporting put, get (body and arrayBuffer), and delete. File URLs are `/api/media/:id/file`. Only media used in published content or as the site icon is anonymously readable. Range requests support native audio/video players. SVGs must be static with no scripting, external references, animation, or embedded active elements.

## Register a content editor panel

Reviewed, bundled components can inject `ContentEditorPanelRegistry` and register at application startup:

```ts
registry.register({
  id: "com.example.credit",
  title: "Photo credit",
  order: 35,
  pluginId: "com.example.credit",
  fields: [{ key: "com.example.credit", label: "Credit" }],
});
```

For a richer panel, supply a standalone Angular `component` instead of fields. Inject `ContentEditorContext` to read the current Content and call `updatePanel(key, value)`. Namespace keys with your plugin ID. Metadata persists under `content.details.panelData`; the complete map is limited to 10 KB. Remove a plugin's panels using `removePlugin(pluginId)`.

Built-in panels occupy orders 10–50. Duplicate IDs are rejected. Uploaded code is not loaded while runtime approval remains pending.

## Documents and revisions

The shared full-screen editor is mounted at `/admin/posts/edit/:id` and `/admin/pages/edit/:id`. New entries use `/new`. Tiptap JSON is persisted at `details.richText`; body retains plain text for integrations and existing V1 content. Media nodes contain `attrs.mediaId`. Featured images use `details.featuredImageId`.

Dirty content autosaves after 60 seconds. Autosaving published content creates a private revision without changing the live version. Explicit Save draft unpublishes the entry; Publish applies the current document. Keyboard shortcuts are Ctrl/Cmd+S and Ctrl/Cmd+Enter. Navigation away prompts when unsaved changes exist.

`expectedUpdatedAt` protects manual updates against stale writes. Revision snapshots retain media references, so deleting a media item referenced by history is blocked. Deleting its parent entry also deletes that entry's revisions.

## Component previews

Run `pnpm storybook` for the media grid, media drawer and editor panels. Run `pnpm storybook:build` to produce a static preview. Stories use isolated mock data and cannot modify your CMS.
