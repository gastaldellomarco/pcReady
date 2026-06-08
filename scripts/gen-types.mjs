import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, "..", "src", "integrations", "supabase", "types.ts");

console.log("Generating Supabase types from linked project...");

const raw = execSync("supabase gen types typescript --linked", {
  stdio: ["ignore", "pipe", "inherit"],
  encoding: "utf8",
});

// Clean CLI pollution from stdout before writing
const lines = raw.split(/\r?\n/);

// Strip first line if it's a CLI log (doesn't start with TypeScript)
if (lines.length > 0 && !lines[0].trim().startsWith("export")) {
  lines.shift();
}

// Strip trailing CLI update notices (not valid TypeScript)
while (lines.length > 0) {
  const last = lines[lines.length - 1].trim();
  if (!last || last.startsWith("export") || last.startsWith("}") || last === "} as const" || last.endsWith(";")) break;
  lines.pop();
}

const content = lines.join("\n");
writeFileSync(OUTPUT, content, "utf8");
console.log(`Types written to ${OUTPUT} (${(content.length / 1024).toFixed(1)} KB)`);
