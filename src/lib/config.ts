import "server-only";
import { z } from "zod";

export function configured() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY &&
    process.env.SESSION_SECRET &&
    process.env.ADMIN_EMAILS &&
    process.env.NEXT_PUBLIC_APP_URL,
  );
}
export function config() {
  const env = z
    .object({
      SUPABASE_URL: z.url(),
      SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
      SUPABASE_SECRET_KEY: z.string().min(1),
      SESSION_SECRET: z.string().min(32),
      ADMIN_EMAILS: z.string().min(1),
      NEXT_PUBLIC_APP_URL: z.url(),
    })
    .parse(process.env);
  const url = new URL(env.NEXT_PUBLIC_APP_URL);
  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        url.hostname === "localhost"
      ))
  ) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be a fixed HTTPS origin (localhost allowed in development).",
    );
  }
  return { ...env, appUrl: url.origin };
}
