import fs from 'fs';
import path from 'path';

const toursDir = 'C:/Users/dazhi/code/final-project/.tours';
const files = fs.readdirSync(toursDir);

files.forEach(file => {
    if (!file.endsWith('.tour')) return;
    const filepath = path.join(toursDir, file);
    let content = fs.readFileSync(filepath, 'utf8');
    
    // Parse json
    try {
        const data = JSON.parse(content);
        if (data.title) {
            // Strip emojis: match standard emoji characters and trim
            const oldTitle = data.title;
            let newTitle = oldTitle.replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
                                   .replace(/[\u{2600}-\u{26FF}]/gu, '')
                                   .replace(/[\u{2700}-\u{27BF}]/gu, '')
                                   .replace(/[\u{1F000}-\u{1F0DF}]/gu, '')
                                   .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
                                   .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
                                   .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
                                   .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
                                   .trim();
            
            // Clean up any remaining leading emoji characters or extra spaces
            newTitle = newTitle.replace(/^[^\w\d\s:]+/, '').trim();
            
            if (oldTitle !== newTitle) {
                console.log(`Updating ${file}: "${oldTitle}" -> "${newTitle}"`);
                data.title = newTitle;
                fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
            }
        }
    } catch (e) {
        console.error(`Failed to parse ${file}`, e);
    }
});
