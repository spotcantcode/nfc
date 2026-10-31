import "server-only";
import { z } from "zod";

// Fail closed. Vercel can never enable management, even if local variables are copied there.
export function managementEnabled() {
  return process.env.APP_MODE === "local-admin" && !process.env.VERCEL;
}
function origin(value: string, local: boolean) {
  const url = new URL(value);
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password)
    throw new Error("Configure an origin without a path, credentials, query, or fragment.");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    local
      ? !loopback || !["http:", "https:"].includes(url.protocol)
      : url.protocol !== "https:" &&
        !(process.env.NODE_ENV !== "production" && loopback && url.protocol === "http:")
  )
    throw new Error(
      local
        ? "ADMIN_APP_URL must be a loopback origin."
        : "NEXT_PUBLIC_APP_URL must be a fixed HTTPS origin.",
    );
  return url.origin;
}
export function publicConfig() {
  const env = z
    .object({
      SUPABASE_URL: z.url(),
      SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
      NEXT_PUBLIC_APP_URL: z.url(),
    })
    .parse(process.env);
  // Reject accidental privileged keys in the public-runtime key setting.
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  if (key.startsWith("sb_secret_"))
    throw new Error("The public runtime must use a publishable key.");
  if (key.split(".").length === 3) {
    const claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
    if (claims.role !== "anon")
      throw new Error("Only an anon legacy key may be used for public redirects.");
  }
  return { ...env, appUrl: origin(env.NEXT_PUBLIC_APP_URL, false) };
}
export function configured() {
  return (
    managementEnabled() &&
    Boolean(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_PUBLISHABLE_KEY &&
      process.env.SUPABASE_SECRET_KEY &&
      process.env.SESSION_SECRET &&
      process.env.ADMIN_EMAILS &&
      process.env.NEXT_PUBLIC_APP_URL &&
      process.env.ADMIN_APP_URL,
    )
  );
}
// Privileged configuration is available only to the local administration process.
export function config() {
  if (!managementEnabled()) throw new Error("Management is disabled in this runtime.");
  const env = z
    .object({
      SUPABASE_SECRET_KEY: z.string().min(1),
      SESSION_SECRET: z.string().min(32),
      ADMIN_EMAILS: z.string().min(1),
      ADMIN_APP_URL: z.url(),
    })
    .parse(process.env);
  return { ...publicConfig(), ...env, adminUrl: origin(env.ADMIN_APP_URL, true) };
}
