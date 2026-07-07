const sharp = require('sharp');
const path = require('path');

const actualPath = path.resolve('test-results/visual-Visual-Regression-T-9b8c8--visual-screenshot-baseline-chromium-retry1/dashboard-main-actual.png');
const expectedPath = path.resolve('test-results/visual-Visual-Regression-T-9b8c8--visual-screenshot-baseline-chromium-retry1/dashboard-main-expected.png');

async function compare() {
  try {
    const actual = await sharp(actualPath).raw().toBuffer({ resolveWithObject: true });
    const expected = await sharp(expectedPath).raw().toBuffer({ resolveWithObject: true });

    const width = actual.info.width;
    const height = actual.info.height;
    const channels = actual.info.channels;

    console.log(`Image dimensions: ${width}x${height}`);

    const stripHeight = 30;
    for (let yStart = 0; yStart < height; yStart += stripHeight) {
      const yEnd = Math.min(yStart + stripHeight, height);
      let diffCount = 0;
      let sampleDiff = null;

      for (let y = yStart; y < yEnd; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * channels;
          
          let actualColor = [actual.data[idx], actual.data[idx+1], actual.data[idx+2]];
          let expectedColor = [expected.data[idx], expected.data[idx+1], expected.data[idx+2]];

          const colorDiff = Math.abs(actualColor[0] - expectedColor[0]) +
                            Math.abs(actualColor[1] - expectedColor[1]) +
                            Math.abs(actualColor[2] - expectedColor[2]);

          if (colorDiff > 10) { // small tolerance
            diffCount++;
            if (!sampleDiff) {
              sampleDiff = { x, y, actualColor, expectedColor };
            }
          }
        }
      }

      if (diffCount > 0) {
        console.log(`Strip Y: ${yStart}-${yEnd} | Diff Pixels: ${diffCount} | Sample: at X=${sampleDiff.x}, Y=${sampleDiff.y} Actual=${JSON.stringify(sampleDiff.actualColor)} Expected=${JSON.stringify(sampleDiff.expectedColor)}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

compare();
