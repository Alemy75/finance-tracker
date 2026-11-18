// Renders the PWA and Apple touch icons from assets/icon.svg.
// The source is a full-bleed square: iOS and Android apply their own mask, so the PNGs have no transparent corners.
// Usage: node scripts/generate-pwa-icons.mjs
import { readFileSync } from "node:fs";
import sharp from "sharp";

const source = readFileSync(new URL("../assets/icon.svg", import.meta.url));
const targets = [
  { file: "icon-512.png", size: 512 },
  { file: "icon-192.png", size: 192 },
  { file: "apple-touch-icon.png", size: 180 }
];

for (const { file, size } of targets) {
  await sharp(source, { density: 72 * Math.ceil(size / 512) * 2 })
    .resize(size, size)
    .flatten({ background: "#1f3d36" })
    .png({ compressionLevel: 9 })
    .toFile(new URL(`../public/${file}`, import.meta.url).pathname);
  console.log(`public/${file} ${size}x${size}`);
}
