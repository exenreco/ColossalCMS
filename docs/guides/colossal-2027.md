# Colossal 2027 portfolio theme

Colossal 2027 is a bundled core theme for Exenreco Bell's developer portfolio. Its dark moonlit landscape, silver typography, translucent panels, sticky navigation, and interactive ice throne are editable through the Theme Editor.

## Activate and customize

1. Open **Themes → Colossal 2027 → Edit**. Home opens first.
2. Edit the hero, project cards, About section, education details, and contact links. The two concept projects and institution/date fields are editable samples.
3. Open the Header or Footer shared part to change navigation, identity, and the three footer columns.
4. Save a draft and use **Preview** to review it without activating it.
5. Publish, then choose **Activate** on the theme card.

Startup seeds the theme inactive. It preserves the current active theme, posts, pages, existing Colossal 2027 edits, and drafts. No portfolio pages or invented education records are added to the content database.

Existing Colossal 2027 documents receive the full-viewport scene and charcoal glass upgrades when opened or rendered. Bundled revision 3 replaces the previous default throne with the slimmer royal ice chair, adds the corner moon, snowflake motion, zoom, and veil controls, and updates the old default particle counts. Revision 4 places the shared footer above the persistent background without replaying earlier upgrades. Revision 5 gives project, education, and toolkit cards a consistent `#17191bc9` glass surface, adds fine rain lines, and updates the old default overlay opacity to 0.75. Existing custom overlay-opacity values are retained. The compatibility migration preserves block IDs, authored text, other templates, shared parts, custom CSS, replacement images, and existing motion-control values. The upgraded document is persisted on the next save or publish. The original database record and theme history remain available until then.

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

The hero measures **100vh × 100vw** within the page width, with `100svh` support for mobile browser controls. The throne image is contained within the initial camera frame, preserving its aspect ratio and showing the full figure, crown crest, curled armrests, and slender chair legs. At narrow widths the figure sits above the headline and primary action.

The Three.js canvas stays fixed behind the landing page. A charcoal veil with a subtly animated pixel weave covers the environment, restoring the darker liquid glass treatment. Fine rain lines pass over this veil, with independently varied positions, lengths, and falling speeds. Both layers use `#17191bc9`; the overlay defaults to 0.75 opacity. Eight-digit hex colors preserve their alpha, which is multiplied by the overlay's opacity control. Work, About, and Resume sections have transparent backgrounds; the sticky menu, cards, contact panel, and mobile hero copy retain glass surfaces. Project, education, and toolkit cards use `#17191bc9`, editable blur, and no default gradient. Scrolling smoothly zooms the camera and strengthens the wind. A small continuous zoom adds motion while idle. Pointer movement adds slight parallax; normal links and navigation remain clickable.

