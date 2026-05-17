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

function run(command, commandArgs, options = {}) {
  console.log(`$ ${[command, ...commandArgs].join(" ")}`);
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: options.shell ?? process.platform === "win32",
  });

  if (result.error) {
    console.error(
      `Impossibile eseguire '${command}'. Verifica che Supabase CLI sia installata e nel PATH.`,
    );
    process.exit(1);
  }

  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (hasFlag("help")) {
  console.log(
    `Uso: node scripts/supabase-reset.mjs [--target=local|linked] [--skip-backup] [--confirm=RESET-LINKED]\n\nResetta il database con Supabase CLI. Prima del reset esegue un backup data-only, salvo --skip-backup.\nPer il target linked serve --confirm=RESET-LINKED oppure SUPABASE_RESET_CONFIRM=RESET-LINKED.`,
  );
  process.exit(0);
}

const target = readOption("target", "local");
if (!["local", "linked"].includes(target)) {
  console.error("Target non valido. Usa --target=local oppure --target=linked.");
  process.exit(1);
}

if (target === "linked") {
  const confirmation = readOption("confirm", process.env.SUPABASE_RESET_CONFIRM);
  if (confirmation !== "RESET-LINKED") {
    console.error(
      "Reset remoto bloccato: riesegui con --confirm=RESET-LINKED per confermare la distruzione dei dati del progetto Supabase collegato.",
    );
    process.exit(1);
  }
}

if (!hasFlag("skip-backup")) {
  run(process.execPath, ["scripts/supabase-backup.mjs", `--target=${target}`], { shell: false });
}

const commandArgs = ["db", "reset"];
commandArgs.push(target === "linked" ? "--linked" : "--local");

run("supabase", commandArgs);
console.log(
  "Reset completato. Le migration e i seed configurati in supabase/config.toml sono stati applicati dal comando Supabase CLI.",
);
