import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env then .env.local (override=true) from repo root
const rootPath = path.join(__dirname, '../../');
dotenv.config({ path: path.join(rootPath, '.env') });
dotenv.config({ path: path.join(rootPath, '.env.local'), override: true });

console.log('[Env] Environment variables loaded from root .env and .env.local');
