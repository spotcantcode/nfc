import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";
export const sessionCookie = "nfc-session";
export const sessionSeconds = 12 * 60 * 60;
export function signSession(userId: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ userId, expires: now + sessionSeconds * 1000 }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", config().SESSION_SECRET).update(payload).digest("base64url")}`;
}
export function validSession(value: string | undefined, userId: string, now = Date.now()) {
  if (!value) return false;
  try {
    const [payload, signature] = value.split(".");
    const expected = createHmac("sha256", config().SESSION_SECRET).update(payload).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.userId === userId && Number.isFinite(data.expires) && data.expires > now;
  } catch {
    return false;
  }
}
