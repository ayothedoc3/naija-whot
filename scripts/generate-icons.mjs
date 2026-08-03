// One-time/occasional icon generation from scripts/icon-source.svg.
// Re-run with `pnpm icons` whenever the source SVG changes.
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcSvg = readFileSync(path.join(__dirname, "icon-source.svg"));
const maskableSvg = readFileSync(path.join(__dirname, "icon-source-maskable.svg"));
const publicDir = path.join(__dirname, "..", "public");
const iconsDir = path.join(publicDir, "icons");
const appDir = path.join(__dirname, "..", "src", "app");

const targets = [
  { file: path.join(iconsDir, "icon-192.png"), size: 192, svg: srcSvg },
  { file: path.join(iconsDir, "icon-512.png"), size: 512, svg: srcSvg },
  { file: path.join(iconsDir, "icon-maskable-512.png"), size: 512, svg: maskableSvg },
  // Next.js App Router file conventions: these two are auto-detected and
  // served with the correct <link> tags without any metadata config.
  { file: path.join(appDir, "apple-icon.png"), size: 180, svg: srcSvg },
  { file: path.join(appDir, "icon.png"), size: 32, svg: srcSvg },
];

for (const t of targets) {
  await sharp(t.svg, { density: 384 }).resize(t.size, t.size).png().toFile(t.file);
  console.log("wrote", t.file);
}
