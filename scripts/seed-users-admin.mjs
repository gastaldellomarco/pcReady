import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const H = {
  "Content-Type": "application/json",
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

// REST client for DB operations (profiles, roles)
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const SEED_USERS = [
  { email: "marco.villa@pcready.test",  fullName: "Marco Villa",   initials: "MV", role: "admin" },
  { email: "laura.bianchi@pcready.test", fullName: "Laura Bianchi", initials: "LB", role: "tech" },
  { email: "diego.ferraris@pcready.test", fullName: "Diego Ferraris", initials: "DF", role: "tech" },
  { email: "sara.moretti@pcready.test",  fullName: "Sara Moretti",  initials: "SM", role: "tech" },
  { email: "valerio.neri@pcready.test",  fullName: "Valerio Neri",  initials: "VN", role: "viewer" },
];

async function gotrue(method, path, body) {
  const url = `${SUPABASE_URL}/auth/v1${path}`;
  const opts = { method, headers: H };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log("=== Seed Users via Admin API ===\n");

  for (const seed of SEED_USERS) {
    process.stdout.write(`\n--- ${seed.email} (${seed.fullName}) ---\n`);

    // 1) Try to create the user
    const create = await gotrue("POST", "/admin/users", {
      email: seed.email,
      password: "password123",
      email_confirm: true,
      user_metadata: { full_name: seed.fullName },
    });

    let uid = null;

    if (create.ok && create.data?.id) {
      uid = create.data.id;
      process.stdout.write(`  Created (id: ${uid})\n`);
    } else if (create.status === 422 || (create.data?.msg || "").includes("already") || create.data?.code === "23505") {
      // User already exists — find by email filter and update password
      process.stdout.write(`  Already exists, looking up by email...\n`);

      const lookup = await gotrue("GET", `/admin/users?filter=email%3D${encodeURIComponent(seed.email)}`);
      const users = lookup.data?.users ?? [];
      if (users.length === 0) {
        process.stdout.write(`  ERROR: Could not find user by email\n`);
        continue;
      }
      uid = users[0].id;
      process.stdout.write(`  Found (id: ${uid})\n`);

      // Update password
      const upd = await gotrue("PUT", `/admin/users/${uid}`, {
        password: "password123",
        email_confirm: true,
      });
      if (!upd.ok) {
        process.stdout.write(`  ERROR updating password (${upd.status}): ${JSON.stringify(upd.data)}\n`);
        continue;
      }
      process.stdout.write(`  Password updated\n`);

      // Unban if needed
      if (users[0].banned_until) {
        await gotrue("PUT", `/admin/users/${uid}`, { ban_duration: "none" });
        process.stdout.write(`  Ban removed\n`);
      }
    } else {
      process.stdout.write(`  ERROR creating (${create.status}): ${JSON.stringify(create.data)}\n`);
      continue;
    }

    // 2) Upsert profile, user_profiles, user_roles
    const { error: pe } = await supabase.from("profiles").upsert(
      { id: uid, full_name: seed.fullName, initials: seed.initials },
      { onConflict: "id" },
    );
    process.stdout.write(pe ? `  ERROR profile: ${pe.message}\n` : `  Profile OK\n`);

    const { error: upe } = await supabase.from("user_profiles").upsert(
      { id: uid, display_name: seed.fullName, password_set: true },
      { onConflict: "id" },
    );
    process.stdout.write(upe ? `  ERROR user_profiles: ${upe.message}\n` : `  User_profiles OK\n`);

    const { error: re } = await supabase.from("user_roles").upsert(
      { user_id: uid, role: seed.role },
      { onConflict: "user_id" },
    );
    process.stdout.write(re ? `  ERROR role: ${re.message}\n` : `  Role '${seed.role}' OK\n`);
  }

  process.stdout.write("\n=== Done ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
