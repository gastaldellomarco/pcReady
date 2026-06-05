import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env to run this script");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function rewrite(bucket = "ticket-documents") {
  console.log("Listing objects in bucket:", bucket);
  const { data: list, error: listErr } = await supabase.storage.from(bucket).list("");
  if (listErr) throw listErr;
  for (const obj of list || []) {
    try {
      console.log("Processing", obj.name);
      const { data: dl, error: dlErr } = await supabase.storage.from(bucket).download(obj.name);
      if (dlErr) {
        console.warn("Download failed for", obj.name, dlErr.message || dlErr);
        continue;
      }
      const buf = await dl.arrayBuffer();
      // Best-effort: re-upload the same content with upsert=true to refresh server-side metadata.
      // Note: Supabase JS SDK does not provide explicit content-disposition option. This
      // operation can still help if the storage backend refreshes inferred metadata.
      const { error: upErr } = await supabase.storage.from(bucket).upload(obj.name, buf, {
        upsert: true,
      });
      if (upErr) console.warn("Re-upload failed for", obj.name, upErr.message || upErr);
      else console.log("Re-uploaded", obj.name);
    } catch (e) {
      console.warn("Error processing", obj.name, e.message || e);
    }
  }
}

const bucketArg = process.argv[2] || "ticket-documents";
rewrite(bucketArg)
  .then(() => console.log("Done"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
