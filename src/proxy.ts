import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions } from "@/lib/supabase/server";
import { noStore } from "@/lib/http";
import { configured, managementEnabled, publicConfig } from "@/lib/config";

export async function proxy(request: NextRequest) {
  // Gate before auth, configuration, refresh, or database access. Public routes bypass this proxy.
  if (!managementEnabled())
    return new NextResponse("Not found.", { status: 404, headers: noStore });
  const localUrl = process.env.ADMIN_APP_URL;
  if (!localUrl)
    return new NextResponse("Set ADMIN_APP_URL to your local dashboard origin.", {
      status: 503,
      headers: noStore,
    });
  try {
    const url = new URL(localUrl);
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      request.headers.get("host") !== url.host
    )
      return new NextResponse("Not found.", { status: 404, headers: noStore });
  } catch {
    return new NextResponse("Invalid local dashboard configuration.", {
      status: 503,
      headers: noStore,
    });
  }
  let response = NextResponse.next({ request });
  if (configured() && request.nextUrl.pathname !== "/auth/callback") {
    const env = publicConfig();
    const client = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
      cookieOptions: cookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              ...cookieOptions(),
              ...(options.maxAge === 0 ? { maxAge: 0 } : {}),
            }),
          );
        },
      },
    });
    await client.auth.getUser();
  }
  Object.entries(noStore).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
export const config = {
  matcher: ["/", "/dashboard/:path*", "/login/:path*", "/auth/:path*", "/api/:path*"],
};
