import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ACCESS_COOKIE = "ft_access";
const REFRESH_COOKIE = "ft_refresh";
export function getSupabaseAdminlessClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function getUserScopedClient(accessToken: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase environment is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${accessToken}` } } });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  if (!origin || origin !== expected) {
    throw new Error("Invalid request origin");
  }
}

export function setSessionCookies(response: Response, accessToken: string, refreshToken: string, expiresIn: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const common = `; Path=/; HttpOnly; SameSite=Lax${secure}`;
  response.headers.append("Set-Cookie", `${ACCESS_COOKIE}=${encodeURIComponent(accessToken)}${common}; Max-Age=${Math.max(60, expiresIn)}`);
  response.headers.append("Set-Cookie", `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}${common}; Max-Age=${60 * 60 * 24 * 30}`);
}

export function clearSessionCookies(response: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const common = `; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`;
  response.headers.append("Set-Cookie", `${ACCESS_COOKIE}=${common}`);
  response.headers.append("Set-Cookie", `${REFRESH_COOKIE}=${common}`);
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
