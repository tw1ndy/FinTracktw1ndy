import { cookies } from "next/headers";
import { assertSameOrigin, clearSessionCookies, getSupabaseAdminlessClient, jsonError } from "@/lib/server-supabase";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const jar = await cookies(); const access = jar.get("ft_access")?.value; const refresh = jar.get("ft_refresh")?.value;
    if (access && refresh) {
      const client = getSupabaseAdminlessClient();
      const session = await client.auth.setSession({ access_token: access, refresh_token: refresh });
      if (!session.error) await client.auth.signOut({ scope: "local" });
    }
    const response = Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }); clearSessionCookies(response); return response;
  } catch { const response = Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }); clearSessionCookies(response); return response; }
}
