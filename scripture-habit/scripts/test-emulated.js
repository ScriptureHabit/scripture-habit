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
    // Linux/macOS: find PIDs on ports
    for (const port of ports) {
      let pid = '';
      try {
        pid = execSync(`lsof -t -i:${port}`, { encoding: 'utf8' }).trim();
      } catch {
        continue; // Port is free
      }
      if (pid) {
        try {
          // Check process name
          const procName = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8' }).trim().toLowerCase();
          if (procName.includes('java') || procName.includes('node')) {
            console.log(`[test-emulated] Port ${port} is taken by emulator/node process ${procName} (PID ${pid}). Killing zombie...`);
            execSync(`kill -9 ${pid}`);
          } else {
            console.log(`[test-emulated] Port ${port} is active but held by non-emulator process: ${procName} (PID ${pid}). Skipping.`);
          }
        } catch (err) {
          console.warn(`[test-emulated] WARNING: Failed to inspect or kill process ${pid} on port ${port} (${err.message || err}).`);
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
    const killedPids = new Set();
    for (const line of lines) {
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && /^\d+$/.test(pid) && !killedPids.has(pid)) {
          try {
            // Verify process name on Windows
            const taskInfo = execSync(`tasklist /FI "PID eq ${pid}" /NH`, { encoding: 'utf8', stdio: 'pipe' }).trim().toLowerCase();
            if (taskInfo.includes('java.exe') || taskInfo.includes('node.exe')) {
              console.log(`[test-emulated] Port ${port} is taken by emulator/node process (PID ${pid}). Killing zombie...`);
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
              killedPids.add(pid);
            } else {
              console.log(`[test-emulated] Port ${port} is active but held by non-emulator process (PID ${pid}). Skipping. Info: ${taskInfo.split(/\s+/)[0]}`);
            }
          } catch (err) {
            console.warn(`[test-emulated] WARNING: Failed to kill process ${pid} on port ${port} (${err.message || err}).`);
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

// Run with shell: false and array of arguments for maximum command validation safety
const isWin = os.platform() === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

// Split fullCommand into individual arguments so shell: false doesn't treat the entire string as a single binary name
const commandParts = fullCommand.split(/\s+/);

const execArgs = [
  'firebase',
  'emulators:exec',
  '--project',
  'scripture-habit-auth',
  '--',
  ...commandParts
];

const result = spawnSync(npxCmd, execArgs, {
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 0);
