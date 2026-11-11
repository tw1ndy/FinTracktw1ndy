import { cookies } from "next/headers";
import { allowRequest, getClientIp } from "@/lib/rate-limit";
import { assertSameOrigin, getSupabaseAdminlessClient, jsonError, setSessionCookies } from "@/lib/server-supabase";
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
    const ip = getClientIp(request);
    if (!allowRequest(`password:${ip}`, 5, 60 * 60 * 1000)) return jsonError("Слишком много запросов. Попробуйте позже.", 429);
    const updated = await client.auth.updateUser({ password });
    if (updated.error) return jsonError("Не удалось обновить пароль.", 400);
    const response = Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    if (session.data.session) setSessionCookies(response, session.data.session.access_token, session.data.session.refresh_token, session.data.session.expires_in);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid request origin") return jsonError("Недопустимый источник запроса.", 403);
    return jsonError("Ошибка обновления пароля.", 500);
  }
}
