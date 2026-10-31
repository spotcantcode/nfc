import "server-only";
import { randomBytes } from "node:crypto";
// 24 cryptographically random bytes = 192 bits of entropy, 32 URL-safe characters.
export function generateId() {
  return randomBytes(24).toString("base64url");
}
