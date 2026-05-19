const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../coverage/api_internal/routes/ai.ts.html');
if (!fs.existsSync(filePath)) {
    console.error('File does not exist:', filePath);
    process.exit(1);
}

const html = fs.readFileSync(filePath, 'utf8');

// Find the line-coverage section
const startCoverage = html.indexOf('<td class="line-coverage quiet">');
const endCoverage = html.indexOf('</td>', startCoverage);
if (startCoverage === -1 || endCoverage === -1) {
    console.error('Could not find line-coverage quiet section');
    process.exit(1);
}

const coverageHtml = html.substring(startCoverage, endCoverage);
const lines = coverageHtml.split('\n');

const uncoveredLines = [];
let lineIndex = 0;

for (const line of lines) {
    if (line.includes('<span class="') || line.includes('&nbsp;')) {
        lineIndex++;
        if (line.includes('cline-any cline-no')) {
            uncoveredLines.push(lineIndex);
        }
    }
}

console.log('Uncovered line numbers in ai.ts:', uncoveredLines);
