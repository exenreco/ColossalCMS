# Colossal 2027 artwork

## Royal ice throne

**Asset:** `public/themes/colossal-2027/ice-throne-royal.png`  
**Generation:** built-in image generation tool; transparent alpha background. No CLI generation was used.  
**Inputs:** the previous `ice-throne.png` and the user's original `tmp/images/model.jpeg` photograph. The supplied [antique throne reference](https://img.magnific.com/free-psd/majestic-red-velvet-throne-with-golden-crown_191095-84634.jpg?semt=ais_hybrid&w=740&q=80) informed the chair proportions and carved silhouette.

The figure is original raster artwork displayed on a plane in the Three.js scene. The moon, terrain, weather, and pixel veil are independent components. Earlier portrait and throne assets remain available for existing theme history and custom layouts.

### Final generation prompt

```text
Use case: precise-object-edit. Asset: transparent portfolio hero artwork.
Edit reference image 1 (the current seated ice figure) using reference image 2 only to preserve the man's face, hairstyle, beard, identity, suit, tie, watch, and thoughtful hand-on-cheek pose. Keep the entire full-body figure, crossed seated posture, legs and shoes visible.
Replace the massive jagged throne and thick stepped pedestal with an elegant, significantly narrower antique royal armchair made entirely from translucent ice: a tall gently curved upholstered-style back carved as frosted ice with subtle diamond tufting, a delicate small crown crest on top, slim ornate silver-blue ice scrollwork frame, graceful curled armrests, narrow seat rail, and four slender curved cabriole legs. Its proportions should resemble a classic red velvet and gilded royal throne converted wholly into pale silver-blue ice. No red fabric, no gold, no forest of spikes, no large pedestal, no rectangular bulky base. Leave open transparent negative space around the throne and underneath its legs.
Preserve the figure's original pose and facial likeness precisely. Preserve clear ice facets on the suit and body, but use softer silvery frost and restrained highlights rather than intense neon-blue glowing outlines or excessive star sparkles. High-quality realistic sculptural detail, front view with a very subtle three-quarter angle. Chair should be only slightly wider than the seated man's shoulders and knees, an elegant refined silhouette. Do not crop any crown crest, leg, shoe or chair foot. Leave a small clear margin around the whole silhouette.
Output a genuinely transparent alpha background. No backdrop, terrain, moon, particles, text, logo, border or checkerboard.
```

## Snowflake sprite

**Asset:** `public/themes/colossal-2027/snowflake-reference.jpg`  
**Source:** [How to Make Science Projects for Kids — supplied snowflake image](https://howtomakescienceprojectsforkids.com/wp-content/uploads/2018/07/HTMSPFK-FunFactsAboutSnowflakes.jpg).

This user-selected JPEG is bundled unchanged. A shader removes its white background at render time and tints the visible crystalline branches. Each sprite has independently seeded size, depth, falling speed, sway, spin, and edge-on flutter. If the image cannot load, the renderer uses a procedural six-branch fallback. The shipped theme does not request this image from the source website at runtime.

## Design references

[Collect UI portfolio designs](https://collectui.com/designs/portfolio-ui-design-inspiration) informed the editorial typography, compact navigation, and separated project cards. [Kage](https://mengto.github.io/kage/) informed the partial corner moon, layered particle motion, and animated pixel weave. Theme code and shaders are independently authored; no Kage source code or artwork is bundled.
