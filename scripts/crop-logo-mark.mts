import sharp from "sharp";
import path from "path";

const INPUT = path.resolve("public/logo.png");
const OUTPUT = path.resolve("public/logo-mark.png");

// Step 1: get raw pixel data with alpha channel
const { data, info } = await sharp(INPUT)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;

// Step 2: remove near-white pixels (make them transparent)
// The background is near-white (~#f5f5f0 range), threshold at 235 per channel
const THRESHOLD = 235;
for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD) {
    data[i + 3] = 0; // set alpha to 0
  }
}

// Step 3: save with transparent background, then trim transparent edges
const withAlpha = await sharp(data, { raw: { width, height, channels } })
  .png()
  .toBuffer();

await sharp(withAlpha).trim().toFile(OUTPUT);

const meta = await sharp(OUTPUT).metadata();
console.log(`Saved ${OUTPUT}`);
console.log(`Dimensions: ${meta.width} x ${meta.height}`);
console.log(`Aspect ratio (w/h): ${(meta.width! / meta.height!).toFixed(4)}`);
