/** Shared opening layout for the two renderers, in CSS pixels. */
export function captionColumn(width: number, height: number, safeLeft = 0, safeRight = 0) {
  const compact = width <= 1023 || height <= 600;
  const sideBySide = height <= 500 && width / height >= 1.2;
  const left = Math.max(compact ? 16 : 24, safeLeft);
  const right = Math.max(compact ? 16 : 24, safeRight);
  const available = Math.max(1, width - left - right);
  const gap = sideBySide ? 20 : 0;
  const ringWidth = sideBySide ? (available - gap) * .46 : available;
  const copyWidth = Math.min(880, sideBySide ? available - ringWidth - gap : available);
  return { compact, sideBySide, ringWidth, copyWidth,
    ringX: sideBySide ? left + ringWidth / 2 : (left + width - right) / 2,
    copyX: sideBySide ? left + ringWidth + gap + copyWidth / 2 : (left + width - right) / 2 };
}

export function fitOpening({ width, height, scale, fov, cameraZ, headerHeight, captionHeight, bottomSpace, safeLeft, safeRight }: {
  width: number; height: number; scale: number; fov: number; cameraZ: number;
  headerHeight: number; captionHeight: number; bottomSpace: number; safeLeft: number; safeRight: number;
}) {
  const column = captionColumn(width, height, safeLeft, safeRight);
  const top = headerHeight + (column.compact ? column.sideBySide ? 10 : 16 : 24);
  const bottom = height - (column.compact ? bottomSpace : Math.max(88, height * .1));
  const gap = column.compact ? 16 : Math.min(48, Math.max(24, height * .042));
  const availableHeight = Math.max(1, bottom - top);
  const imageHeight = Math.max(1, availableHeight - (column.sideBySide ? 0 : captionHeight + gap));
  const radius = 2.5 * scale;
  const halfHeight = scale;
  const tangent = Math.max(Math.tan(fov * Math.PI / 360),
    height * halfHeight / (imageHeight * (cameraZ - radius)),
    height * radius / (column.ringWidth * Math.sqrt(cameraZ ** 2 - radius ** 2)));
  const ringHeight = height * halfHeight / (tangent * (cameraZ - radius));
  const groupTop = top + (availableHeight - ringHeight - (column.sideBySide ? 0 : captionHeight + gap)) / 2;
  const centeredCopyTop = column.compact ? top + (availableHeight - captionHeight) / 2 : Math.max(height / 2 - captionHeight / 2, top);
  return { fov: 2 * Math.atan(tangent) * 180 / Math.PI,
    shift: 2 * (groupTop + ringHeight / 2) / height - 1,
    shiftX: 1 - 2 * column.ringX / width,
    copyTop: column.sideBySide ? centeredCopyTop : groupTop + ringHeight + gap,
    centeredCopyTop, copyLeft: column.copyX, copyWidth: column.copyWidth };
}
