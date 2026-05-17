import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

function readOption(name, fallback = undefined) {
  const prefix = `--${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  if (value) return value.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) return args[index + 1];
  return fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function run(command, commandArgs) {
  console.log(`$ ${[command, ...commandArgs].join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(
      `Impossibile eseguire '${command}'. Verifica che Supabase CLI sia installata e nel PATH.`,
    );
    process.exit(1);
  }

  if (result.status !== 0) process.exit(result.status ?? 1);
}

const target = readOption("target", "local");
if (!["local", "linked"].includes(target)) {
  console.error("Target non valido. Usa --target=local oppure --target=linked.");
  process.exit(1);
}

const output = resolve(readOption("output", `backups/supabase-${target}-data-${timestamp()}.sql`));
mkdirSync(dirname(output), { recursive: true });

const commandArgs = ["db", "dump", "--data-only", "--file", output];
commandArgs.push(target === "linked" ? "--linked" : "--local");

if (hasFlag("help")) {
  console.log(
    `Uso: node scripts/supabase-backup.mjs [--target=local|linked] [--output=backups/file.sql]\n\nEsegue un dump data-only tramite Supabase CLI. Default: --target=local.`,
  );
  process.exit(0);
}

run("supabase", commandArgs);
console.log(`Backup completato: ${output}`);
