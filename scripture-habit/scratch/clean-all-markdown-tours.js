import fs from 'fs';
import path from 'path';

const readmePath = 'C:/Users/dazhi/code/final-project/README.md';
const jaReadmePath = 'C:/Users/dazhi/code/final-project/docs/ja/README.md';

function cleanReadme(filepath) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');
    
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F0DF}\u{1F1E0}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}]/gu;
    
    const newLines = lines.map(line => {
        // If the line is a list item for a Tour, strip emojis from it
        if (line.trim().startsWith('*') && (line.includes('Tour ') || line.includes('Onboarding Tour'))) {
            // Only strip emojis from the bold part
            const boldPartMatch = line.match(/\*\*(.*?)\*\*/);
            if (boldPartMatch) {
                const boldContent = boldPartMatch[1];
                const cleanBoldContent = boldContent.replace(emojiRegex, '').trim();
                line = line.replace(`**${boldContent}**`, `**${cleanBoldContent}**`);
            }
            // Also clean up any extra spaces next to bold marks
            line = line.replace(/\*\*\s+/g, '**').replace(/\s+\*\*/g, '**');
        }
        return line;
    });

    const newContent = newLines.join('\n');
    if (content !== newContent) {
        console.log(`Pruned all list emojis in: ${path.basename(filepath)}`);
        fs.writeFileSync(filepath, newContent, 'utf8');
    }
}

cleanReadme(readmePath);
cleanReadme(jaReadmePath);
