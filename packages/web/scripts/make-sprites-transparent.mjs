/**
 * One-off script: make sprite PNGs have a transparent background.
 * Generated sprites often come as RGB with a grey/white fill; this sets
 * that background to full transparency (alpha = 0).
 *
 * Run from packages/web: bun run scripts/make-sprites-transparent.mjs
 */

import sharp from "sharp";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = join(__dirname, "..", "public", "sprites");

/** Color distance (Euclidean in RGB); threshold under which we treat pixel as background. */
const TOLERANCE = 45;

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

async function makeTransparent(inputPath, outputPath) {
  const pipeline = sharp(inputPath);
  const meta = await pipeline.metadata();
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const len = width * height * channels;

  // Use top-left pixel as background color (generated sprites usually have uniform fill there)
  const bgR = data[0];
  const bgG = data[1];
  const bgB = data[2];

  for (let i = 0; i < len; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (colorDistance(r, g, b, bgR, bgG, bgB) <= TOLERANCE) {
      data[i + 3] = 0; // alpha = 0
    }
  }

  await sharp(data, { raw: { width, height, channels } })
    .png()
    .toFile(outputPath);

  console.log("OK", outputPath);
}

const files = readdirSync(SPRITES_DIR).filter((f) => f.endsWith(".png"));
for (const file of files) {
  const input = join(SPRITES_DIR, file);
  await makeTransparent(input, input);
}
console.log("Done. Sprites now have transparent backgrounds.");
