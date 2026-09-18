# Figma implementation

Source: https://www.figma.com/design/8hKWLXpGTm4KO8ooh1SNSZ?node-id=1046-955

Reference canvas: 1440 × 1024. All coordinates in app/globals.css are uniformly converted to container-width units (1 Figma px = 1/14.4 cqw). No breakpoint reflow, invented sections, extra controls, or replacement illustrations.

| Element | Original node | Source values |
|---|---|---|
| Logo | 1046:966 | Exact exported SVG, −45° rotation, rotated bounds 62.601 / 25.497 / 57.812 / 57.812 |
| Brand | 1046:968 | Highman Trial Regular, 26.381px, #fdfdfd; x133.521 y32.106 |
| Subtitle | 1046:969 | Utendo Regular, 13.018px, #bdbdbd |
| Navigation | 1046:970 | x436 y36.192, 568×52, Utendo Bold 15px, gap113px |
| Project indicator | 1046:964 | x766 y75.602, 56.055×1.959 |
| Contact | 1046:975 | x1226.473 y42.192, 143.048×47.042, .5px red border, radius36.062, Utendo Regular18.031 |
| Heat bands | 1046:1110–1113 | Original coordinates, thicknesses and .5/.7/.4/1 opacities |
| Background | 1046:1109 | x−2 y296, 1444.832×1666.552, #fb0102 at22.225%, black at54.114% |
| WE ARE | 1046:1114 | Original fill AND stroke exports; x426.559 y385, 556.282×228.809 |
| YOUNG DESIGNERS | 1046:1127 | Original vector export including strokes; x72 y681.429, 1292.922×215.571 |
| Smoke | 1046:1157 | Original SVG including gradient and Gaussian filters; original size/position and paint order |

Fonts are the matching locally installed Highman Trial, Utendo Regular and Utendo Bold files. Assets are copied verbatim from the Figma exports. Figma's warp parameters are amplitude=0 and frequency=0, an identity operation, so the SVG already contains the final static appearance.

Entrance: per-character masked translateX(102%) + rotateY(90deg), reverse 30ms stagger, 1 second movement, 2.2 second scaleX(3→1), sampled expo.out curve. At 3.4 seconds full original exports replace the temporary crops to avoid seams. Smoke arrives over 4.8 seconds and settles at its exact Figma transform. Reduced-motion users see the original composition immediately. HOME/PROJECT and the brand replay the entrance. Other pages and contact information were not supplied, so those destinations remain inactive.

Validation: production build and HTTP response checks. No browser screenshot/pixel comparison was performed.

## Updated motion and viewport reference

The user subsequently replaced the frame/header sizing requirement with https://oven-sauna-ddp.harry040904.chatgpt.site/. The page now fills the viewport, using a virtual 1024px-high composition with horizontal expansion; the shared scale is min(viewport width/1440, viewport height/1024). Header geometry follows the inspected reference CSS: left brand anchor4.3472%, navigation28%–72%, contact right4.8958%, original Highman/Utendo fonts, and SPACE Modeling label. PROJECT remains the current section. ABOUT links to the supplied existing site's #front scene.

The new entrance is visually inspired by https://www.nakedcityfilms.com/: a center-out panel opening, opposing horizontal typography wipes with width expansion, sequenced red bands, one transient heat sweep, and the original smoke art easing into place. The text now uses intact Figma SVGs throughout, with no individual-glyph rotation. Pointer motion subtly displaces smoke with a damped follow; leaving the stage resets it. Reduced-motion mode disables all effects. No new visible controls were added. Public JS retrieval from Naked City returned429, so its animation timings are an interpretation of the observed motion, not claimed as extracted source settings.


## Continuous foreground steam

Three copies of the unmodified Figma vapor SVG now rise continuously over the lettering. Screen blending creates the red translucent veils shown in the user's supplied screenshot. Offset14/17/21-second cycles combine upward drift, subtle lateral curl, and opacity fades; invisible loop endpoints avoid jumps. A vertical mask contains vapor below the header. Text geometry, typography, navigation, frame, and existing entrance remain unchanged. Effects pause in hidden tabs and are disabled for reduced-motion preferences.


## Latest Figma: 1057:1295

The latest source is https://www.figma.com/design/8hKWLXpGTm4KO8ooh1SNSZ?node-id=1057-1295. Six assets were re-exported verbatim. Text anchors now match x422.558573/y370.976563 and x68/y667.405975. The original full viewport frame and unfolding entrance are retained. Navigation uses the latest DEVICES label and Contact's red outline.

