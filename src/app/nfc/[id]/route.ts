import { after, NextResponse } from "next/server";
import { publicId } from "@/lib/validation";
import { publicDestination } from "@/lib/destination";
import { redirectDb } from "@/lib/supabase/public";
import { noStore } from "@/lib/http";
export const dynamic = "force-dynamic";
function unavailable(status = 404) {
  return new Response(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Link unavailable · NFC</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f6f4;color:#20352c;font:16px system-ui}main{padding:40px;max-width:380px}p{color:#65716b;line-height:1.7}small{letter-spacing:2px}h1{font-size:32px}</style><main><small>NFC TAG MANAGER</small><h1>This link is unavailable.</h1><p>The tag may be inactive or no longer in use. Please contact the person who shared it.</p></main></html>`,
    {
      status,
      headers: {
        ...noStore,
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
async function resolve(context: { params: Promise<{ id: string }> }, log: boolean) {
  const parsed = publicId.safeParse((await context.params).id);
  if (!parsed.success) return unavailable();
  try {
    const { data, error } = await redirectDb().rpc("resolve_nfc", { p_id: parsed.data });
    if (error) return unavailable(503);
    if (!data?.[0]?.destination_url) return unavailable();
    const destination = await publicDestination(data[0].destination_url);
    // after() extends the Vercel invocation, without delaying or risking the redirect.
    if (log)
      after(async () => {
        try {
          await redirectDb().rpc("record_scan", { p_id: parsed.data });
        } catch {
          /* Analytics must never break the link. */
        }
      });
    return NextResponse.redirect(destination, {
      status: 307,
      headers: {
        ...noStore,
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return unavailable(503);
  }
}
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return resolve(context, true);
}
export async function HEAD(_request: Request, context: { params: Promise<{ id: string }> }) {
  const response = await resolve(context, false);
  return new Response(null, { status: response.status, headers: response.headers });
}
