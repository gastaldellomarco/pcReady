import fs from 'fs/promises';
import path from 'path';

const root = process.cwd();
const scanDir = process.argv[2] || 'src';
const outDir = 'reports';

function isTsxFile(file) {
  return file.endsWith('.tsx') || file.endsWith('.jsx');
}

async function walk(dir) {
  const res = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      res.push(...(await walk(full)));
    } else if (isTsxFile(e.name)) {
      res.push(full);
    }
  }
  return res;
}

function hasLikelyJsx(code) {
  // heuristic: presence of '<' followed by letter (element) before many exports
  return /<\s*[A-Za-z]/.test(code);
}

function collectRuntimeExports(code) {
  const exports = [];
  const runtimeRe = /export\s+(const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g;
  let m;
  while ((m = runtimeRe.exec(code))) {
    exports.push(m[2]);
  }

  const namedRe = /export\s*{([^}]+)}/g;
  while ((m = namedRe.exec(code))) {
    const list = m[1].split(',').map(s => s.split('as')[0].trim()).filter(Boolean);
    exports.push(...list);
  }

  // remove type/interface exports (TypeScript-only)
  // they use 'export type' or 'export interface' which won't be matched above

  return Array.from(new Set(exports));
}

function isLikelyComponentName(name) {
  if (!name) return false;
  const first = name[0];
  return first === first.toUpperCase();
}

async function main() {
  const fullScanDir = path.join(root, scanDir);
  try {
    await fs.mkdir(outDir, { recursive: true });
  } catch (e) {}

  const files = await walk(fullScanDir);
  const report = [];
  for (const f of files) {
    try {
      const code = await fs.readFile(f, 'utf8');
      if (!hasLikelyJsx(code)) continue;
      const exports = collectRuntimeExports(code);
      const nonComponentExports = exports.filter(n => n && !isLikelyComponentName(n));
      if (nonComponentExports.length) {
        report.push({ file: path.relative(root, f).replace(/\\/g, '/'), exports: nonComponentExports });
      }
    } catch (e) {
      console.error('read error', f, e.message);
    }
  }

  const outPath = path.join(outDir, 'fast-refresh-issues.json');
  await fs.writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Found ${report.length} files with probable non-component exports`);
  for (const r of report) console.log(r.file + ': ' + r.exports.join(', '));
  console.log(`Wrote report to ${outPath}`);
}

main().catch(err => { console.error(err); process.exitCode = 2; });
