import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
const timestampPattern = /^\d{14}_.+\.sql$/;
const errors = [];

for (const file of files) {
  const fullPath = join(migrationsDir, file);
  const sql = await readFile(fullPath, "utf8");
  if (file !== "patch_idempotent.sql" && !timestampPattern.test(file)) {
    errors.push(`${file}: nome migration non valido, usa YYYYMMDDHHMMSS_nome.sql`);
  }

  if (!sql.trim()) {
    errors.push(`${file}: file vuoto`);
  }

  if (/<<<<<<<|=======|>>>>>>>/.test(sql)) {
    errors.push(`${file}: contiene marker di merge conflict`);
  }

  const dollarQuoteMatches = sql.match(/\$[a-zA-Z0-9_]*\$/g) ?? [];
  const dollarQuoteCounts = dollarQuoteMatches.reduce((acc, tag) => {
    acc.set(tag, (acc.get(tag) ?? 0) + 1);
    return acc;
  }, new Map());
  for (const [tag, count] of dollarQuoteCounts) {
    if (count % 2 !== 0) errors.push(`${file}: blocco dollar-quote ${tag} non bilanciato`);
  }
}

if (!files.length) errors.push("Nessuna migration SQL trovata in supabase/migrations");

if (errors.length) {
  console.error("Supabase migration check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Supabase migration check passed (${files.length} file).`);
