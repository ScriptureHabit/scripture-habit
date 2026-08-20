const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, '..', 'public', 'images');
const files = fs.readdirSync(imgDir);

(async () => {
  for (const file of files) {
    if (file.endsWith('.png') || file.endsWith('.jpg')) {
      const ext = path.extname(file);
      const base = path.basename(file, ext);
      const inputPath = path.join(imgDir, file);
      const outputPath = path.join(imgDir, base + '.webp');
      
      const beforeSize = fs.statSync(inputPath).size;
      await sharp(inputPath).webp({ quality: 85 }).toFile(outputPath);
      const afterSize = fs.statSync(outputPath).size;
      const saved = Math.round((1 - afterSize / beforeSize) * 100);
      console.log(`${file} (${(beforeSize / 1024).toFixed(1)} KB) -> ${base}.webp (${(afterSize / 1024).toFixed(1)} KB) [${saved}% saved]`);
    }
  }
})();
