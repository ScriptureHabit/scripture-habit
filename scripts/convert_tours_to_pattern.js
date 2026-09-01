import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const toursDir = path.join(projectRoot, '.tours');

if (!fs.existsSync(toursDir)) {
  console.error('Directory .tours not found');
  process.exit(1);
}

const tourFiles = fs.readdirSync(toursDir).filter(f => f.endsWith('.tour'));
console.log(`Processing ${tourFiles.length} .tour files with Semantic Alignment...\n`);

let totalSteps = 0;
let realignedSteps = 0;

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractKeywords(description) {
  const codeSnippets = [];
  const backtickRegex = /`([^`]+)`/g;
  let match;
  while ((match = backtickRegex.exec(description)) !== null) {
    const raw = match[1].trim();
    if (raw.length > 2 && !raw.includes('\n') && !raw.startsWith('http')) {
      codeSnippets.push(raw.replace(/\.\.\./g, ''));
    }
  }

  // Extract function-like keywords from title or header
  const titleMatches = description.match(/(?:function|const|let|var|class|interface|type|export|import)\s+([A-Za-z0-9_$]+)/g) || [];
  titleMatches.forEach(m => {
    const parts = m.split(/\s+/);
    if (parts[1]) codeSnippets.push(parts[1]);
  });

  return Array.from(new Set(codeSnippets)).filter(Boolean);
}

function findBestLine(lines, keywords, currentLine) {
  if (!lines || lines.length === 0) return { line: 1, pattern: '^.*$' };

  let bestLine = currentLine || 1;
  let highestScore = -1;
  let bestPattern = '';

  for (let idx = 0; idx < lines.length; idx++) {
    const lineText = lines[idx];
    const lineNum = idx + 1;
    const trimmed = lineText.trim();
    if (!trimmed) continue;

    let score = 0;

    // Heavy penalty for pure import statements or trivial comments
    if (trimmed.startsWith('import ') && !keywords.some(k => k.startsWith('import '))) {
      score -= 1000;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      score -= 500;
    }

    // Boost for export / declaration lines
    if (trimmed.startsWith('export const ') || trimmed.startsWith('export function ') || trimmed.startsWith('export default ')) {
      score += 50;
    }

    // Keyword matching
    for (const kw of keywords) {
      if (lineText.includes(kw)) {
        score += 100;
        // Exact identifier boundary bonus
        const wordRegex = new RegExp(`\\b${escapeRegex(kw)}\\b`);
        if (wordRegex.test(lineText)) {
          score += 150;
        }
      }
    }

    // Distance penalty if currentLine was somewhat close
    if (currentLine && currentLine > 0) {
      const dist = Math.abs(lineNum - currentLine);
      score -= dist * 0.1;
    }

    if (score > highestScore) {
      highestScore = score;
      bestLine = lineNum;
      
      // Build clean pattern
      bestPattern = `^\\s*${escapeRegex(trimmed.slice(0, 40)).replace(/\s+/g, '\\s+')}`;
    }
  }

  // Fallback pattern if none found
  if (!bestPattern) {
    const targetLineText = lines[Math.min(bestLine - 1, lines.length - 1)].trim();
    bestPattern = `^\\s*${escapeRegex(targetLineText.slice(0, 40)).replace(/\s+/g, '\\s+')}`;
  }

  return { line: bestLine, pattern: bestPattern };
}

tourFiles.forEach(file => {
  const filePath = path.join(toursDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  let tour;
  try {
    tour = JSON.parse(content);
  } catch (err) {
    console.error(`❌ Failed to parse ${file}:`, err.message);
    return;
  }

  let modified = false;

  if (tour.steps && Array.isArray(tour.steps)) {
    tour.steps.forEach(step => {
      totalSteps++;
      // 1. Normalize file path
      let targetRelPath = step.file ? step.file.replace(/\\/g, '/') : '';
      if (targetRelPath.startsWith('scripture-habit/')) {
        targetRelPath = targetRelPath.replace(/^scripture-habit\//, '');
        step.file = targetRelPath;
        modified = true;
      }

      const fullTarget = path.join(projectRoot, targetRelPath);
      if (!fs.existsSync(fullTarget)) {
        return;
      }

      const fileContent = fs.readFileSync(fullTarget, 'utf8');
      const lines = fileContent.split(/\r?\n/);

      // Check if existing pattern matches
      let patternMatches = false;
      if (step.pattern) {
        try {
          const reg = new RegExp(step.pattern);
          const currentIdx = (step.line || 1) - 1;
          if (lines[currentIdx] && reg.test(lines[currentIdx])) {
            patternMatches = true;
          } else {
            // Find if pattern matches anywhere else
            for (let i = 0; i < lines.length; i++) {
              if (reg.test(lines[i])) {
                if (step.line !== i + 1) {
                  step.line = i + 1;
                  modified = true;
                  realignedSteps++;
                }
                patternMatches = true;
                break;
              }
            }
          }
        } catch {
          patternMatches = false;
        }
      }

      if (!patternMatches) {
        const keywords = extractKeywords(step.description || '');
        const { line, pattern } = findBestLine(lines, keywords, step.line);
        if (step.line !== line || step.pattern !== pattern) {
          step.line = line;
          step.pattern = pattern;
          modified = true;
          realignedSteps++;
        }
      }
    });
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(tour, null, 2), 'utf8');
  }
});

console.log('================ Semantic Alignment Summary ================');
console.log(`Total Tours Processed  : ${tourFiles.length}`);
console.log(`Total Steps Evaluated  : ${totalSteps}`);
console.log(`Steps Re-aligned to Code: ${realignedSteps} (Fixed misaligned steps)`);
console.log('============================================================\n');
