import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env to run this script");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function detectTextHeader(buf) {
  const s = buf.toString("utf8", 0, Math.min(buf.length, 1024)).toLowerCase();
  if (s.includes("<svg") || s.includes("<html") || s.includes("<!doctype html")) return true;
  return false;
}

async function main() {
  const bucket = process.argv[2] || "ticket-documents";
  console.log("Scanning bucket:", bucket);
  const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1000 });
  if (error) throw error;
  const objects = data || [];
  const flagged = [];
  for (const obj of objects) {
    try {
      const { data: fileRes, error: dlErr } = await supabase.storage.from(bucket).download(obj.name);
      if (dlErr) {
        console.warn("Could not download", obj.name, dlErr.message || dlErr);
        continue;
      }
      const buf = Buffer.from(await fileRes.arrayBuffer());
      if (detectTextHeader(buf)) flagged.push(obj.name);
    } catch (e) {
      console.warn("Error processing", obj.name, e.message || e);
    }
  }
  console.log("Flagged (possible HTML/SVG) files:", flagged.length);
  for (const f of flagged) console.log(" -", f);
  // Optionally write to file
  fs.writeFileSync("attachment-scan-flagged.json", JSON.stringify(flagged, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
