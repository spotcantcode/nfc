import { z } from "zod";
import ipaddr from "ipaddr.js";

export const publicId = z.string().regex(/^[A-Za-z0-9_-]{32}$/);
export function destinationUrl(value: string): string {
  if (
    value.length > 2048 ||
    /[\s\\]/.test(value) ||
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    throw new Error("Enter a valid public HTTPS URL without spaces.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete HTTPS URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443"))
    throw new Error("Use HTTPS without credentials or a custom port.");
  const host = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  const isIp = ipaddr.isValid(host);
  if (isIp && ipaddr.parse(host).range() !== "unicast")
    throw new Error("Private, local, and reserved IP addresses are not allowed.");
  if (
    !isIp &&
    (!host.includes(".") ||
      /(^|\.)(localhost|local|internal|lan|home|test|invalid|example|onion)$/.test(host))
  )
    throw new Error("Use a public internet destination.");
  if (host.endsWith(".arpa")) throw new Error("Use a public internet destination.");
  return url.toString();
}
export const tagInput = z
  .object({
    name: z.string().trim().min(1, "Give your tag a name.").max(100),
    destination_url: z.string().transform((s, ctx) => {
      try {
        return destinationUrl(s.trim());
      } catch (e) {
        ctx.addIssue({ code: "custom", message: (e as Error).message });
        return z.NEVER;
      }
    }),
    description: z.string().trim().max(1000).default(""),
    active: z.boolean(),
  })
  .strict();
export const loginInput = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.trim().toLowerCase()),
  })
  .strict();
export function isAdmin(email: string | undefined, emails = process.env.ADMIN_EMAILS ?? "") {
  return Boolean(
    email &&
    emails
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .includes(email.toLowerCase()),
  );
}
