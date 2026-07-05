import { spawnSync, execSync } from 'node:child_process';
import process from 'node:process';
import os from 'node:os';

/**
 * This script wraps a command to be executed within the Firebase Emulator environment.
 * It also automatically detects and kills any zombie emulator processes taking ports
 * (such as 8080, 9099, etc.) to prevent "Port taken" emulator startup failures.
 */

const PORTS_TO_FREE = [8080, 9099, 5005, 4400, 4500];

function killZombieEmulatorProcesses(ports) {
  const isWin = os.platform() === 'win32';
  if (!isWin) {
    // Linux/macOS fallback: kill using lsof
    for (const port of ports) {
      let pid = '';
      try {
        pid = execSync(`lsof -t -i:${port}`, { encoding: 'utf8' }).trim();
      } catch {
        continue; // Port is free
      }
      if (pid) {
        try {
          console.log(`[test-emulated] Port ${port} is taken by PID ${pid}. Killing zombie process...`);
          execSync(`kill -9 ${pid}`);
        } catch (err) {
          console.warn(`[test-emulated] WARNING: Failed to kill process ${pid} on port ${port} (${err.message || err}). You may need sudo/administrator privileges, or you should kill it manually.`);
        }
      }
    }
    return;
  }

  // Windows: find using netstat and kill using taskkill
  for (const port of ports) {
    let output = '';
    try {
      output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' }).trim();
    } catch {
      continue; // Port is free
    }
    if (!output) continue;

    const lines = output.split(/\r?\n/);
    for (const line of lines) {
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && /^\d+$/.test(pid)) {
          try {
            console.log(`[test-emulated] Port ${port} is taken by PID ${pid}. Killing zombie process...`);
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
          } catch (err) {
            console.warn(`[test-emulated] WARNING: Failed to kill process ${pid} on port ${port} (${err.message || err}). This usually happens due to lack of Administrator permissions. Please run the terminal as Administrator or kill it manually.`);
          }
        }
      }
    }
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/test-emulated.js "<command>" [additional args...]');
  process.exit(1);
}

const baseCommand = args[0];
const extraArgs = args.slice(1).join(' ');
const fullCommand = `${baseCommand} ${extraArgs}`.trim();

console.log('[test-emulated] Checking emulator ports to prevent zombie conflicts...');
killZombieEmulatorProcesses(PORTS_TO_FREE);

console.log(`[test-emulated] Executing: firebase emulators:exec --project scripture-habit-auth "${fullCommand}"`);

// On Windows, we need to be careful with how npx and arguments are handled.
const firebaseCmd = `npx firebase emulators:exec --project scripture-habit-auth "${fullCommand.replace(/"/g, '\\"')}"`;

const result = spawnSync(firebaseCmd, {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 0);
