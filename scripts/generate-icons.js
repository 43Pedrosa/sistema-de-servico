import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const logoBuffer = fs.readFileSync(path.resolve('./public/store-acessorios-logo.webp'));

async function generate() {
  // 192x192
  await sharp(logoBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.resolve('./public/pwa-192x192.png'));
  console.log('Generated pwa-192x192.png');

  // 512x512
  await sharp(logoBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.resolve('./public/pwa-512x512.png'));
  console.log('Generated pwa-512x512.png');

  // Apple touch icon (180x180)
  await sharp(logoBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.resolve('./public/apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // Maskable icon with 15% safe margin
  // Create a 512x512 canvas with dark background #171717, resize the SVG to 384x384 (75%) and composite in center
  const innerIcon = await sharp(logoBuffer)
    .resize(384, 384)
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{ input: innerIcon, top: 64, left: 64 }])
    .png()
    .toFile(path.resolve('./public/pwa-maskable-512x512.png'));
  console.log('Generated pwa-maskable-512x512.png');

  // Favicon (48x48 PNG)
  await sharp(logoBuffer)
    .resize(48, 48)
    .png()
    .toFile(path.resolve('./public/favicon-48.png'));
  console.log('Generated favicon-48.png');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
