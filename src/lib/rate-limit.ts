import "server-only";
import { createHmac } from "node:crypto";
import { config } from "@/lib/config";
import { adminDb } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/http";
export function privateKey(value: string) {
  return createHmac("sha256", config().SESSION_SECRET).update(value).digest("hex");
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const { data, error } = await adminDb().rpc("nfc_consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_seconds: seconds,
  });
  if (error) throw new HttpError(503, "Temporarily unavailable. Please try again shortly.");
  if (!data)
    throw new HttpError(429, "Too many requests. Please wait a few minutes and try again.");
}
