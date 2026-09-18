# GOOBNE OVEN SAUNA — Our Core Value

The responsive core-value gallery, published as a static Next.js export. The root and /oven-sauna/ show the same page.

Source is synchronized from the local core-value implementation. Run bun install and bun run build to reproduce out/. The Sites manifest selects out/ as the deployment asset directory.

## Core-value gallery performance

The gallery starts with lightweight rendering. WebGL displacement, pointer tilt, independent card floating, and animated vapor filters are enabled only above 1024px with a fine hover pointer and no reduced-motion preference. Phones and tablets retain automatic horizontal movement, drag/swipe, snap settling, and tap-to-reveal descriptions using image overlays and transform/opacity transitions.

The animation loop sleeps after settling when a mobile card is open or movement is paused, and also stops offscreen or in a hidden tab. Arrow controls, pointer release/cancellation, resize, and visibility changes wake it when needed. Desktop WebGL textures initialize only when cards first approach the viewport; switching to lightweight rendering releases their GPU contexts.
