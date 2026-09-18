# TEAM KN0T depth gallery

Six supplied Figma frames, in order: `1062:1896`, `1062:1598`, `1068:2532`, `1068:2585`, `1068:2630`, `1068:2673`.

## Run

```sh
pnpm install
pnpm dev
pnpm build
node --test tests/*.test.mjs
```

Use Node 22.13+. Figma image assets and the existing project's fonts are local, so no temporary Figma asset URLs are needed at runtime.

## Interaction

Wheel and drag feed continuous depth targets. The camera follows with Codrops DepthGallery's 0.08 damping, velocity uses 0.12 damping and a 1.5 cap, and image opacity uses 0.14 damping. Delta-time compensation preserves the response across 60Hz and 120Hz screens. Input remains responsive while moving. A new grab starts from the currently rendered depth, and absolute drag displacement avoids accumulating errors at either boundary. Near-camera projection is smoothly bounded to prevent huge images when travelling backward. Pointer capture is restricted to one primary pointer and cancelled capture settles safely. A gentle release/idle landing finishes on a complete frame; only imperceptible residual errors are clamped. Keyboard navigation and reduced motion are supported.

The introduction retains its original header. The five replaced member frames use the current Figma layout: 596 × 800 portrait, white 116.894px name, 42.69px role, a sidebar credit, and the 01–05 frame navigation. Portraits carry the supplied gradient shading. Names, spelling, and repeated sidebar labels match the design, including JEOUNG JINSEO on the second and fourth member frames.

Member backgrounds are native Figma renders of the updated radial gradient, edge shade, Warp, blur, and lower shade. The white vector curve is excluded from both native exports. Two distinct background compositions correspond to the left and right photo layouts. Backgrounds composite over a fully opaque base throughout travel. Photo, text, sidebar and navigation remain separate DOM content.

Background exports were made from temporary isolated copies of the supplied layers. Those temporary copies were removed from Figma after download; original design nodes were not modified.

## Validation

Motion tests cover the original damping calculation, continuous input, reversal while moving, frame-rate consistency, bounds, opacity, and convergence. TypeScript and production build checks are also run. Browser interaction testing was not run.

Original motion reference: https://github.com/houmahani/codrops-depth-gallery (MIT; see THIRD_PARTY_NOTICES.txt).

## Soft steam line

`lib/sauna-steam.mjs` renders only the continuous spatial ribbon. Rising wisps, detached particles and the chicken are removed from the renderer. The line itself has a soft Gaussian edge and a very faint surrounding haze. Its blur width and brightness vary slowly, with minimal lateral movement; no vapor rises from it.

`lib/steam-ribbon.mjs` samples the route into one connected, reusable mesh. It remains visible while idle, follows gallery depth, and retraces the same path on reverse travel. Near-camera fading prevents sudden enlarged flashes. Reduced motion hides the ribbon, and teardown disposes its geometry and material. The static background curves remain removed.

Ribbon checks cover persistence at rest, identical forward/reverse geometry, viewport ratios and resource cleanup. Browser visual testing has not been run.

## Section text reveals

The typography motion is adapted from the public Roman Jean-Elie site (https://www.romanjeanelie.com/): character masks with 800px perspective, 102% horizontal travel, a 90° Y rotation, 3-to-1 horizontal stretch, and right-to-left 30ms stagger. Names use a 1s Expo-out entrance with a 2.2s stretch tail; roles use a 0.5s Power2-out rotation. The initial global wait is omitted so gallery navigation stays immediate. Description paragraphs reveal through the browser's actual line boxes with a short upward stagger.

Temporary masked clones preserve the original text's kerning, baseline, line breaks, and measured Figma layout. Accessible native text remains in place and restores its paint after each reveal. Animation runs on the Web Animations API without another per-frame JS loop. Entry gates rearm only when a frame has faded away, so partial reversals continue smoothly and complete revisits replay. Resize, reduced motion, unsupported animation, and unmount all cancel animations and restore the original text. Fonts are awaited before measuring.

Text tests cover full forward/reverse traversal, midpoint jitter, reference timing, Unicode segmentation, animation cleanup, resize, reduced motion, and the font-loading/unmount race. Browser visual validation has not been performed.
