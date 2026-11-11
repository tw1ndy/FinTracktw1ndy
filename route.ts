import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminlessClient, setSessionCookies } from "@/lib/server-supabase";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = request.nextUrl.searchParams.get("next");
  const allowedNext = next === "/reset-password" ? next : "/";
  if (!tokenHash || !["recovery", "signup", "email"].includes(type || "")) return NextResponse.redirect(new URL("/?auth_error=invalid_link", request.url));
  try {
    const client = getSupabaseAdminlessClient();
    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as "recovery" | "signup" | "email" });
    if (error || !data.session) return NextResponse.redirect(new URL("/?auth_error=expired_link", request.url));
    const response = NextResponse.redirect(new URL(allowedNext, request.url));
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const common = `; Path=/; HttpOnly; SameSite=Lax${secure}`;
    response.headers.append("Set-Cookie", `ft_access=${encodeURIComponent(data.session.access_token)}${common}; Max-Age=${Math.max(60, data.session.expires_in)}`);
    response.headers.append("Set-Cookie", `ft_refresh=${encodeURIComponent(data.session.refresh_token)}${common}; Max-Age=${60 * 60 * 24 * 30}`);
    return response;
  } catch { return NextResponse.redirect(new URL("/?auth_error=confirmation_failed", request.url)); }
}
