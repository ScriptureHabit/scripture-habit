import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

const NODE_BUILTINS = new Set([
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
    'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
    'events', 'fs', 'fs/promises', 'http', 'http2', 'https', 'inspector',
    'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'stream/promises',
    'stream/web', 'string_decoder', 'timers', 'timers/promises', 'tls',
    'trace_events', 'tty', 'url', 'util', 'util/types', 'v8', 'vm', 'wasi',
    'worker_threads', 'zlib'
]);

function getFilesRecursively(dir: string, extensions: string[] = ['.ts', '.js']): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursively(fullPath, extensions));
        } else if (extensions.some(ext => file.endsWith(ext))) {
            results.push(fullPath);
        }
    }
    return results;
}

function getPackageNameFromImport(specifier: string): string {
    if (specifier.startsWith('@')) {
        const parts = specifier.split('/');
        return parts.slice(0, 2).join('/');
    }
    return specifier.split('/')[0];
}

export function checkBackendIntegrity(): boolean {
    console.log('🔍 Checking Backend & ESM Integrity (Dependencies & Module Resolution)...\n');

    let errorCount = 0;

    // 1. Read package.json dependencies
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const prodDeps = new Set(Object.keys(packageJson.dependencies || {}));
    const devDeps = new Set(Object.keys(packageJson.devDependencies || {}));

    // 2. Scan backend files (api/ and api_internal/)
    const backendDirs = [
        path.join(projectRoot, 'api'),
        path.join(projectRoot, 'api_internal')
    ];

    // Shared frontend modules explicitly consumed by backend
    const sharedModules = [
        path.join(projectRoot, 'src/locales/registry.ts'),
        path.join(projectRoot, 'src/utils/time-utils.ts'),
        path.join(projectRoot, 'src/utils/unity-utils.ts'),
        path.join(projectRoot, 'src/config/languages.ts'),
        path.join(projectRoot, 'src/types/chat.ts'),
        path.join(projectRoot, 'src/types/schemas.ts'),
        path.join(projectRoot, 'src/types/errors.ts')
    ];

    let backendFiles: string[] = [];
    for (const dir of backendDirs) {
        backendFiles = backendFiles.concat(getFilesRecursively(dir));
    }
    for (const shared of sharedModules) {
        if (fs.existsSync(shared) && !backendFiles.includes(shared)) {
            backendFiles.push(shared);
        }
    }

    const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|export\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"])/g;

    for (const filePath of backendFiles) {
        const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
        // Skip tests, test-setup, and scripts from production dependency checks
        const isTestOrScript = relPath.includes('.test.') || relPath.includes('api_internal/scripts/') || relPath.includes('test-setup.ts');

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        lines.forEach((line, lineIdx) => {
            let match;
            importRegex.lastIndex = 0;
            while ((match = importRegex.exec(line)) !== null) {
                const specifier = match[1] || match[2];
                if (!specifier) continue;

                // CHECK A: Relative Imports MUST have an explicit extension (.js, .json, .css, etc.)
                if (specifier.startsWith('.')) {
                    const ext = path.extname(specifier);
                    if (!ext) {
                        console.error(`❌ [${relPath}:${lineIdx + 1}] Missing ESM extension in relative import: "${specifier}"`);
                        console.error(`   👉 Fix: Add explicit extension (e.g. "${specifier}.js") for Node.js ESM compatibility.\n`);
                        errorCount++;
                    }
                }
                // CHECK B: Third-Party Imports in production backend MUST be in 'dependencies' (not 'devDependencies')
                else if (!isTestOrScript) {
                    if (specifier.startsWith('node:')) continue;
                    const pkgName = getPackageNameFromImport(specifier);
                    if (NODE_BUILTINS.has(pkgName)) continue;

                    if (!prodDeps.has(pkgName)) {
                        if (devDeps.has(pkgName)) {
                            console.error(`❌ [${relPath}:${lineIdx + 1}] Production backend imports package "${pkgName}" which is in "devDependencies"!`);
                            console.error(`   👉 Fix: Move "${pkgName}" from "devDependencies" to "dependencies" in package.json to avoid Vercel 500 FUNCTION_INVOCATION_FAILED.\n`);
                        } else {
                            console.error(`❌ [${relPath}:${lineIdx + 1}] Production backend imports undeclared package "${pkgName}"!`);
                            console.error(`   👉 Fix: Add "${pkgName}" to "dependencies" in package.json.\n`);
                        }
                        errorCount++;
                    }
                }
            }
        });
    }

    if (errorCount === 0) {
        console.log(`✅ PERFECT! All backend imports have valid ESM extensions and all production dependencies are properly declared in package.json.\n`);
        return true;
    } else {
        console.error(`💥 Found ${errorCount} backend integrity issue(s) that will break production serverless runtime! Please fix them.`);
        return false;
    }
}

// Run when called directly via CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const success = checkBackendIntegrity();
    process.exit(success ? 0 : 1);
}
