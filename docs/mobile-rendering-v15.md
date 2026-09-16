# Mobile rendering verification — V15

The reported issue was a washed-out resting frame on an iPhone in-app browser and cropped mobile framing. This change normalizes the captured frame through an sRGB 2D canvas, uses RGBA textures and premultiplied canvas/shader output, and caps added steam opacity at 12%. It does not re-encode or change the video bytes.

Mobile now uses an uncropped full-frame source. The native video, poster and animated resting frame share the same contained rectangle. Portrait layout puts copy below the film; landscape phone layout puts it beside the film. Overflowing text scrolls inside its own area, above the persistent next-scene button.

## Checked

- 49 Node tests passed, including stream hashes, byte ranges, capture lifetime, scene arrival, complete framing and gesture handling.
- Browser layouts: 393×656, 320×568, 956×440 and 1440×1024. No horizontal page overflow in the inspected mobile layouts.
- At 320×568, the copy region ends at approximately y=512 and the next-scene button starts at y=516; long copy scrolls rather than lying beneath the button.
- Local browser forward transitions 0→1 and 1→2, and reverse 1→0 arrived at idle with no video errors. The resting renderer used the captured decoder frame, including after resizing.
- `?verify=color`: mean absolute channel differences between the browser's 2D frame and normalized resting texture were 1.58/255 for interaction, 1.33/255 for objects and 1.19/255 for world (23,040 sampled pixels each). These compare rendering paths, not source quality or perceptual quality scores.
- The steam framebuffer had zero pixels with RGB values above alpha, and maximum alpha 31/255 in sampled scenes. This verifies bounded premultiplied output without additive pale RGB in transparent pixels.

## Limits

These browser checks used the Codex in-app browser with viewport overrides, not a physical iPhone or the user's in-app browser. Native iOS compositor behavior, HDR display behavior and device-specific performance still require physical-device confirmation. The provided phone screenshots establish the original symptom; this verification does not claim reproduction of the original iOS-only failure in the desktop browser.
