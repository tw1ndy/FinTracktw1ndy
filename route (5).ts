import { cookies } from "next/headers";
import { getSupabaseAdminlessClient, jsonError, setSessionCookies } from "@/lib/server-supabase";
export const runtime = "nodejs";
export async function GET() {
  try {
    const jar = cookies(); const access = jar.get("ft_access")?.value; const refresh = jar.get("ft_refresh")?.value;
    if (!access) return Response.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
    const client = getSupabaseAdminlessClient();
    const { data, error } = await client.auth.getUser(access);
    if (!error && data.user) return Response.json({ user: { id: data.user.id, email: data.user.email } }, { headers: { "Cache-Control": "no-store" } });
    if (!refresh) return Response.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
    const renewed = await client.auth.refreshSession({ refresh_token: refresh });
    if (renewed.error || !renewed.data.session || !renewed.data.user) return Response.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
    const response = Response.json({ user: { id: renewed.data.user.id, email: renewed.data.user.email } }, { headers: { "Cache-Control": "no-store" } });
    setSessionCookies(response, renewed.data.session.access_token, renewed.data.session.refresh_token, renewed.data.session.expires_in);
    return response;
  } catch { return jsonError("Не удалось проверить сессию.", 500); }
}
