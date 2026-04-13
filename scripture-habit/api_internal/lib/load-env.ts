import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env then .env.local (override=true) from repo root
const rootPath = path.resolve(__dirname, '../../');
const envPath = path.join(rootPath, '.env');
const envLocalPath = path.join(rootPath, '.env.local');

console.log(`[Env] Attempting to load from: ${rootPath}`);
const envResult = dotenv.config({ path: envPath });
const envLocalResult = dotenv.config({ path: envLocalPath, override: true });

if (envResult.error) {
  console.warn(`[Env] Failed to load .env: ${envResult.error.message}`);
} else {
  console.log(`[Env] Successfully loaded .env. Keys: ${Object.keys(envResult.parsed || {}).join(', ')}`);
}

if (envLocalResult.error) {
  console.warn(`[Env] Failed to load .env.local: ${envLocalResult.error.message}`);
} else {
  console.log(`[Env] Successfully loaded .env.local. Keys: ${Object.keys(envLocalResult.parsed || {}).join(', ')}`);
}

console.log('[Env] Environment variables loading process complete');
