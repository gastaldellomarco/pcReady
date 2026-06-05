import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), "..");
const SRC = path.join(ROOT, "src");
const IGNORED_DIRS = new Set(["node_modules", "dist", ".git", "public"]);
const EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      if (IGNORED_DIRS.has(e.name)) continue;
      files.push(...(await walk(path.join(dir, e.name))));
    } else if (e.isFile()) {
      if (EXT.has(path.extname(e.name))) files.push(path.join(dir, e.name));
    }
  }
  return files;
}

function normalizeLine(line) {
  return line.replace(/[\t ]+/g, " ").trim();
}

async function fixFile(file) {
  const raw = await fs.readFile(file, "utf8");
  const lines = raw.split(/\r?\n/);
  const seen = new Set();
  let changed = false;
  const out = [];
  for (const line of lines) {
    const tri = line.trimStart();
    if (tri.startsWith("import ")) {
      const norm = normalizeLine(tri);
      if (seen.has(norm)) {
        changed = true;
        // skip duplicate import
        continue;
      }
      seen.add(norm);
      out.push(line);
    } else {
      out.push(line);
    }
  }
  if (changed) {
    await fs.writeFile(file, out.join("\n"));
    console.log("Fixed duplicates in", file);
  }
}

(async () => {
  try {
    const files = await walk(SRC);
    for (const f of files) {
      await fixFile(f);
    }
    console.log("Done");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
