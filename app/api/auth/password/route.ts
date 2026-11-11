import { cookies } from "next/headers";
import { assertSameOrigin, getSupabaseAdminlessClient, jsonError } from "@/lib/server-supabase";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const jar = await cookies(); const access = jar.get("ft_access")?.value; const refresh = jar.get("ft_refresh")?.value;
    if (!access || !refresh) return jsonError("Сессия истекла. Откройте ссылку восстановления повторно.", 401);
    const body = await request.json(); const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8 || password.length > 128) return jsonError("Пароль должен содержать от 8 до 128 символов.");
    const client = getSupabaseAdminlessClient();
    const session = await client.auth.setSession({ access_token: access, refresh_token: refresh });
    if (session.error) return jsonError("Недействительная сессия.", 401);
    const updated = await client.auth.updateUser({ password });
    if (updated.error) return jsonError("Не удалось обновить пароль.", 400);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Ошибка обновления пароля.", 403); }
}
