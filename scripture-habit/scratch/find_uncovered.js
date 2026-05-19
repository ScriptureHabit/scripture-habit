const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../coverage/api_internal/routes/ai.ts.html');
if (!fs.existsSync(filePath)) {
    console.error('File does not exist:', filePath);
    process.exit(1);
}

const html = fs.readFileSync(filePath, 'utf8');
const lines = html.split('\n');

const uncoveredLines = [];
let currentLineNum = null;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Find name='Lxxx' to track the original line number
    const match = line.match(/name='L(\d+)'/);
    if (match) {
        currentLineNum = parseInt(match[1], 10);
    }
    if (line.includes('cline-any cline-no') && currentLineNum !== null) {
        uncoveredLines.push(currentLineNum);
    }
}

console.log('Uncovered line numbers in ai.ts:', uncoveredLines);
