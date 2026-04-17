import { spawnSync } from 'node:child_process';
import process from 'node:process';

/**
 * This script wraps a command to be executed within the Firebase Emulator environment.
 * It correctly handles additional arguments passed via `npm run <script> -- <args>`,
 * which the standard `firebase emulators:exec` command struggles with when using quotes.
 */

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/test-emulated.js "<command>" [additional args...]');
  process.exit(1);
}

const baseCommand = args[0];
const extraArgs = args.slice(1).join(' ');
const fullCommand = `${baseCommand} ${extraArgs}`.trim();

console.log(`[test-emulated] Executing: firebase emulators:exec --project scripture-habit-auth "${fullCommand}"`);

// On Windows, we need to be careful with how npx and arguments are handled.
// Using shell: true with a single command string is often more reliable on Windows for complex quoting.
const firebaseCmd = `npx firebase emulators:exec --project scripture-habit-auth "${fullCommand.replace(/"/g, '\\"')}"`;

const result = spawnSync(firebaseCmd, {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 0);
