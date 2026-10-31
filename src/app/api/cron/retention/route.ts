import { timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/supabase/admin";
import { failure, json } from "@/lib/http";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (!secret || expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return json({ error: "Unauthorized" }, 401);
  try {
    const { error } = await adminDb().rpc("prune_history");
    if (error) throw error;
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
