import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./database.types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser — token refresh
  // and cookie propagation depend on this call happening first.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute =
    pathname === "/login" || pathname.startsWith("/auth/");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return preserveCookies(NextResponse.redirect(url), supabaseResponse);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return preserveCookies(NextResponse.redirect(url), supabaseResponse);
  }

  return supabaseResponse;
}

// Copy any Set-Cookie that supabase wrote during getUser() (e.g. a refreshed
// access token) onto a different response we're about to return. Without this,
// a token refresh that lands on a redirect path silently throws the refreshed
// cookies away — the next navigation then sees a stale session and the proxy
// bounces the user to /login.
function preserveCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie.name, cookie.value, cookie);
  }
  return target;
}
