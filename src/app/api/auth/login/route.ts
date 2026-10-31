import { authClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";
import { body, checkOrigin, failure, HttpError, json } from "@/lib/http";
import { isAdmin, loginInput } from "@/lib/validation";
import { privateKey, rateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const parsed = loginInput.safeParse(await body(request));
    if (!parsed.success) throw new HttpError(400, "Enter a valid email address.");
    await rateLimit("login:global", 60, 60);
    await rateLimit(`login:email:${privateKey(parsed.data.email)}`, 3, 900);
    // Same response for unknown, unprovisioned, and allowed accounts, including provider errors.
    if (isAdmin(parsed.data.email)) {
      try {
        const client = await authClient();
        await client.auth.signInWithOtp({
          email: parsed.data.email,
          options: { shouldCreateUser: false, emailRedirectTo: `${config().appUrl}/auth/callback` },
        });
      } catch {
        /* Keep transport failures indistinguishable from unknown accounts. */
      }
    }
    return json({
      message:
        "If this email has access, a sign-in link will arrive shortly. Open it in this browser.",
    });
  } catch (error) {
    return failure(error);
  }
}
