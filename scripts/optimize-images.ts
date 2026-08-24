import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

async function optimizeFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const inputBuffer = fs.readFileSync(filePath);
  const originalSize = inputBuffer.length;

  let buffer: Buffer | null = null;

  try {
    if (ext === '.png') {
      buffer = await sharp(inputBuffer)
        .png({ compressionLevel: 9, quality: 85, palette: true })
        .toBuffer();
    } else if (ext === '.webp') {
      buffer = await sharp(inputBuffer)
        .webp({ quality: 82, effort: 6 })
        .toBuffer();
    } else if (ext === '.jpg' || ext === '.jpeg') {
      buffer = await sharp(inputBuffer)
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
    }

    if (buffer && buffer.length < originalSize) {
      fs.writeFileSync(filePath, buffer);
      const savedBytes = originalSize - buffer.length;
      const percent = ((savedBytes / originalSize) * 100).toFixed(1);
      console.log(
        `✅ Optimized ${path.relative(PUBLIC_DIR, filePath)}: ${(originalSize / 1024).toFixed(1)}KB -> ${(buffer.length / 1024).toFixed(1)}KB (${percent}% saved)`
      );
    } else {
      console.log(
        `ℹ️ Already optimized ${path.relative(PUBLIC_DIR, filePath)} (${(originalSize / 1024).toFixed(1)}KB)`
      );
    }
  } catch (err) {
    console.warn(`⚠️ Failed to optimize ${filePath}:`, err);
  }
}

async function scanAndOptimize(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await scanAndOptimize(fullPath);
    } else if (/\.(png|webp|jpg|jpeg)$/i.test(entry.name)) {
      await optimizeFile(fullPath);
    }
  }
}

async function run() {
  console.log('🖼️ Starting image optimization scan across public/ directory...');
  await scanAndOptimize(PUBLIC_DIR);
  console.log('🎉 Image optimization complete!');
}

run();
