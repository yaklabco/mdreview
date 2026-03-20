/**
 * Generate placeholder app icons for electron-builder.
 * Run: npx tsx packages/electron/scripts/generate-icons.ts
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');

if (!existsSync(buildDir)) {
  mkdirSync(buildDir, { recursive: true });
}

// Create a simple blue-gradient icon with "MD" text
const size = 512;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4A90D9"/>
      <stop offset="100%" style="stop-color:#357ABD"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="80" fill="url(#bg)"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
        font-family="system-ui, -apple-system, sans-serif" font-weight="700"
        font-size="220" fill="white" letter-spacing="-10">MD</text>
</svg>`;

async function generate() {
  const svgBuffer = Buffer.from(svg);

  // PNG for Linux + electron-builder
  await sharp(svgBuffer).resize(512, 512).png().toFile(join(buildDir, 'icon.png'));

  // ICO requires 256x256 PNG (electron-builder converts)
  await sharp(svgBuffer).resize(256, 256).png().toFile(join(buildDir, 'icon.ico.png'));

  // For macOS .icns, electron-builder can generate from a 512x512 PNG
  // We provide the PNG and electron-builder handles the conversion
  await sharp(svgBuffer).resize(512, 512).png().toFile(join(buildDir, 'icon.icns'));

  console.log('Icons generated in', buildDir);
}

void generate();
