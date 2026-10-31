import "server-only";
import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
export function adminDb() {
  const env = config();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: init?.signal ?? AbortSignal.timeout(8000),
        }),
    },
  });
}
