import "server-only";
import { Resolver } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { destinationUrl } from "@/lib/validation";
import { config } from "@/lib/config";
export async function publicDestination(value: string) {
  const normalized = destinationUrl(value);
  const url = new URL(normalized);
  if (url.origin === config().appUrl && url.pathname.startsWith("/nfc/"))
    throw new Error("Choose a destination outside this app's NFC redirects.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host)) return normalized;
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  const timer = setTimeout(() => resolver.cancel(), 2500);
  try {
    const results = await Promise.allSettled([resolver.resolve4(host), resolver.resolve6(host)]);
    const addresses = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    if (!addresses.length)
      throw new Error("This destination could not be found. Check the domain and try again.");
    if (addresses.some((address) => ipaddr.parse(address).range() !== "unicast"))
      throw new Error("The destination resolves to a private or reserved network.");
    return normalized;
  } finally {
    clearTimeout(timer);
  }
}
