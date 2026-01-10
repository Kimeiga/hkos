import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const iconsDir = join(publicDir, 'icons');

// Ensure icons directory exists
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

const svgPath = join(iconsDir, 'icon.svg');
const svgBuffer = readFileSync(svgPath);

// Icon sizes needed for PWA
const sizes = [16, 32, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512];

async function generateIcons() {
  console.log('Generating app icons...');
  
  for (const size of sizes) {
    const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`  Created: icon-${size}x${size}.png`);
  }

  // Apple touch icon (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(join(iconsDir, 'apple-touch-icon.png'));
  console.log('  Created: apple-touch-icon.png');

  // Maskable icon with padding
  const maskableSize = 512;
  const padding = Math.floor(maskableSize * 0.1); // 10% padding for safe area
  const innerSize = maskableSize - (padding * 2);
  
  await sharp(svgBuffer)
    .resize(innerSize, innerSize)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 44, g: 85, b: 48, alpha: 1 } // #2c5530
    })
    .png()
    .toFile(join(iconsDir, 'maskable-icon-512x512.png'));
  console.log('  Created: maskable-icon-512x512.png');

  console.log('\nGenerating OG image...');

  // Generate OG image from SVG
  const ogSvgPath = join(publicDir, 'og-image.svg');
  const ogSvgBuffer = readFileSync(ogSvgPath);

  await sharp(ogSvgBuffer)
    .resize(1200, 630)
    .png()
    .toFile(join(publicDir, 'og-image.png'));
  console.log('  Created: og-image.png');

  console.log('\nGenerating iOS splash screens...');

  // iOS splash screens (centered icon on background)
  const splashSizes = [
    { width: 2048, height: 2732, name: 'apple-splash-2048-2732' }, // iPad Pro 12.9"
    { width: 1170, height: 2532, name: 'apple-splash-1170-2532' }, // iPhone 12/13/14
    { width: 1125, height: 2436, name: 'apple-splash-1125-2436' }, // iPhone X/XS/11 Pro
  ];

  for (const splash of splashSizes) {
    const iconSize = Math.min(splash.width, splash.height) * 0.3;
    const resizedIcon = await sharp(svgBuffer)
      .resize(Math.round(iconSize), Math.round(iconSize))
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: splash.width,
        height: splash.height,
        channels: 4,
        background: { r: 44, g: 85, b: 48, alpha: 1 } // #2c5530
      }
    })
      .composite([{
        input: resizedIcon,
        gravity: 'center'
      }])
      .png()
      .toFile(join(iconsDir, `${splash.name}.png`));
    console.log(`  Created: ${splash.name}.png`);
  }

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);

