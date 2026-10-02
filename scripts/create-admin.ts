/**
 * Create (or promote) the shop admin account.
 *
 *   npx tsx scripts/create-admin.ts admin@example.com "Full Name" "a-strong-password"
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

async function main() {
  const [email, fullName, password] = process.argv.slice(2);
  if (!email || !fullName) {
    console.error('Usage: npx tsx scripts/create-admin.ts <email> "<full name>" [password]');
    process.exit(1);
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });

  let userId: string | undefined;
  const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) {
    userId = existing.id;
    console.log("User exists; promoting to admin.");
  } else {
    if (!password || password.length < 8) {
      console.error("Provide a password of at least 8 characters for a new account.");
      process.exit(1);
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const { error } = await supabase.from("profiles").update({ role: "admin", active: true, full_name: fullName }).eq("id", userId);
  if (error) throw error;
  console.log(`Admin ready: ${email}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
