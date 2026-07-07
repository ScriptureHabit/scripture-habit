const sharp = require('sharp');
const path = require('path');

const diffPath = path.resolve('test-results/visual-Visual-Regression-T-9b8c8--visual-screenshot-baseline-chromium-retry1/dashboard-main-diff.png');

async function analyze() {
  try {
    const { data, info } = await sharp(diffPath)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = info.channels; // 3 or 4

    let minX = width, maxX = 0, minY = height, maxY = 0;
    let diffCount = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = channels === 4 ? data[idx + 3] : 255;

        // In Playwright diff, different pixels are highlighted in red/pinkish.
        const isDiff = (r > 200 && g < 50 && b > 200) || (r > 200 && g < 50 && b < 50);

        if (isDiff && a > 0) {
          diffCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    console.log(`Dimensions: ${width}x${height}`);
    console.log(`Diff Pixels: ${diffCount}`);
    if (diffCount > 0) {
      console.log(`Bounding Box of diff: X: ${minX} to ${maxX}, Y: ${minY} to ${maxY}`);
    } else {
      console.log('No matching diff pixels found.');
    }
  } catch (err) {
    console.error('Error analyzing image:', err);
  }
}

analyze();
