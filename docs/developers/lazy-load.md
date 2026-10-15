# Lazy Load

Lazy Load (`com.colossal.lazy-load`) is an optional bundled plugin. Install and activate it in **Plugins**, then open **Lazy Load** to enable image loading, choose a spinner color and size (16–64px), and prioritize the first content image.

The plugin uses native `loading="lazy"`, retaining normal `src`, `srcset`, `<picture>`, dimensions, links and image hierarchy. A lightweight SVG background spinner appears on pending images and clears on load or error, including cached images. Reduced-motion preferences receive a static indicator. Native lazy loading still works without JavaScript; a noscript rule hides the spinner.

Header/logo images, ice-scene artwork, data/blob images, and images under the `no-lazy` CSS class are excluded. Existing eager/high-priority loading is respected. The first eligible content image loads eagerly by default. Theme previews and editor canvases are unchanged. CSS background images and video are outside this plugin's scope.

## APIs and storage

| Endpoint               | Method | Access        | Purpose                 |
| ---------------------- | ------ | ------------- | ----------------------- |
| `/api/admin/lazy-load` | GET    | Administrator | Read settings           |
| `/api/admin/lazy-load` | POST   | Administrator | Save validated settings |

Settings use the `config` row `lazy-load`: `enabled`, `spinnerColor`, `spinnerSize`, `skipFirstImage`. No environment keys or database migration are required. Disabling/deactivating the plugin removes its behavior from subsequent page loads.

## Integration

The reviewed server plugin contributes a generic `transformRender(rendered, context)` hook through `server/plugin-runtime.mjs`. The host applies transforms to public document/API renders, including maintenance document overrides. Client cleanup is registered through `shared/frontend-plugin-registry.ts`; all image-specific logic remains in `plugins/lazy-load`. Transforming an already decorated render is idempotent. Nothing changes stored page blocks or theme documents.