The moon is a 3D sphere with an original procedural crater texture, a shaded phase, and an atmospheric rim. It stays in the top-left corner with approximately half of its circle clipped by the viewport. Snowflakes use the supplied crystalline image with independently randomized sway, tumble, depth, and falling speed, inspired by falling leaves. Snow, wind trails, layered terrain, sky, stars, throne, floating ice fragments, and the glass veil each have a separate reusable component. The supplied [moonlit landscape reference](https://i.etsystatic.com/61056266/r/il/6a7a78/7964699562/il_570xN.7964699562_oy8y.jpg) informed the atmosphere; its image is not bundled or loaded by the theme.

## Scene and portrait controls

Select the hero's **3D model** block. Its **Source** is `portrait` and **Scene preset** is `ice-world`. The full-body figure and crystalline throne are original transparent PNG artwork based on the supplied `tmp/images/model.jpeg` and previous ice portrait, displayed as a plane inside the live Three.js environment. The figure is not a scanned or rigged mesh. Normal `media` and `url` sources still render uploaded GLB/glTF models. Select the `portrait` preset to use the earlier compact crystal scene.

| Control                                                        | Effect                                                                                               |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Scene preset                                                   | `ice-world` environment or the compact `portrait` scene                                              |
| Full viewport background                                       | Keep the ice world fixed behind the page; disable for an inline scene                                |
| Transparent portrait                                           | Choose an image from the media library; overrides the bundled artwork URL                            |
| Portrait URL                                                   | Bundled image path or an HTTPS image with CORS permission                                            |
| Moon / Moon placement / Moon size / Moon elevation / Moon tint | Enable the moon; choose the cropped top-left corner or centered composition, size, height, and color |
| Snow terrain                                                   | Enable the layered mountain and snow field                                                           |
| Snow / Snow density                                            | Enable flakes and set their bounded count, from 0–1800                                               |
| Snow size / Snow speed / Snow flutter                          | Adjust particle size, falling speed, and randomized sway/tumble                                      |
| Wind / Wind strength                                           | Enable gusts and adjust their force, from 0–3                                                        |
| Scene speed / Background zoom                                  | Set overall motion speed, from 0.25–3, and zoom amount, from 0–0.25                                  |
| Dark glass veil / Veil opacity                                 | Enable the global charcoal overlay and set opacity, from 0–0.85                                      |
| Overlay / rain color                                           | Set the shared tint as a six- or eight-digit hex color; defaults to `#17191bc9`                      |
| Rain lines / Density / Speed / Width                           | Enable fine streaks; density 0–96, speed 0.25–3, and width 0.3–1.5 px                                |
| Pixel animation / Pixel size                                   | Enable the animated pixel weave and set its cell size, from 1–8 px                                   |
| Crystal fragments                                              | Number of floating artifacts, from 0 to 40                                                           |
| Pointer interaction / Motion strength                          | Pointer parallax; arrow keys work when the scene is focused                                          |
| Ice tint / Light intensity                                     | Crystal color and lighting                                                                           |
| Scroll interaction / Scroll strength                           | Scene movement and weather intensity as the page scrolls                                             |
| Camera zoom / Height                                           | Camera framing; Height appears for inline scenes                                                     |
| Lazy load                                                      | Load the scene as it approaches the viewport                                                         |
| Alt text / Accessible label                                    | Portrait description and interaction instructions                                                    |

The **Replace** toolbar button opens the image picker for portrait mode. The same source-aware Inspector and toolbar work in themes, posts, and pages. An Overlay block can still provide content above the scene.

Moon, snow, wind, veil, rain, and pixel settings hide when their component is disabled. The shared tint remains available while either the veil or rain is enabled. The same controls work in all three block Inspectors. The bundled defaults use 160 snowflakes, scene speed 1.35, background zoom 0.1, veil opacity 0.75, 3 px pixels, rain density 36, rain speed 1, and 0.75 px lines; floating crystals are off by default. Rain density scales with viewport width to avoid crowding narrow screens.

Three.js loads in a separate chunk. Rendering uses bounded pixel density and particle counts, targets up to 60 frames per second on the public site and 30 in editor canvases, and pauses when the document is hidden. Editor image snapshots are capped at 15 frames per second. Camera, pointer, and scroll easing are independent of frame rate. Inline scenes also pause offscreen; the full-viewport background keeps rendering during page scrolling. Reduced-motion preferences disable wind, flake motion, parallax, zoom, pixel animation, rain animation, and scroll movement while retaining the scene. The PNG remains visible while loading and if WebGL or portrait-image loading fails.

## Liquid glass controls

The shared **Glass** popover appears in the theme, page, and post Inspectors. Enable **Liquid glass**, set **Blur** from 0–48 px and **Saturation** from 50–200%, then use **Background** for tint/opacity and **Border** for shape. A translucent background lets the backdrop blur remain visible. Browsers without backdrop-filter support keep the tint and border.

The sticky header's position is defined in the theme CSS. Its glass effect is editable on the Header part's root block. Cards and the contact panel use the same shared controls. **Layout → Position → Sticky** also supports authoring sticky blocks with editable offsets and z-index.

## Assets and implementation

| File                                                  | Role                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `server/colossal-2027.mjs`                            | Theme manifest, editable trees, and scoped CSS                                                |
| `server/colossal-2027-ice-world.mjs`                  | Preserving upgrade and full-screen composition                                                |
| `public/themes/colossal-2027/ice-throne-royal.png`    | Current transparent figure and slender carved royal ice throne                                |
| `public/themes/colossal-2027/ice-throne.png`          | Earlier throne retained for existing theme history                                            |
| `public/themes/colossal-2027/snowflake-reference.jpg` | User-selected crystalline snowflake sprite                                                    |
| `public/themes/colossal-2027/ice-portrait.png`        | Transparent ice artwork                                                                       |
| `public/themes/colossal-2027/project-*.svg`           | Original project interface illustrations                                                      |
| `shared/portrait-scene-runtime.ts`                    | Lazy Three.js scene and cleanup                                                               |
| `shared/ice-scene/ice-world-runtime.ts`               | Ice world renderer, camera, scroll, and cleanup                                               |
| `shared/ice-scene/*-component.ts`                     | Independent moon, sky, terrain, stars, wind, snow, throne, crystal, veil, and rain components |
| `shared/pickers/glass-picker.component.ts`            | Shared appearance control                                                                     |

Bundled public assets ship with the application, so copies of this theme can use them on another Colossal CMS deployment. Replacement library images use the normal media-reference protections and configured storage provider.

The composition was inspired by [MengTo's Kage](https://mengto.github.io/kage/) and the supplied [Collect UI portfolio reference](https://collectui.com/designs/portfolio-ui-design-inspiration). Theme code, illustrations, and portrait artwork were created for Colossal CMS; Kage's source and artwork are not included.

### Artwork generation

The current royal ice throne was generated with the built-in image generation tool, using the original model photograph and previous throne as visual references. The shipped asset is `public/themes/colossal-2027/ice-throne-royal.png`, with a transparent background. The chair follows the supplied antique royal throne proportions, with a tufted ice back, crown crest, curled armrests, slender legs, and open space underneath. The subject's pose and identity are preserved. See [artwork provenance and the exact generation prompt](colossal-2027-artwork.md), including the bundled snowflake source.
