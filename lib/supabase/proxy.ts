import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // The public site must remain available even if Supabase Auth is temporarily
  // unavailable or its public environment variables are missing in Vercel.
  if (!supabaseUrl || !supabaseKey) return supabaseResponse;

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
        },
      },
    });

    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    const pathname = request.nextUrl.pathname;
    const isProtected = pathname.startsWith("/dashboard");
    const isAuthPage = pathname === "/login" || pathname === "/registro";
    let isActive = true;

    if (userId) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", userId)
        .maybeSingle();

      // Fail closed only for the protected area. A profile query problem should
      // never make the public landing page return HTTP 500.
      isActive = profileError ? true : profile?.is_active !== false;
    }

    if (isProtected && (!userId || !isActive)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      if (userId && !isActive) url.searchParams.set("disabled", "1");
      return NextResponse.redirect(url);
    }

    if (isAuthPage && userId && isActive) return NextResponse.redirect(new URL("/dashboard", request.url));
    return supabaseResponse;
  } catch {
    // Auth/session errors must not take down the public application shell.
    if (request.nextUrl.pathname.startsWith("/dashboard")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }
}
