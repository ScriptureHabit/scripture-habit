import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Find open port or use 5173
const PORT = 5173;

function killProcess(proc: ChildProcess) {
  if (process.platform === 'win32' && proc.pid) {
    spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], { stdio: 'ignore' });
  } else {
    proc.kill();
  }
}

async function runAudit() {
  console.log(`🚀 Starting local preview server on port ${PORT}...`);
  const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    shell: true,
    stdio: 'ignore'
  });

  // Wait for server to be ready
  const isReady = await new Promise<boolean>((resolve) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(`http://127.0.0.1:${PORT}`, (res) => {
        if (res.statusCode && res.statusCode < 400) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', () => retry());
    };

    const retry = () => {
      if (attempts > 30) return resolve(false);
      setTimeout(check, 500);
    };

    check();
  });

  if (!isReady) {
    console.error('❌ Server failed to start.');
    killProcess(preview);
    process.exit(1);
  }

  console.log(`🔍 Running Lighthouse audit against http://127.0.0.1:${PORT}/en/...`);
  const lhciDir = path.resolve('.lighthouseci');
  if (!fs.existsSync(lhciDir)) {
    fs.mkdirSync(lhciDir, { recursive: true });
  }

  const outputPath = path.join(lhciDir, 'latest.report.json');

  const lighthouseCmd = `npx lighthouse http://127.0.0.1:${PORT}/en/ --output=json --output-path="${outputPath}" --chrome-flags="--headless --no-sandbox --disable-gpu" --view=false --quiet`;
  
  const lhProcess = spawn(lighthouseCmd, { shell: true, stdio: 'inherit' });

  lhProcess.on('exit', () => {
    killProcess(preview);
    console.log('✅ Audit finished. Printing report summary:');
    spawn('npx', ['tsx', 'scripts/show-lighthouse-report.ts'], { shell: true, stdio: 'inherit' });
  });
}

runAudit();
