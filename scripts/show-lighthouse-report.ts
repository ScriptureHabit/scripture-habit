import fs from 'fs';
import path from 'path';

interface LighthouseCategory {
  title: string;
  score: number | null;
}

interface LighthouseAudit {
  title: string;
  score: number | null;
  displayValue?: string;
  details?: {
    type?: string;
  };
}

const lhciDir = path.resolve('.lighthouseci');

if (!fs.existsSync(lhciDir)) {
  console.error('❌ .lighthouseci directory not found. Please run a lighthouse test first.');
  process.exit(1);
}

const files = fs.readdirSync(lhciDir).filter(f => f.endsWith('.report.json') || (f.startsWith('lhr-') && f.endsWith('.json')));

if (files.length === 0) {
  console.error('❌ No report JSON found in .lighthouseci');
  process.exit(1);
}

// Get the latest report file
const latestFile = files.map(f => ({
  file: f,
  mtime: fs.statSync(path.join(lhciDir, f)).mtimeMs
})).sort((a, b) => b.mtime - a.mtime)[0].file;

const reportPath = path.join(lhciDir, latestFile);
const data = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

console.log('\n======================================================');
console.log(`📊 LIGHTHOUSE AUDIT REPORT SUMMARY`);
console.log(`🔗 URL: ${data.finalDisplayedUrl || data.finalUrl || data.requestedUrl}`);
console.log(`🕒 Tested At: ${new Date(data.fetchTime).toLocaleString()}`);
console.log('======================================================\n');

// 1. Categories Overview
console.log('--- 🏆 Category Scores ---');
const categories = (data.categories || {}) as Record<string, LighthouseCategory>;
for (const cat of Object.values(categories)) {
  const score = Math.round((cat.score || 0) * 100);
  let icon = '🔴';
  if (score >= 90) icon = '🟢';
  else if (score >= 50) icon = '🟡';
  console.log(`${icon} ${(cat.title + ':').padEnd(20)} ${score.toString().padStart(3)} / 100`);
}

// 2. Performance Core Web Vitals
console.log('\n--- ⚡ Core Web Vitals & Performance Metrics ---');
const audits = (data.audits || {}) as Record<string, LighthouseAudit>;
const metrics = [
  { key: 'first-contentful-paint', label: 'First Contentful Paint (FCP)' },
  { key: 'largest-contentful-paint', label: 'Largest Contentful Paint (LCP)' },
  { key: 'total-blocking-time', label: 'Total Blocking Time (TBT)' },
  { key: 'cumulative-layout-shift', label: 'Cumulative Layout Shift (CLS)' },
  { key: 'speed-index', label: 'Speed Index' },
];

metrics.forEach(({ key, label }) => {
  const audit = audits[key];
  if (!audit) return;
  const score = Math.round((audit.score || 0) * 100);
  let icon = '🟢';
  if (score < 50) icon = '🔴';
  else if (score < 90) icon = '🟡';
  console.log(`${icon} ${label.padEnd(35)}: ${(audit.displayValue || '').padStart(8)}  (Score: ${score})`);
});

// 3. Top Performance Bottlenecks / Unused JS
console.log('\n--- 🔍 Top Improvement Opportunities ---');
const opportunities = Object.values(audits)
  .filter((a): a is LighthouseAudit => Boolean(a.details && a.details.type === 'opportunity' && a.score !== null && a.score < 0.9))
  .sort((a, b) => (a.score || 0) - (b.score || 0));

if (opportunities.length === 0) {
  console.log('✨ No critical opportunities found! Great job.');
} else {
  opportunities.forEach((op) => {
    console.log(`⚠️  ${op.title} - ${op.displayValue || ''}`);
  });
}

console.log('\n======================================================\n');
