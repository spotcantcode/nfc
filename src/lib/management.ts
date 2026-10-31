import "server-only";
import { headers } from "next/headers";
import { config, managementEnabled } from "@/lib/config";
import { HttpError } from "@/lib/http";
export function assertManagementEnabled() {
  if (!managementEnabled()) throw new HttpError(404, "Not found.");
}
export async function assertLocalRequest() {
  assertManagementEnabled();
  const incoming = await headers();
  if (incoming.get("host") !== new URL(config().adminUrl).host)
    throw new HttpError(403, "Open the dashboard at its configured local address.");
}
