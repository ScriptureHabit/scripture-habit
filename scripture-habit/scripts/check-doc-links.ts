import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(process.cwd());

function getDocsDir() {
    // If process.cwd() is 'scripture-habit', docs is at '../docs'
    // If process.cwd() is 'final-project', docs is at './docs'
    if (fs.existsSync(path.join(PROJECT_ROOT, 'docs'))) {
        return path.join(PROJECT_ROOT, 'docs');
    }
    if (fs.existsSync(path.join(PROJECT_ROOT, '../docs'))) {
        return path.join(PROJECT_ROOT, '../docs');
    }
    console.error('❌ Could not find docs directory!');
    process.exit(1);
}

const docsDir = getDocsDir();
console.log(`🔍 Scanning markdown files in: ${docsDir}`);

let totalLinksChecked = 0;
let brokenLinksCount = 0;

function getAllMarkdownFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllMarkdownFiles(filePath));
        } else if (filePath.endsWith('.md')) {
            results.push(filePath);
        }
    });
    return results;
}

function checkLink(mdFilePath: string, link: string): boolean {
    // Skip web links, anchors, mailto, etc.
    if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('#') || link.startsWith('mailto:')) {
        return true;
    }

    totalLinksChecked++;

    let cleanLink = link.split('#')[0]; // Remove anchors (e.g. #L123)
    cleanLink = decodeURIComponent(cleanLink); // Decode spaces/special chars

    let resolvedPath = '';

    if (cleanLink.startsWith('file:///')) {
        // Handle file:/// absolute paths
        // file:///c:/Users/dazhi/code/... -> c:/Users/dazhi/code/...
        let rawPath = cleanLink.substring(8);
        
        // On Windows, if path is /C:/Users/..., strip the leading slash
        if (process.platform === 'win32' && rawPath.startsWith('/')) {
            rawPath = rawPath.substring(1);
        }
        
        resolvedPath = path.resolve(rawPath);
    } else {
        // Handle relative paths (e.g. ./architecture.md or ../../api_internal/...)
        resolvedPath = path.resolve(path.dirname(mdFilePath), cleanLink);
    }

    if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ Broken link in [${path.relative(docsDir, mdFilePath)}]: "${link}" -> Resolved to "${resolvedPath}"`);
        return false;
    }

    return true;
}

function processMarkdownFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // RegExp to find standard markdown links [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
        const linkUrl = match[2];
        const isValid = checkLink(filePath, linkUrl);
        if (!isValid) {
            brokenLinksCount++;
        }
    }
}

const mdFiles = getAllMarkdownFiles(docsDir);
console.log(`Found ${mdFiles.length} markdown files to scan.`);

mdFiles.forEach(file => {
    processMarkdownFile(file);
});

console.log('\n--- Scan Summary ---');
console.log(`Total links checked: ${totalLinksChecked}`);
if (brokenLinksCount > 0) {
    console.error(`❌ Found ${brokenLinksCount} broken link(s)!`);
    process.exit(1);
} else {
    console.log('✅ All links are valid! Outstanding job!');
    process.exit(0);
}
