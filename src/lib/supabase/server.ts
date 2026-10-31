import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { config } from "@/lib/config";
export const cookieOptions = () => ({
  httpOnly: true,
  secure: new URL(config().adminUrl).protocol === "https:",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 12,
});
// No browser Supabase client: auth and refresh happen only on our server.
export async function authClient() {
  const store = await cookies();
  const env = config();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: cookieOptions(),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, {
              ...options,
              ...cookieOptions(),
              ...(options.maxAge === 0 ? { maxAge: 0 } : {}),
            }),
          );
        } catch {
          /* RSC cannot write cookies. The proxy refreshes sessions first. */
        }
      },
    },
  });
}
