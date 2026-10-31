import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { authClient } from "@/lib/supabase/server";
import { adminDb } from "@/lib/supabase/admin";
import { configured, managementEnabled } from "@/lib/config";
import { assertManagementEnabled, assertLocalRequest } from "@/lib/management";
import { isAdmin } from "@/lib/validation";
import { HttpError } from "@/lib/http";
import { sessionCookie, validSession } from "@/lib/session";
export async function requireAdmin() {
  assertManagementEnabled();
  if (!configured()) throw new HttpError(503, "The owner needs to finish configuring this app.");
  await assertLocalRequest();
  const client = await authClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user || !isAdmin(user.email))
    throw new HttpError(401, "Please sign in to continue.");
  if (!validSession((await cookies()).get(sessionCookie)?.value, user.id))
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  // getUser validates the token; check its session against Auth to reject revoked sessions immediately.
  const {
    data: { session },
  } = await client.auth.getSession();
  let sessionId: string;
  try {
    sessionId = JSON.parse(
      Buffer.from(session!.access_token.split(".")[1], "base64url").toString(),
    ).session_id;
  } catch {
    throw new HttpError(401, "Please sign in again.");
  }
  const live = await adminDb().rpc("nfc_is_live_session", {
    p_session: sessionId,
    p_user: user.id,
  });
  if (live.error) throw new HttpError(503, "Unable to verify your session. Please try again.");
  if (!live.data) throw new HttpError(401, "Your session has ended. Please sign in again.");
  return user;
}
export async function requirePageAdmin() {
  if (!managementEnabled()) notFound();
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof HttpError && (error.status === 401 || !configured())) redirect("/login");
    throw error;
  }
}
