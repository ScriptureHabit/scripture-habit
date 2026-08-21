import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';
import { LANGUAGES } from '../src/config/languages';

interface LocaleData {
  seo?: {
    title?: string;
    description?: string;
  };
  [key: string]: unknown;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = path.resolve(__dirname, '../dist');
const LOCALES_DIR = path.resolve(__dirname, '../src/locales');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');

function escapeHtmlAttr(str: string): string {
  return str.replace(/"/g, '&quot;');
}

async function localizeMeta() {
  if (!fs.existsSync(INDEX_HTML_PATH)) {
    console.error(`Error: index.html not found at ${INDEX_HTML_PATH}. Make sure to run 'vite build' first.`);
    process.exit(1);
  }

  const originalHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');

  for (const langConfig of LANGUAGES) {
    if (langConfig.code === 'en') continue;

    const lang = langConfig.code;
    const localeFilePath = path.join(LOCALES_DIR, `${lang}.ts`);
    if (!fs.existsSync(localeFilePath)) continue;

    const module = await import(pathToFileURL(localeFilePath).href);
    const localeData: LocaleData = module.default || {};

    const rawTitle = localeData.seo?.title || 'Scripture Habit';
    const rawDescription = localeData.seo?.description || '';

    const title = escapeHtmlAttr(rawTitle);
    const description = escapeHtmlAttr(rawDescription);

    // Replace <title>
    let localizedHtml = originalHtml.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);

    // Replace name="description"
    localizedHtml = localizedHtml.replace(
      /<meta name="description" content=".*?"\s*\/?>/,
      `<meta name="description" content="${description}" />`
    );

    // Replace og:title
    localizedHtml = localizedHtml.replace(
      /<meta property="og:title" content=".*?"\s*\/?>/,
      `<meta property="og:title" content="${title}" />`
    );

    // Replace og:description
    localizedHtml = localizedHtml.replace(
      /<meta property="og:description" content=".*?"\s*\/?>/,
      `<meta property="og:description" content="${description}" />`
    );

    // Replace twitter:title
    localizedHtml = localizedHtml.replace(
      /<meta name="twitter:title" content=".*?"\s*\/?>/,
      `<meta name="twitter:title" content="${title}" />`
    );

    // Replace twitter:description
    localizedHtml = localizedHtml.replace(
      /<meta name="twitter:description" content=".*?"\s*\/?>/,
      `<meta name="twitter:description" content="${description}" />`
    );

    // Replace apple-mobile-web-app-title
    const shortTitle = title.split(' | ')[0];
    localizedHtml = localizedHtml.replace(
      /<meta name="apple-mobile-web-app-title" content=".*?"\s*\/?>/,
      `<meta name="apple-mobile-web-app-title" content="${shortTitle}" />`
    );

    const outputPath = path.join(DIST_DIR, `index-${lang}.html`);
    fs.writeFileSync(outputPath, localizedHtml, 'utf-8');
    console.log(`Generated ${outputPath} for language: ${lang}`);
  }
}

localizeMeta().catch((err) => {
  console.error('Error running localizeMeta:', err);
  process.exit(1);
});
