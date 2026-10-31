import { cookies } from "next/headers";
import { authClient } from "@/lib/supabase/server";
import { sessionCookie } from "@/lib/session";
import { checkOrigin, failure, json } from "@/lib/http";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const client = await authClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    (await cookies()).delete(sessionCookie);
    if (error) throw error;
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
