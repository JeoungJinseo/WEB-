export const FRAME_WIDTH = 1440;
export const FRAME_HEIGHT = 1024;

// Each format has a complete composition, including its typography.
// Fit that composition uniformly inside the browser chrome and safe area.
export function fitGalleryFrame(viewportWidth, viewportHeight, insets = {}) {
  const positive = (value) => Math.max(0, Number(value) || 0);
  const width = Math.max(1, positive(viewportWidth));
  const height = Math.max(1, positive(viewportHeight));
  const left = Math.min(positive(insets.left), width - 1);
  const right = Math.min(positive(insets.right), width - left - 1);
  const top = Math.min(positive(insets.top), height - 1);
  const bottom = Math.min(positive(insets.bottom), height - top - 1);
  const availableWidth = width - left - right;
  const availableHeight = height - top - bottom;
  const compact = availableWidth < 1000;
  const landscape = compact && availableWidth > availableHeight;
  const frameWidth = compact ? 720 : FRAME_WIDTH;
  const frameHeight = landscape ? 640 : FRAME_HEIGHT;
  const scale = Math.min(
    availableWidth / frameWidth,
    availableHeight / frameHeight,
  );
  // Keep the existing OVEN desktop chrome anchored across the viewport.
  const compositionWidth = compact ? frameWidth : availableWidth / scale;
  // Portrait layouts distribute their content over the available phone height,
  // instead of centering a short desktop-shaped sheet inside a tall screen.
  const compositionHeight =
    compact && !landscape ? availableHeight / scale : frameHeight;
  return {
    width: compositionWidth,
    height: compositionHeight,
    format: compact
      ? landscape
        ? 'compact-landscape'
        : 'compact-portrait'
      : 'desktop',
    scale,
    left: left + (availableWidth - compositionWidth * scale) / 2,
    top: top + Math.max(0, (availableHeight - compositionHeight * scale) / 2),
  };
}
