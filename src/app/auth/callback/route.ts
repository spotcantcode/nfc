import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { authClient, cookieOptions } from "@/lib/supabase/server";
import { sessionCookie, sessionSeconds, signSession } from "@/lib/session";
import { isAdmin } from "@/lib/validation";
import { noStore } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
export async function GET(request: Request) {
  const origin = config().appUrl;
  try {
    await rateLimit("auth:callback", 120, 60);
    const code = new URL(request.url).searchParams.get("code");
    if (code && code.length < 2048) {
      const client = await authClient();
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (!error && data.user && isAdmin(data.user.email)) {
        (await cookies()).set(sessionCookie, signSession(data.user.id), {
          ...cookieOptions(),
          maxAge: sessionSeconds,
        });
        return NextResponse.redirect(`${origin}/dashboard`, { status: 303, headers: noStore });
      }
      await client.auth.signOut({ scope: "local" });
    }
  } catch {
    /* Generic error, never expose provider details. */
  }
  return NextResponse.redirect(`${origin}/login?error=link`, { status: 303, headers: noStore });
}
