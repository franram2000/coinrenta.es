import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/dashboard";

  if (code || tokenHash) {
    const supabase = await createClient();
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : type
        ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash! })
        : { error: new Error("Missing token type") };

    if (!result.error) {
      if (type === "email") return NextResponse.redirect(new URL("/correo-verificado", origin));
      return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/dashboard", origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback", origin));
}
