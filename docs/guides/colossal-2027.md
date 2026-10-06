# Colossal 2027 portfolio theme

Colossal 2027 is a bundled core theme for Exenreco Bell's developer portfolio. Its dark moonlit landscape, silver typography, translucent panels, sticky navigation, and interactive ice throne are editable through the Theme Editor.

## Activate and customize

1. Open **Themes → Colossal 2027 → Edit**. Home opens first.
2. Edit the hero, project cards, About section, education details, and contact links. The two concept projects and institution/date fields are editable samples.
3. Open the Header or Footer shared part to change navigation, identity, and the three footer columns.
4. Save a draft and use **Preview** to review it without activating it.
5. Publish, then choose **Activate** on the theme card.

Startup seeds the theme inactive. It preserves the current active theme, posts, pages, existing Colossal 2027 edits, and drafts. No portfolio pages or invented education records are added to the content database.

Existing Colossal 2027 documents receive the full-viewport scene upgrade when opened or rendered. The compatibility migration preserves block IDs, authored text, other templates, shared parts, custom CSS, and replacement images. The upgraded document is persisted on the next save or publish. The original database record and theme history remain available until then.

## Templates and routing

| Template          | Purpose                                                            |
| ----------------- | ------------------------------------------------------------------ |
| Home              | Full portfolio landing page with the interactive ice throne        |
| Page / Full width | Existing authored page content                                     |
| Single / Posts    | Individual posts and the post index                                |
| Search / 404      | Search results and missing URLs                                    |
| Projects          | Standalone project showcase, selectable on a page                  |
| Resume            | Standalone education and capabilities layout, selectable on a page |

