# Colossal 2027 portfolio theme

Colossal 2027 is a bundled core theme for Exenreco Bell's developer portfolio. Its charcoal background, silver typography, translucent panels, sticky navigation, and interactive ice portrait are editable through the Theme Editor.

## Activate and customize

1. Open **Themes → Colossal 2027 → Edit**. Home opens first.
2. Edit the hero, project cards, About section, education details, and contact links. The two concept projects and institution/date fields are editable samples.
3. Open the Header or Footer shared part to change navigation, identity, and the three footer columns.
4. Save a draft and use **Preview** to review it without activating it.
5. Publish, then choose **Activate** on the theme card.

Startup seeds the theme inactive. It preserves the current active theme, posts, pages, existing Colossal 2027 edits, and drafts. No portfolio pages or invented education records are added to the content database.

## Templates and routing

| Template          | Purpose                                                            |
| ----------------- | ------------------------------------------------------------------ |
| Home              | Full portfolio landing page with the interactive portrait          |
| Page / Full width | Existing authored page content                                     |
| Single / Posts    | Individual posts and the post index                                |
| Search / 404      | Search results and missing URLs                                    |
| Projects          | Standalone project showcase, selectable on a page                  |
| Resume            | Standalone education and capabilities layout, selectable on a page |

In **Template settings → Landing page at /**, Home is selected by default. This uses the portfolio Home template at `/` when site routing would normally display the post index there. **Follow site routing** removes that preference. A separately configured post-index page keeps its normal Posts template. Existing page template assignments continue to work.

For dedicated Projects or Resume URLs, create published pages, select the corresponding theme template in each page's settings, and update the Header links. The initial navigation links to sections of the landing page.

## Interactive portrait controls

Select the hero's **3D model** block. Its **Source** is `portrait`. The figure is original transparent PNG artwork based on the supplied `tmp/images/model.jpeg`, displayed as a plane inside a live Three.js scene with refractive crystal artifacts. It is not a scanned or rigged full-body model. Normal `media` and `url` sources still render uploaded GLB/glTF models.

| Control                               | Effect                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------- |
| Transparent portrait                  | Choose an image from the media library; overrides the bundled artwork URL |
| Portrait URL                          | Bundled image path or an HTTPS image with CORS permission                 |
| Crystal fragments                     | Number of floating artifacts, from 0 to 40                                |
| Pointer interaction / Motion strength | Pointer parallax; arrow keys work when the scene is focused               |
| Ice tint / Light intensity            | Crystal color and lighting                                                |
| Scroll interaction / Scroll strength  | Subtle rotation and movement while scrolling                              |
| Camera zoom / Height                  | Framing and scene dimensions                                              |
| Lazy load                             | Load the scene as it approaches the viewport                              |
| Alt text / Accessible label           | Portrait description and interaction instructions                         |

The **Replace** toolbar button opens the image picker for portrait mode. The same source-aware Inspector and toolbar work in themes, posts, and pages. An Overlay block can still provide content above the scene.

Three.js loads in a separate chunk. Rendering uses bounded pixel density and pauses while the scene is offscreen or the document is hidden. Reduced-motion preferences disable automatic movement. The PNG remains visible while loading and if WebGL or image loading fails.

## Liquid glass controls

The shared **Glass** popover appears in the theme, page, and post Inspectors. Enable **Liquid glass**, set **Blur** from 0–48 px and **Saturation** from 50–200%, then use **Background** for tint/opacity and **Border** for shape. A translucent background lets the backdrop blur remain visible. Browsers without backdrop-filter support keep the tint and border.

The sticky header's position is defined in the theme CSS. Its glass effect is editable on the Header part's root block. Cards and the contact panel use the same shared controls. **Layout → Position → Sticky** also supports authoring sticky blocks with editable offsets and z-index.

## Assets and implementation

| File                                           | Role                                           |
| ---------------------------------------------- | ---------------------------------------------- |
| `server/colossal-2027.mjs`                     | Theme manifest, editable trees, and scoped CSS |
| `public/themes/colossal-2027/ice-portrait.png` | Transparent ice artwork                        |
| `public/themes/colossal-2027/project-*.svg`    | Original project interface illustrations       |
| `shared/portrait-scene-runtime.ts`             | Lazy Three.js scene and cleanup                |
| `shared/pickers/glass-picker.component.ts`     | Shared appearance control                      |

Bundled public assets ship with the application, so copies of this theme can use them on another Colossal CMS deployment. Replacement library images use the normal media-reference protections and configured storage provider.

The composition was inspired by [MengTo's Kage](https://mengto.github.io/kage/) and the supplied [Collect UI portfolio reference](https://collectui.com/designs/portfolio-ui-design-inspiration). Theme code, illustrations, and portrait artwork were created for Colossal CMS; Kage's source and artwork are not included.
