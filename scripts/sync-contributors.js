import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const REPO_OWNER = 'ScriptureHabit';
const REPO_NAME = 'scripture-habit';

async function fetchContributors() {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contributors?per_page=100`;
  const headers = {
    'User-Agent': 'ScriptureHabit-Contributor-Updater',
    'Accept': 'application/vnd.github.v3+json',
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch contributors: ${res.status} ${res.statusText}`);
  }

  const contributors = await res.json();
  // Filter out bots
  return contributors.filter((c) => !c.login.includes('[bot]') && c.type !== 'Bot');
}

function generateTableHtml(contributors) {
  const perRow = 5;
  const rows = [];

  for (let i = 0; i < contributors.length; i += perRow) {
    const chunk = contributors.slice(i, i + perRow);
    const colWidth = `${Math.floor(100 / Math.min(contributors.length, perRow))}%`;
    const cells = chunk.map((c) => {
      const name = c.name || c.login;
      const avatarUrl = `${c.avatar_url}&s=100`;
      return `      <td align="center" valign="top" width="${colWidth}"><a href="${c.html_url}"><img src="${avatarUrl}" width="100px;" alt="${name}"/><br /><sub><b>${name}</b></sub></a></td>`;
    });
    rows.push(`    <tr>\n${cells.join('\n')}\n    </tr>`);
  }

  return `<table>\n  <tbody>\n${rows.join('\n')}\n  </tbody>\n</table>`;
}

function updateFile(filePath, tableHtml) {
  const fullPath = path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) return;

  const content = fs.readFileSync(fullPath, 'utf8');
  const startTag = '<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->';
  const endTag = '<!-- ALL-CONTRIBUTORS-LIST:END -->';

  const startIndex = content.indexOf(startTag);
  const endIndex = content.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1) {
    console.warn(`Tags not found in ${filePath}`);
    return;
  }

  const newContent =
    content.substring(0, startIndex + startTag.length) +
    '\n<!-- prettier-ignore-start -->\n<!-- markdownlint-disable -->\n' +
    tableHtml +
    '\n\n<!-- markdownlint-restore -->\n<!-- prettier-ignore-end -->\n\n' +
    content.substring(endIndex);

  fs.writeFileSync(fullPath, newContent, 'utf8');
  console.log(`Updated ${filePath}`);
}

async function main() {
  try {
    console.log('Fetching contributors from GitHub API...');
    const contributors = await fetchContributors();
    console.log(`Found ${contributors.length} contributors:`, contributors.map((c) => c.login).join(', '));

    const tableHtml = generateTableHtml(contributors);
    updateFile('README.md', tableHtml);
    updateFile('README.ja.md', tableHtml);
    console.log('Successfully synchronized contributors to README files.');
  } catch (err) {
    console.error('Error updating contributors:', err);
    process.exit(1);
  }
}

main();