In **Template settings → Landing page at /**, Home is selected by default. This uses the portfolio Home template at `/` when site routing would normally display the post index there. **Follow site routing** removes that preference. A separately configured post-index page keeps its normal Posts template. Existing page template assignments continue to work.

For dedicated Projects or Resume URLs, create published pages, select the corresponding theme template in each page's settings, and update the Header links. The initial navigation links to sections of the landing page.

## Full-screen ice world

The hero measures **100vh × 100vw** within the page width, with `100svh` support for mobile browser controls. The throne image is contained within the camera frame, preserving its aspect ratio and showing the full figure, throne, and base. At narrow widths the figure sits above the headline and primary action.

The Three.js canvas stays fixed behind the landing page. Scrolling moves the moon and ice figure subtly, increases snowfall, and strengthens wind that carries flakes across the landscape. Foreground sections use dark glass panels to keep text readable. Pointer movement adds slight parallax; normal links and navigation remain clickable.

The moon is a 3D sphere with an original procedural crater texture, a shaded phase, and an atmospheric rim. Snow, wind trails, layered terrain, sky, stars, throne, and floating ice fragments each have a separate reusable component. The supplied [moonlit landscape reference](https://i.etsystatic.com/61056266/r/il/6a7a78/7964699562/il_570xN.7964699562_oy8y.jpg) informed the atmosphere; its image is not bundled or loaded by the theme.

## Scene and portrait controls

Select the hero's **3D model** block. Its **Source** is `portrait` and **Scene preset** is `ice-world`. The full-body figure and crystalline throne are original transparent PNG artwork based on the supplied `tmp/images/model.jpeg` and previous ice portrait, displayed as a plane inside the live Three.js environment. The figure is not a scanned or rigged mesh. Normal `media` and `url` sources still render uploaded GLB/glTF models. Select the `portrait` preset to use the earlier compact crystal scene.

| Control                                       | Effect                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| Scene preset                                  | `ice-world` environment or the compact `portrait` scene                   |
| Full viewport background                      | Keep the ice world fixed behind the page; disable for an inline scene     |
| Transparent portrait                          | Choose an image from the media library; overrides the bundled artwork URL |
| Portrait URL                                  | Bundled image path or an HTTPS image with CORS permission                 |
| Moon / Moon size / Moon elevation / Moon tint | Enable the moon and adjust its size, height, and color                    |
| Snow terrain                                  | Enable the layered mountain and snow field                                |
| Snow / Snow density                           | Enable flakes and set their bounded count, from 0–1800                    |
| Wind / Wind strength                          | Enable gusts and adjust their force, from 0–3                             |
| Crystal fragments                             | Number of floating artifacts, from 0 to 40                                |
| Pointer interaction / Motion strength         | Pointer parallax; arrow keys work when the scene is focused               |
| Ice tint / Light intensity                    | Crystal color and lighting                                                |
| Scroll interaction / Scroll strength          | Scene movement and weather intensity as the page scrolls                  |
| Camera zoom / Height                          | Camera framing; Height appears for inline scenes                          |
| Lazy load                                     | Load the scene as it approaches the viewport                              |
| Alt text / Accessible label                   | Portrait description and interaction instructions                         |

The **Replace** toolbar button opens the image picker for portrait mode. The same source-aware Inspector and toolbar work in themes, posts, and pages. An Overlay block can still provide content above the scene.

Moon, snow-density, and wind-strength settings hide when their component is disabled. The same controls work in all three block Inspectors.

Three.js loads in a separate chunk. Rendering uses bounded pixel density, frame rate, and particle counts, and pauses when the document is hidden. Inline scenes also pause offscreen; the full-viewport background keeps rendering during page scrolling. Reduced-motion preferences disable wind, flake motion, parallax, and scroll movement while retaining the scene. The PNG remains visible while loading and if WebGL or image loading fails.

## Liquid glass controls

The shared **Glass** popover appears in the theme, page, and post Inspectors. Enable **Liquid glass**, set **Blur** from 0–48 px and **Saturation** from 50–200%, then use **Background** for tint/opacity and **Border** for shape. A translucent background lets the backdrop blur remain visible. Browsers without backdrop-filter support keep the tint and border.

The sticky header's position is defined in the theme CSS. Its glass effect is editable on the Header part's root block. Cards and the contact panel use the same shared controls. **Layout → Position → Sticky** also supports authoring sticky blocks with editable offsets and z-index.

## Assets and implementation

| File                                           | Role                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| `server/colossal-2027.mjs`                     | Theme manifest, editable trees, and scoped CSS                                    |
| `server/colossal-2027-ice-world.mjs`           | Preserving upgrade and full-screen composition                                    |
| `public/themes/colossal-2027/ice-throne.png`   | Transparent full seated figure and ice throne                                     |
| `public/themes/colossal-2027/ice-portrait.png` | Transparent ice artwork                                                           |
| `public/themes/colossal-2027/project-*.svg`    | Original project interface illustrations                                          |
| `shared/portrait-scene-runtime.ts`             | Lazy Three.js scene and cleanup                                                   |
| `shared/ice-scene/ice-world-runtime.ts`        | Ice world renderer, camera, scroll, and cleanup                                   |
| `shared/ice-scene/*-component.ts`              | Independent moon, sky, terrain, stars, wind, snow, throne, and crystal components |
| `shared/pickers/glass-picker.component.ts`     | Shared appearance control                                                         |

Bundled public assets ship with the application, so copies of this theme can use them on another Colossal CMS deployment. Replacement library images use the normal media-reference protections and configured storage provider.

The composition was inspired by [MengTo's Kage](https://mengto.github.io/kage/) and the supplied [Collect UI portfolio reference](https://collectui.com/designs/portfolio-ui-design-inspiration). Theme code, illustrations, and portrait artwork were created for Colossal CMS; Kage's source and artwork are not included.

### Artwork generation

The ice throne was generated with the built-in image generation tool, using the original model photograph and ice portrait as visual references. The shipped asset is `public/themes/colossal-2027/ice-throne.png`, with a transparent background. The working prompt preserved the subject's face, hair, beard, suit, tie, watch, and thoughtful hand-on-cheek pose; extended the composition to the full seated body, legs, and shoes; and added a majestic translucent blue ice throne with crystalline spires, armrests, and a visible base. It excluded background scenery, moon, snow, text, and framing so the Three.js components could supply the environment independently.
