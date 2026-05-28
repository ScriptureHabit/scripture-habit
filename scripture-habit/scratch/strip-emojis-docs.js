import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            if (f !== 'node_modules' && f !== '.git' && f !== 'dist') {
                walkDir(dirPath, callback);
            }
        } else {
            callback(dirPath);
        }
    });
}

const rootDir = 'C:/Users/dazhi/code/final-project';

walkDir(rootDir, (filepath) => {
    if (!filepath.endsWith('.md')) return;
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;

    // Remove emojis from the specific patterns of CodeTours
    // For example: 🚀 Tour 0, 🤖 Tour 6, 💻 Tour 1, etc.
    // Also pattern: **🚀 Tour 0:
    // Let's replace emoji characters next to word "Tour"
    const regex = /([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F0DF}\u{1F1E0}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}]+)\s*(Tour)/gu;
    content = content.replace(regex, '$2');
    
    // Also remove the rocket emoji from "Onboarding Tour 🚀"
    content = content.replace(/(Onboarding Tour)\s*🚀/gu, '$1');
    content = content.replace(/(オンボーディングツアー)\s*🚀/gu, '$1');

    if (original !== content) {
        console.log(`Cleaning emojis in markdown: ${path.relative(rootDir, filepath)}`);
        fs.writeFileSync(filepath, content, 'utf8');
    }
});
