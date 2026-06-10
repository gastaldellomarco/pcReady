const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const URL = process.env.SUPABASE_URL;
const H = { apikey: KEY, Authorization: "Bearer " + KEY };

async function main() {
  // List all users
  const res = await fetch(URL + "/auth/v1/admin/users?page=1&per_page=500", { headers: H });
  const data = await res.json();
  const users = data?.users ?? [];
  console.log("Total users:", users.length);
  for (const u of users) {
    console.log("  -", u.email, "|", u.id.slice(0, 8) + "...", "| banned:", !!u.banned_until);
  }
}
main().catch(console.error);
