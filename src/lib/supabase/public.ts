import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicConfig } from "@/lib/config";
// The deployed runtime has no service-role credential, even for scan writes.
export function redirectDb() {
  const env = publicConfig();
  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
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
