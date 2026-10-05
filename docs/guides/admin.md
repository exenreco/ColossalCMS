# Colossal CMS V2 administrator guide

## Write a page or post

Choose Pages or Posts, then Create. The secondary toolbar has a **Blocks** button that slides the full library in from the left, **Canvas** for a live preview of unsaved content, **Outline** for the nested block tree, Undo/Redo and Desktop/Tablet/Mobile widths. Choose or drag a block into Canvas or Outline; its contextual toolbar provides quick formatting, media replacement, duplication, deletion and a drag handle. The right-side Inspector provides all settings and movement controls. Layout blocks such as Container, Row and Columns can contain other blocks; Columns starts with two Column children. The library also includes the active theme's custom blocks. **HTML** edits the selected Rich text or HTML fragment block's source while preserving safe block markup and the surrounding block layout. Scripts, embeds, forms, unsafe links and event attributes are rejected. Existing rich-text posts and pages open as a Rich text block. The **Excerpt** field remains in the right panel alongside status, featured image, categories/tags, SEO, author and saved revisions.

Canvas links stay inside the unsaved preview. Shared site header and footer blocks are edited in the Theme Editor; clicking one shows a note without leaving the Canvas.

Save draft keeps the entry private; Pending review marks work awaiting review. Publish makes it visible. Scheduled accepts a future local date/time. Ctrl/Cmd+S saves a draft; Ctrl/Cmd+Enter publishes. Dirty entries autosave every 60 seconds. Published entries autosave to private revision history until you explicitly publish. Restoring a revision populates the editor; save to apply it.

Changing an existing published entry to Draft removes it from the public site. Unsaved changes prompt before closing. Server updates reject stale writes when another edit has already been saved.

## Upload and manage media

Choose Media → Upload media. Select or drop PNG, JPG, GIF, WebP, static SVG, MP3, WAV, OGG, MP4 or WebM, up to 25 MB. Models accept GLB, self-contained glTF, or a ZIP containing one glTF and its local assets, up to 100 MB. Add descriptive alt text for images and models. Progress reflects the upload.

Switch between grid/list, filter by type or search names, alt text and tags. Open a file to edit its name, alt text, caption, description and tags. The drawer shows size, dimensions or duration where readable, uploader and date.

Replace file keeps the media ID and all references. Replacement must keep the same media type. Delete is blocked while content, revision history or settings reference the file; the drawer lists those references.

Model cards show a schematic poster. Open a model to load its interactive 3D preview. Remote resources inside uploaded models are rejected; a direct model URL in a theme must use HTTPS and permit cross-origin browser requests.

## Set your site icon

Settings → General → Select site icon opens the shared image library. Choose an image, Use selected, then Save changes. The public site's browser tab uses it. Remove clears the setting without deleting the media.

## Assign page roles

In Settings → General → Pages & Routing, choose a published Home page or keep Latest posts at `/`. Once Home is a page, you can assign a different published Posts page for the post index. The 404 selector uses a published page for unmatched routes; its content appears in the theme's 404 template, and it is excluded from navigation and ordinary page routing. A page can hold one role; the Pages list shows role badges and supports a role filter. Only published pages appear in the selectors.

Unpublishing or deleting an assigned page clears its role and creates a dashboard notice. The page editor's Template panel offers Home templates for the Home page, page templates for ordinary pages, post-index templates for the Posts page, and 404 templates for the 404 page.

## Install plugins

Plugins → Upload plugin accepts a compatible V2 ZIP. After validation it appears inactive. **Uploaded plugin activation is currently disabled pending approval of trusted code execution.** Bundled extensions can still be installed and activated.

Previous uploaded versions can be restored when available. Core plugins are always active. Only administrators can change plugins.

## Team and integrations

Administrators manage membership and read-only API keys in Settings. Editors can author content and manage media. Platform Site sharing is separate from CMS membership; adding a member sends no invitation. API keys can read published content only and should be copied once when created.
