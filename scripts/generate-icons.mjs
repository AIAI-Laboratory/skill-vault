import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'public', 'icons');
const srcImage = path.join(outDir, 'icon.svg');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const sizes = [16, 32, 48, 128];

async function generate() {
  for (const size of sizes) {
    const outFile = path.join(outDir, `icon-${size}.png`);
    await sharp(srcImage, { density: 192 }).resize(size, size).png().toFile(outFile);
    console.log(`Generated: ${outFile} (${size}x${size})`);
  }
}

generate().catch((err) => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
