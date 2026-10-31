import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { cookieOptions } from "@/lib/supabase/server";
import { noStore } from "@/lib/http";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return response;
  const client = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    {
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
    },
  );
  await client.auth.getUser();
  Object.entries(noStore).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}
export const config = { matcher: ["/dashboard/:path*", "/api/tags/:path*", "/api/auth/logout"] };
