import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
const email = z.email().parse(process.argv[2]?.trim().toLowerCase());
const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase());
if (!admins.includes(email)) throw new Error("Add this exact address to ADMIN_EMAILS first.");
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
  throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error } = await db.auth.admin.createUser({ email, email_confirm: true });
if (error) {
  console.error("Could not provision owner:", error.message);
  process.exitCode = 1;
} else console.log(`Owner provisioned: ${email}. You can now request a magic link.`);
