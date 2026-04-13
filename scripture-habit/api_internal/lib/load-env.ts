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
  if (process.env.CI || process.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
    console.log(`[Env] .env not found, using system environment variables and fallback config.`);
  } else {
    console.warn(`[Env] Failed to load .env: ${envResult.error.message}`);
  }
} else {
  console.log(`[Env] Successfully loaded .env. Keys: ${Object.keys(envResult.parsed || {}).join(', ')}`);
}

if (envLocalResult.error) {
  if (!process.env.CI) {
    console.log(`[Env] .env.local not found (optional)`);
  }
} else {
  console.log(`[Env] Successfully loaded .env.local. Keys: ${Object.keys(envLocalResult.parsed || {}).join(', ')}`);
}

console.log('[Env] Environment variables loading process complete');
