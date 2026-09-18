// Bake Figma's static sine Warp (amplitude 1.5, frequency 2.05).
// Render the source SVG with transparent padding; never flatten onto black.
import sharp from '../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js';
const width = 1952,
  height = 778;
for (const side of ['left', 'right']) {
  const expanded = await sharp(`public/assets/mist-${side}.svg`)
    .resize(Math.round(width * 1.0508), Math.round(height * 1.1375), {
      fit: 'fill',
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(width * height * 4),
    src = expanded.data,
    sw = expanded.info.width,
    sh = expanded.info.height;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width,
        v = (y + 0.5) / height;
      const wx =
        u + 0.075 * Math.sin(2 * Math.PI * 2.049999952316284 * (v - 0.5));
      const wy =
        v + 0.075 * Math.sin(2 * Math.PI * 2.049999952316284 * (u - 0.5));
      const sx = Math.min(sw - 1, Math.max(0, wx * width + width * 0.0254));
      const sy = Math.min(sh - 1, Math.max(0, wy * height + height * 0.0738));
      const ix = Math.floor(sx),
        iy = Math.floor(sy),
        fx = sx - ix,
        fy = sy - iy;
      for (let c = 0; c < 4; c++) {
        const get = (a, b) =>
          src[(Math.min(b, sh - 1) * sw + Math.min(a, sw - 1)) * 4 + c];
        output[(y * width + x) * 4 + c] = Math.round(
          get(ix, iy) * (1 - fx) * (1 - fy) +
            get(ix + 1, iy) * fx * (1 - fy) +
            get(ix, iy + 1) * (1 - fx) * fy +
            get(ix + 1, iy + 1) * fx * fy,
        );
      }
    }
  await sharp(output, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(`public/assets/atmosphere-${side}.png`);
}
