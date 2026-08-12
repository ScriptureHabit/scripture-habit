import fs from 'fs';
import path from 'path';

/**
 * Script to prevent FCM push notification bugs by detecting unsafe direct access
 * to 'fcmToken' (singular property) instead of using centralized token helpers like
 * 'getUserFcmTokens' or 'getUserFcmTokensAndLanguage'.
 */

function getFilesRecursively(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursively(fullPath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(fullPath);
        }
    }
    return results;
}

function checkFcmUsage() {
    console.log('🔍 Checking for unsafe FCM token references across backend & frontend...\n');

    const projectRoot = process.cwd();
    const searchDirs = [
        path.join(projectRoot, 'api_internal'),
        path.join(projectRoot, 'src')
    ];

    let filesToCheck: string[] = [];
    for (const dir of searchDirs) {
        filesToCheck = filesToCheck.concat(getFilesRecursively(dir));
    }

    let errors = 0;
    // Regex looking for direct property access: .fcmToken (singular) but NOT .fcmTokens (plural)
    const unsafeFcmRegex = /\.fcmToken(?![sA-Za-z0-9_])/g;

    for (const filePath of filesToCheck) {
        // Skip script files or notification helper implementation itself
        const relativePath = path.relative(projectRoot, filePath);
        if (relativePath.includes('notifications.ts') || relativePath.includes('check-fcm-usage.ts')) {
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            if (unsafeFcmRegex.test(line)) {
                console.log(`❌ UNSAFE FCM ACCESS in [${relativePath}:${index + 1}]:`);
                console.log(`   Line ${index + 1}: ${line.trim()}`);
                console.log(`   💡 FIX: Use 'getUserFcmTokens(uid)' or 'getUserFcmTokensAndLanguage(uid)' from notifications.ts instead.\n`);
                errors++;
            }
        });
    }

    if (errors === 0) {
        console.log('✅ PERFECT! No unsafe direct fcmToken (singular) property access found.\n');
        process.exit(0);
    } else {
        console.log(`❌ Found ${errors} unsafe FCM token reference(s). Please use centralized helpers.\n`);
        process.exit(1);
    }
}

checkFcmUsage();
