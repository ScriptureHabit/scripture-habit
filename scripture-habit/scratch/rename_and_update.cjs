
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '../src');
const extensions = ['.ts', '.tsx', '.css', '.scss', '.js', '.jsx'];

function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function toPascalCase(str) {
  return str.replace(/(^\w|-\w|_\w)/g, (m) => m.replace(/[-_]/, '').toUpperCase());
}

function getAllItems(dirPath, items = []) {
  const list = fs.readdirSync(dirPath);
  list.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    items.push(fullPath);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllItems(fullPath, items);
    }
  });
  return items;
}

// Map of OldPath -> NewPath
const renameMap = new Map();
// Map of OldName -> NewName (for import replacement)
const nameUpdateMap = new Map();

function collectRenames() {
    const allItems = getAllItems(rootDir);
    
    // Process files first, then directories (bottom-up)
    // Actually, to avoid path errors, we'll map everything first.
    allItems.forEach(fullPath => {
        const item = path.basename(fullPath);
        const dir = path.dirname(fullPath);
        const isDir = fs.statSync(fullPath).isDirectory();
        
        let newItem = item;
        if (isDir) {
            // Apply kebab-case to all folders in src
            const kebabItem = toKebabCase(item);
            if (item !== kebabItem) {
                newItem = kebabItem;
            }
        } else {
            const ext = path.extname(item);
            if (extensions.includes(ext)) {
                const base = path.basename(item, ext);
                if (/[A-Z]/.test(base)) {
                    const kebabBase = toKebabCase(base);
                    newItem = kebabBase + ext;
                    nameUpdateMap.set(base, kebabBase);
                }
            }
        }
        
        if (item !== newItem) {
            renameMap.set(fullPath, path.join(dir, newItem));
        }
    });
}

function safeGitMove(oldP, newP) {
    if (oldP === newP) return;
    const tmpP = oldP + '.renametmp';
    try {
        // Try git move
        execSync(`git mv "${oldP}" "${tmpP}"`, { stdio: 'pipe' });
        execSync(`git mv "${tmpP}" "${newP}"`, { stdio: 'pipe' });
    } catch (e) {
        // Fallback to regular move if not in git
        try {
            fs.renameSync(oldP, tmpP);
            fs.renameSync(tmpP, newP);
            execSync(`git add "${newP}"`, { stdio: 'pipe' });
        } catch (e2) {
            console.error(`Failed to move ${oldP} to ${newP}:`, e2.message);
        }
    }
}

function executeRenames() {
    // We must rename files first, from leaf to root
    const sortedRenameKeys = Array.from(renameMap.keys()).sort((a, b) => b.length - a.length);
    
    console.log(`Executing ${sortedRenameKeys.length} renames...`);
    sortedRenameKeys.forEach(oldPath => {
        const newPath = renameMap.get(oldPath);
        safeGitMove(oldPath, newPath);
        console.log(`Moved: ${path.relative(rootDir, oldPath)} -> ${path.relative(rootDir, newPath)}`);
    });
}

function updateImports() {
    const allFiles = getAllItems(rootDir).filter(p => !fs.statSync(p).isDirectory());
    const sortedNameKeys = Array.from(nameUpdateMap.keys()).sort((a, b) => b.length - a.length);
    
    // Also include folder renames in the update map
    const folderUpdateMap = new Map();
    for (const [oldPath, newPath] of renameMap) {
        if (fs.statSync(newPath).isDirectory()) {
            folderUpdateMap.set(path.basename(oldPath), path.basename(newPath));
        }
    }
    const sortedFolderKeys = Array.from(folderUpdateMap.keys()).sort((a, b) => b.length - a.length);

    allFiles.forEach(file => {
        if (!extensions.includes(path.extname(file))) return;
        
        let content = fs.readFileSync(file, 'utf8');
        let changed = false;

        // Update file imports
        sortedNameKeys.forEach(oldName => {
            const newName = nameUpdateMap.get(oldName);
            const regex = new RegExp(`(['"/])${oldName}(['"/.])`, 'g');
            if (regex.test(content)) {
                content = content.replace(regex, `$1${newName}$2`);
                changed = true;
            }
        });

        // Update folder imports
        sortedFolderKeys.forEach(oldFolder => {
            const newFolder = folderUpdateMap.get(oldFolder);
            const regex = new RegExp(`(['"/])${oldFolder}(['"/])`, 'g');
            if (regex.test(content)) {
                content = content.replace(regex, `$1${newFolder}$2`);
                changed = true;
            }
        });

        if (changed) {
            fs.writeFileSync(file, content, 'utf8');
            console.log(`Updated imports in: ${path.relative(rootDir, file)}`);
        }
    });
}

// Pre-step: Ensure everything is tracked
console.log('Staging initial changes...');
try { execSync('git add .', { stdio: 'inherit' }); } catch(e) {}

collectRenames();
executeRenames();
updateImports();

console.log('Final staging...');
try { execSync('git add .', { stdio: 'inherit' }); } catch(e) {}
console.log('Done.');
