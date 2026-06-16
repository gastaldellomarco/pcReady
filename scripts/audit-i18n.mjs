import { readFileSync, readdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const srcDir = join(root, "src");
const localesDir = join(srcDir, "i18n", "locales");

// Load all translation files
const enDir = join(localesDir, "en");
const itDir = join(localesDir, "it");

function loadJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch { return {}; }
}

function flattenKeys(obj, prefix = "") {
  const result = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      for (const sub of flattenKeys(v, path)) result.add(sub);
    } else {
      result.add(path);
    }
  }
  return result;
}

const enFiles = {};
const itFiles = {};
for (const f of readdirSync(enDir).filter(f => f.endsWith(".json"))) {
  const ns = f.replace(".json", "");
  enFiles[ns] = flattenKeys(loadJson(join(enDir, f)));
}
for (const f of readdirSync(itDir).filter(f => f.endsWith(".json"))) {
  const ns = f.replace(".json", "");
  itFiles[ns] = flattenKeys(loadJson(join(itDir, f)));
}

// Walk source files and extract t() calls
import { readFileSync as rfs, readdirSync as rds, statSync } from "fs";

function walkDir(dir) {
  const results = [];
  for (const entry of rds(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    if (statSync(full).isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results;
}

const files = walkDir(srcDir);

// Track: namespace -> Set of keys used
const usedKeys = {};

// Match t("key") or t("key", ...) or t('key') 
// Also handles: t("ns:key") - namespaced calls
for (const file of files) {
  const content = readFileSync(file, "utf8");
  
  // Find useTranslation("ns") to get default namespace
  let defaultNs = null;
  const utMatch = content.match(/useTranslation\(\s*["']([^"']+)["']\s*\)/);
  if (utMatch) defaultNs = utMatch[1];
  
  // Find all t("key") or t('key') calls  
  const tCalls = content.matchAll(/\bt\(\s*["']([^"']+)["']/g);
  for (const match of tCalls) {
    let key = match[1];
    let ns = defaultNs;
    
    // Handle namespaced keys like "common:actions.save"
    if (key.includes(":")) {
      const parts = key.split(":");
      ns = parts[0];
      key = parts.slice(1).join(":");
    }
    
    if (!ns) continue; // Can't determine namespace
    
    if (!usedKeys[ns]) usedKeys[ns] = new Set();
    usedKeys[ns].add(key);
  }
}

// Report missing keys per namespace
console.log("=== I18N KEY AUDIT ===\n");

for (const [ns, keys] of Object.entries(usedKeys).sort()) {
  const enSet = enFiles[ns];
  const itSet = itFiles[ns];
  
  if (!enSet) {
    console.log(`[${ns}] Namespace has NO English translation file!`);
    continue;
  }
  
  const missingEn = [...keys].filter(k => !enSet.has(k));
  const missingIt = [...keys].filter(k => itSet && !itSet.has(k));
  
  if (missingEn.length > 0 || missingIt.length > 0) {
    console.log(`\n[${ns}] (${keys.size} keys used)`);
    if (missingEn.length > 0) {
      console.log(`  Missing from EN (${missingEn.length}):`);
      for (const k of missingEn) console.log(`    - ${k}`);
    }
    if (missingIt.length > 0) {
      console.log(`  Missing from IT (${missingIt.length}):`);
      for (const k of missingIt) console.log(`    - ${k}`);
    }
  }
}

// Also check: English keys that exist in IT but not used in code?
console.log("\n=== UNUSED ENGLISH KEYS (no code references) ===\n");
for (const [ns, enSet] of Object.entries(enFiles)) {
  const used = usedKeys[ns] || new Set();
  const unused = [...enSet].filter(k => !used.has(k));
  if (unused.length > 10) {
    console.log(`[${ns}] ${unused.length} unused keys (showing first 10):`);
    for (const k of unused.slice(0, 10)) console.log(`  - ${k}`);
  } else if (unused.length > 0) {
    console.log(`[${ns}] ${unused.length} unused keys:`);
    for (const k of unused) console.log(`  - ${k}`);
  }
}

console.log("\nDone.");
