# Appearance pickers

The nine drawing-inspired controls in `shared/pickers/` are standalone Angular components. They are available individually to other editor surfaces and are composed by `AppearancePickerPanelComponent` in the Theme Editor and the post/page block Inspector.

| Drawing    | Standalone selector    | Settings edited                                                         |
| ---------- | ---------------------- | ----------------------------------------------------------------------- |
| Typography | `cl-typography-picker` | Font, size, alignment, line height, indent and emphasis                 |
| Padding    | `cl-padding-picker`    | Four-sided `padding`                                                    |
| Margin     | `cl-margin-picker`     | Four-sided `margin`                                                     |
| Link       | `cl-link-picker`       | URL, state colors and decoration                                        |
| Layout     | `cl-layout-picker`     | Z-index, display, position, offsets, transforms, flex and grid controls |
| Gradient   | `cl-gradient-picker`   | Multi-stop `backgroundGradient`                                         |
| Color      | `cl-color-picker`      | A single color, opacity and palette swatches                            |
| Border     | `cl-border-picker`     | Per-side widths, colors and styles; corner radii                        |
| Animation  | `cl-animation-picker`  | Preset, trigger, ease, delay, duration and loop by phase                |

The setting-based pickers take a `settings` input and emit `{ key, value }` through `settingChange`. The editor should pass each event to `ThemeEditorState.set(key, value)` so changes enter the shared undo history. `cl-color-picker` instead takes `label`, `value`, and `palette`, and emits a color string through `valueChange`. Padding and Margin have independent selectors and reuse the four-side diagram in `SpacingPickerComponent` internally.

Typography, Color, Gradient, Layout, Border, Link, and Animation use `PickerPopoverComponent`. It opens a viewport-clamped top-layer panel beside the Inspector, closes on outside click or Escape, and restores focus when closed by keyboard. Color and Gradient share the pointer-driven `ColorWheelComponent`, which changes hue and saturation by dragging and offers brightness and keyboard adjustments. The gradient model accepts two to eight color stops with independent positions and opacity. Click the gradient bar to add a stop, drag a stop to change its position, or use its arrow keys for fine adjustments; older `start`/`end` gradients still render.

Text and Background Color have explicit reset actions that clear their settings and return the trigger to its inherited-state badge. Hue and brightness ranges show color ramps; opacity ranges place the active color over a checkerboard. The Border diagram edits each side's color, style and width independently, falling back to legacy global border settings where no side override exists.

The panel accepts `settings`, `blockType`, and `palette`. It hides generated fields for settings it replaces, while retaining block-specific controls such as image alignment and container minimum height. The Animation picker is excluded for `core/slider`, whose transitions are controlled by Swiper. `server/theme-engine.mjs` also ignores any older block animation saved on Slider nodes. Supported picker settings compile to bounded CSS shared by the canvas and public site. Add any new renderable setting to its sanitizer allowlist with a narrow value pattern; otherwise it will be removed from rendered HTML.

Numeric length controls share `UnitInputComponent`. Legacy numeric settings remain pixels; selecting rem, em, %, vw, or vh stores a unit-bearing string. Animation timing uses ms or s and persists seconds as strings while rendering bounded millisecond CSS. Layout supports fixed positioning, z-index, and bounded translate, rotate, and scale settings. Its transform values are compiled from individual fields rather than arbitrary CSS text.
