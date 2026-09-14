import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const COOKIE_NAME = "coinrenta_password_recovery";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (!code && !(tokenHash && type === "recovery")) {
    return NextResponse.redirect(new URL("/restablecer", url.origin));
  }

  const supabase = await createClient();
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash! });

  if (result.error) {
    return NextResponse.redirect(new URL("/404", url.origin));
  }

  const response = NextResponse.redirect(new URL("/restablecer", url.origin));
  response.cookies.set(COOKIE_NAME, "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
