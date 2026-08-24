import { spawn, spawnSync, execSync } from 'node:child_process';
import process from 'node:process';
import os from 'node:os';
import net from 'node:net';
import readline from 'node:readline';

const PORTS_TO_FREE = [8080, 9099, 5005, 5000];
const EMULATOR_PORTS = [8080, 9099];

// ANSI Colors
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

const PREFIXES = {
  SYS: `${COLORS.bright}${COLORS.blue}[SYS]${COLORS.reset} `,
  EMU: `${COLORS.bright}${COLORS.cyan}[EMU]${COLORS.reset} `,
  SEED: `${COLORS.bright}${COLORS.yellow}[SEED]${COLORS.reset} `,
  API: `${COLORS.bright}${COLORS.magenta}[API]${COLORS.reset} `,
  WEB: `${COLORS.bright}${COLORS.green}[WEB]${COLORS.reset} `,
};

const childProcesses = [];
let isShuttingDown = false;

function log(prefix, msg) {
  console.log(`${prefix}${msg}`);
}

function killProcessTree(pid) {
  if (!pid) return;
  const isWin = os.platform() === 'win32';
  try {
    if (isWin) {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    // Process may have already exited
  }
}

function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n${PREFIXES.SYS}${COLORS.yellow}Shutting down all development processes...${COLORS.reset}`);

  for (const child of childProcesses) {
    if (child && child.pid) {
      killProcessTree(child.pid);
    }
  }

  // Also clean up any lingering emulator/backend ports
  killZombiePorts(PORTS_TO_FREE);
  console.log(`${PREFIXES.SYS}${COLORS.green}All processes stopped. Goodbye! 👋${COLORS.reset}`);
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
  for (const child of childProcesses) {
    if (child && child.pid) {
      killProcessTree(child.pid);
    }
  }
});

function killZombiePorts(ports) {
  const isWin = os.platform() === 'win32';
  if (!isWin) {
    for (const port of ports) {
      try {
        const pid = execSync(`lsof -t -i:${port}`, { encoding: 'utf8' }).trim();
        if (pid) {
          const procName = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8' }).trim().toLowerCase();
          if (procName.includes('java') || procName.includes('node')) {
            execSync(`kill -9 ${pid}`);
          }
        }
      } catch {
        // Port free
      }
    }
    return;
  }

  // Windows netstat + taskkill
  for (const port of ports) {
    try {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' }).trim();
      if (!output) continue;

      const lines = output.split(/\r?\n/);
      const killedPids = new Set();
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0' && /^\d+$/.test(pid) && !killedPids.has(pid)) {
            try {
              const taskInfo = execSync(`tasklist /FI "PID eq ${pid}" /NH`, { encoding: 'utf8', stdio: 'pipe' }).trim().toLowerCase();
              if (taskInfo.includes('java.exe') || taskInfo.includes('node.exe')) {
                execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                killedPids.add(pid);
              }
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch {
      // Port free
    }
  }
}

function pipeOutput(child, prefix) {
  if (child.stdout) {
    const rlOut = readline.createInterface({ input: child.stdout });
    rlOut.on('line', (line) => {
      if (line.trim()) log(prefix, line);
    });
  }
  if (child.stderr) {
    const rlErr = readline.createInterface({ input: child.stderr });
    rlErr.on('line', (line) => {
      if (line.trim()) log(prefix, `${COLORS.red}${line}${COLORS.reset}`);
    });
  }
}

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitForPorts(ports, timeoutMs = 45000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (isShuttingDown) return false;
    const checks = await Promise.all(ports.map((p) => checkPort(p)));
    if (checks.every(Boolean)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

async function startDevEnvironment() {
  console.log(`\n${COLORS.bright}${COLORS.cyan}=================================================${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan} 🚀 Scripture Habit All-in-One Dev Environment ${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan}=================================================${COLORS.reset}\n`);

  // Step 1: Clean up old zombie ports
  log(PREFIXES.SYS, 'Checking and freeing ports (8080, 9099, 5005, 5000)...');
  killZombiePorts(PORTS_TO_FREE);

  // Step 2: Start Firebase Emulators
  log(PREFIXES.SYS, 'Starting Firebase Emulators in background...');
  const isWin = os.platform() === 'win32';
  const npmCmd = isWin ? 'npm.cmd' : 'npm';

  const emuProcess = spawn(npmCmd, ['run', 'emulators'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
    detached: !isWin,
  });
  childProcesses.push(emuProcess);
  pipeOutput(emuProcess, PREFIXES.EMU);

  // Step 3: Wait for Emulators to become ready
  log(PREFIXES.SYS, 'Waiting for Firestore (8080) and Auth (9099) emulators to initialize...');
  const emuReady = await waitForPorts(EMULATOR_PORTS, 45000);

  if (!emuReady) {
    log(PREFIXES.SYS, `${COLORS.red}❌ Emulators failed to start in time. Aborting.${COLORS.reset}`);
    cleanup();
    return;
  }

  log(PREFIXES.SYS, `${COLORS.green}✔ Firebase Emulators are ready!${COLORS.reset}`);

  // Step 4: Run DB Seed
  log(PREFIXES.SYS, `${COLORS.yellow}🌱 Seeding database (npm run db:seed)...${COLORS.reset}`);
  const seedResult = spawnSync(npmCmd, ['run', 'db:seed'], {
    stdio: 'inherit',
    shell: isWin,
  });

  if (seedResult.status !== 0) {
    log(PREFIXES.SYS, `${COLORS.yellow}⚠ db:seed exited with code ${seedResult.status}. Continuing with startup...${COLORS.reset}`);
  } else {
    log(PREFIXES.SYS, `${COLORS.green}✔ Database seeded successfully!${COLORS.reset}`);
  }

  // Step 5: Start Backend API server
  log(PREFIXES.SYS, 'Starting Backend server (http://localhost:5000)...');
  const backendProcess = spawn(npmCmd, ['run', 'server'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
    detached: !isWin,
  });
  childProcesses.push(backendProcess);
  pipeOutput(backendProcess, PREFIXES.API);

  // Step 6: Start Frontend (Vite)
  log(PREFIXES.SYS, 'Starting Frontend development server (Vite)...');
  const frontendProcess = spawn(npmCmd, ['run', 'dev'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin,
    detached: !isWin,
  });
  childProcesses.push(frontendProcess);
  pipeOutput(frontendProcess, PREFIXES.WEB);

  console.log(`\n${COLORS.bright}${COLORS.green}=================================================${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.green} ✨ All services running! Press Ctrl+C to stop. ✨ ${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.green}=================================================${COLORS.reset}\n`);
}

startDevEnvironment().catch((err) => {
  console.error(`${PREFIXES.SYS}${COLORS.red}Fatal startup error: ${err.message}${COLORS.reset}`);
  cleanup();
});
