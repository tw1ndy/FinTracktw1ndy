import { allowRequest, getClientIp } from "@/lib/rate-limit";
import { assertSameOrigin, getSupabaseAdminlessClient, jsonError, setSessionCookies } from "@/lib/server-supabase";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = getClientIp(request);
    if (!allowRequest(`login:${ip}`, 8, 10 * 60 * 1000)) return jsonError("Слишком много попыток. Попробуйте позже.", 429);
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) return jsonError("Проверьте почту и пароль (8–128 символов).");
    const client = getSupabaseAdminlessClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) return jsonError("Не удалось войти. Проверьте данные или подтвердите почту.", 401);
    const response = Response.json({ user: { id: data.user.id, email: data.user.email } }, { headers: { "Cache-Control": "no-store" } });
    setSessionCookies(response, data.session.access_token, data.session.refresh_token, data.session.expires_in);
    return response;
  } catch (error) { return jsonError(error instanceof Error && error.message === "Invalid request origin" ? "Недопустимый источник запроса." : "Ошибка авторизации.", 403); }
}