The previous three synthetic screen-blended copies are replaced by the TWO actual Figma layers:1057:1365 behind the text at x−268/y322, normal blending;1057:1289 above the text at x−55/y346, LIGHTEN blending. Their native gradients and nested blur remain embedded in their SVGs. The front layer moves upward, disperses, and reforms lower down invisibly on a16-second cycle. The rear layer drifts on a23-second cycle. Both start at their original transforms; reduced-motion renders the static original positions. The zero-amplitude warp remains an identity, with no additional shader distortion.


## Foreground motion correction

Browser inspection confirmed the old16-second whole-image animation was active but its visible displacement was too small. steam-front-moving.svg now retains all four original vector paths, gradients, and nested Gaussian filters, adding animation wrappers around each actual wisp. Independent5.8–8.1-second upward paths travel470–540 design pixels, with lateral drift and fade-hidden loop resets. There is no static foreground copy in normal-motion mode. Reduced-motion uses the untouched original instead.


## La Colonia typography feedback

Analyzed public source: https://lacolonia.studio/_next/static/chunks/app/(site)/page-ebfad116f3f9476d.js. The reference renders a logo mask through two alternating render targets and advects its previous frame with two-octave fBm noise. Its blendDarken helper actually returns max(base,blend), not mathematical darken. Desktop density12, speed.35, smokeDecay.35; portrait6/.5/.5; persistence.95; pointer interpolation.05.

InkFeedback.tsx implements the same feedback equation in native WebGL, rasterizing our exact Figma fill/stroke exports as the source mask. It replaces the previous horizontal title unfolding with the reference's100-unit,2-second upward entrance. Original dark letter color and foreground steam remain. Noise and previous-frame propagation produce moving soft trails around the letter contours. Mouse movement controls drift direction. WebGL failure and reduced motion fall back to the unchanged SVG lettering. Browser inspection confirmed feedback-ready, valid dimensions, loaded masks, visible edge trails, and no console errors.

The user requested restrained intensity comparable to the reference. Displacement is calibrated to.0055 instead of.01 because the two-line Figma composition has smaller glyphs relative to the canvas; pointer direction influence is.25 instead of.35. The feedback mechanism and decay remain the same.


Latest refinement: removed independent translation paths from steam-front-moving.svg. The original wisps now diffuse through continuously varying three-octave fractal noise, displacement and blur, with staggered density breathing. No whole-cloud travel, hard loop reset or pointer translation remains. The subdued title feedback is unchanged.

Latest refinement: lower title feedback displacement to .0045 and pointer influence to .20. Add a low-opacity, vertically feathered continuation of the internally diffusing steam from design y120 through y640, reaching the four heat bands without changing their geometry or header.

Refinement: enlarge both original title vectors 5% about their existing centers. The WebGL mask reads their transformed bounds, so its geometry and fallback stay aligned. Apply a 1.8–2.8 px animated fractal-noise displacement to the original four rectangular heat bands for subtle edge shimmer, keeping band positions and fill colors. Reduced-motion mode disables the edge filter.

Heat-edge correction: replace the restless two-octave field with a broad single-octave field. Fix displacement at 1.2 px (maximum edge offset 0.6 px), remove amplitude pulsing, and morph the field slowly over 18 seconds with eased transitions. Preserve the enlarged title.

Typography correction: modulate feedback displacement and propagation with three soft local heat pockets, expressed relative to the actual enlarged title bounds. Other strokes receive 18% strength, while pocket centers retain the already restrained maximum. Original letter masks remain fully opaque in every region.

Contact-driven vapor revision: replace the independent letter heat pockets and SMIL foreground with a shared GPU density field. Original Figma steam alpha seeds the field; nine staggered emitters add vapor across the composition. Domain-warped noise advects upward, grows wider and fades with height instead of moving a whole wisp. The visible vapor and the feedback gate sample the identical field at the same coordinates and time. Clear-air pixels restore the original letter mask, with no baseline distortion. Preserve the original vector font geometry and 5% enlargement. Static assets remain as reduced-motion/WebGL fallback. Replace band edge displacement with staggered dark-to-red gradient sweeps clipped within the original rectangles.

Live preview refinement: slow all four gradient passes to one third of their initial speed (9.9–12.6 seconds per cycle), preserving their staggered phases.

Vapor distribution: eleven sources now span 2–98% of the actual viewport instead of a fixed central 1440-unit region. Wider plumes fan outward as they rise; side emission stays more consistent while the original central seed and center plume density are reduced. The shared contact field keeps letter effects aligned with this redistributed vapor.

Red panel boundary: feather the top 46 design units from transparent through soft intermediate alpha to full red, blending into the black backdrop without blurring the title or changing band geometry.

Band vapor refinement: multiply the existing gradient bands by slowly evolving, smooth turbulence alpha rather than displacing their outlines. Feather edges by 1.8 design units and soften the traveling gradient by 24 units. Make the 9.9–12.6 second sweeps linear and continuous, removing their end holds.
