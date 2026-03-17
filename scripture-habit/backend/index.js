/**
 * Local Development Server
 * This file boots up the same Express app used in production (Vercel),
 * but binds it to a local port for development.
 */
import app from '../api/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local'), override: true });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Scripture Habit Backend running locally on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});