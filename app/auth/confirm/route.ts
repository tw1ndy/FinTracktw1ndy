import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminlessClient, setSessionCookies } from "@/lib/server-supabase";
function redirectWithHeaders(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = request.nextUrl.searchParams.get("next");
  const allowedNext = next === "/reset-password" ? next : "/";
  if (!tokenHash || !["recovery", "signup", "email"].includes(type || "")) return redirectWithHeaders(request, "/?auth_error=invalid_link");
  try {
    const client = getSupabaseAdminlessClient();
    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as "recovery" | "signup" | "email" });
    if (error || !data.session) return redirectWithHeaders(request, "/?auth_error=expired_link");
    const response = redirectWithHeaders(request, allowedNext);
    setSessionCookies(response, data.session.access_token, data.session.refresh_token, data.session.expires_in);
    return response;
  } catch { return redirectWithHeaders(request, "/?auth_error=confirmation_failed"); }
}
